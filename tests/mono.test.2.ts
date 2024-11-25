import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { RaydiumCpSwap } from "../target/types/raydium_cp_swap";

import { createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { setupInitializeTest, initialize, calculateFee, updateDiscountAuthority, createAccountWithSol, updateDiscountConfig, deposit, swap_base_input, logTrangaction, sleep, getDiscountConfigAddress, logBalances, createAmmConfig, getAmmConfigAddress, sendTransaction } from "./utils";
import { assert } from "chai";
import { ConfirmOptions, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";

// import { setGlobalDispatcher, Agent } from "undici-types";

// setGlobalDispatcher(
//   new Agent({
//     connections: 100,
//   })
// );

const confirmOptions: ConfirmOptions = {
    skipPreflight: false,
    commitment: 'confirmed',
    maxRetries: 100,
};

// const connection = anchor.getProvider().connection;
const connection = new Connection("devnet cluster");
const program = anchor.workspace.RaydiumCpSwap as Program<RaydiumCpSwap>;
anchor.setProvider(anchor.AnchorProvider.env());
const owner = anchor.Wallet.local().payer;
console.log("program:", program.programId.toBase58());
console.log("owner:", owner.publicKey.toString());
const mintAuthority = Keypair.fromSecretKey(new Uint8Array([241,90,149,70,91,4,182,182,147,125,114,33,99,4,156,235,0,120,97,75,64,61,41,25,247,105,177,182,8,37,123,19,188,195,232,148,60,127,42,60,71,64,138,64,172,127,217,9,136,37,46,202,87,87,22,224,157,217,134,198,46,137,58,2]));

type AmmConfig = {
    config_index: number;
    tradeFeeRate: BN;
    protocolFeeRate: BN;
    fundFeeRate: BN;
    create_fee: BN;
};

async function initConfig(ammConfig: AmmConfig) {
    const [address, _] = await getAmmConfigAddress(
        ammConfig.config_index,
        program.programId
    );
    console.log(`AmmConfig:${ammConfig.config_index} addr: ${address}`);
    const info = await connection.getAccountInfo(address);
    if(info) {
        console.log(`AmmConfig:${ammConfig.config_index} already exists`);
        return address;
    }
    const ix = await program.methods
    .createAmmConfig(
        ammConfig.config_index,
        ammConfig.tradeFeeRate,
        ammConfig.protocolFeeRate,
        ammConfig.fundFeeRate,
        ammConfig.create_fee
    )
    .accounts({
      owner: owner.publicKey,
      ammConfig: address,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
    const tx = await sendTransaction(connection, [ix], [owner], confirmOptions);
    console.log("init amm config tx: ", tx);
    await logTrangaction(connection, tx);
    return address;
}

async function mintTokens(): Promise<[PublicKey, PublicKey]> {
    // const mintAuthority = new Keypair();
    // const txSendSolToMintAuth =  await sendTransaction(connection, [
    //     SystemProgram.transfer({
    //         fromPubkey: owner.publicKey,
    //         toPubkey: mintAuthority.publicKey,
    //         lamports: LAMPORTS_PER_SOL/10,
    //     })
    // ], [owner]);
    // console.log(`mintAuthority ${mintAuthority.publicKey}, ${mintAuthority.secretKey}`)
    // console.log(`transfer Sol to mintAuthority ${txSendSolToMintAuth}`);
    console.log(`mintAuthority `, mintAuthority.publicKey.toBase58());
    const createToken = () => createMint(
        connection,
        owner,
        mintAuthority.publicKey,
        null,
        9,
        undefined,
        confirmOptions,
        TOKEN_PROGRAM_ID
    );

    let token0 = await createToken();
    let token1 = await createToken();
    console.log('Mints created');
    await sleep(1000);
    const tokens: [PublicKey, PublicKey] = token0 < token1 ? [token0, token1] : [token1, token0] ;

    const getAta = (token: PublicKey) => getOrCreateAssociatedTokenAccount(
        connection,
        owner,
        token,
        owner.publicKey,
        false,
        "confirmed",
        { skipPreflight: true },
        TOKEN_PROGRAM_ID
    );
  
    const ownerToken0Account = await getAta(token0);
    const ownerToken1Account = await getAta(token1);

    const mintToken = (token: PublicKey, ata: PublicKey) => mintTo(
        connection,
        owner,
        token,
        ata,
        mintAuthority,
        100_000_000_000_000,
        [],
        { skipPreflight: true },
        TOKEN_PROGRAM_ID
    );

    const txMint0 = await mintToken(token0, ownerToken0Account.address);
    const txMint1 = await mintToken(token1, ownerToken1Account.address);
    console.log(`token0: ${tokens[0]} minted tx ${txMint0}, token1: ${tokens[1]} minted tx ${txMint1}`);
    await sleep(1000);
    await logBalances(connection, owner.publicKey, tokens[0], TOKEN_PROGRAM_ID, tokens[1], TOKEN_PROGRAM_ID);
    return tokens;
}

async function createPool(cfg: {
    configAddress: PublicKey,
    tokens: [PublicKey, PublicKey],
    initAmount: {initAmount0: BN, initAmount1: BN}
}) {
    return await initialize(
        connection,
        program,
        owner,
        cfg.configAddress,
        cfg.tokens[0],
        TOKEN_PROGRAM_ID,
        cfg.tokens[1],
        TOKEN_PROGRAM_ID,
        confirmOptions,
        cfg.initAmount,
        new PublicKey("G11FKBRaAkHAKuLCgLM6K6NUc9rTjPAznRCjZifrTQe2"),
    );
}

async function swap(cfg: {
    ammConfig: PublicKey,
    tokens: [PublicKey, PublicKey]
}) {
    const txSwap1 = await swap_base_input(
        connection,
        program,
        owner,
        cfg.ammConfig,
        cfg.tokens[0],
        TOKEN_PROGRAM_ID,
        cfg.tokens[1],
        TOKEN_PROGRAM_ID,
        new BN(100000),
        new BN(0),
        confirmOptions
      );
      console.log("^--------SWAP--------------------------", txSwap1);

      await logTrangaction(connection, txSwap1);
    //   await sleep(5000);
      await logBalances(connection, owner.publicKey, cfg.tokens[0], TOKEN_PROGRAM_ID, cfg.tokens[1], TOKEN_PROGRAM_ID);
}

async function main() {
    const config_index = 6;
    
    const ammConfig = await initConfig({
        config_index: config_index,
        tradeFeeRate: new BN(1000),
        protocolFeeRate: new BN(0),
        fundFeeRate: new BN(0),
        create_fee: new BN(0),
    });
    console.log("ammConfig address:", ammConfig.toBase58());
    await sleep(5000);
    const tokens = await mintTokens();
    await sleep(5000);
    await updateDiscountAuthority(program, connection, owner, ammConfig, mintAuthority.publicKey);
    const poolAddress = await createPool({
        configAddress: ammConfig,
        tokens,
        initAmount: {initAmount0: new BN(10_000000000), initAmount1: new BN(10_000000000)}
    });
    console.log("New Pool", poolAddress.toBase58());
    await logBalances(connection, owner.publicKey, tokens[0], TOKEN_PROGRAM_ID, tokens[1], TOKEN_PROGRAM_ID);
    console.log("SWAP");
    await swap({ammConfig, tokens});
    console.log("SETUP-FEE-DISCOUNT--------------------------");
    const txUpdateDiscount = await updateDiscountConfig(program, connection, mintAuthority, owner.publicKey, 50, confirmOptions);
    console.log('^-SETUP-FEE-DISCOUNT tx', txUpdateDiscount);
    console.log("SWAP");
    await swap({ammConfig, tokens});
    console.log("End Test");
}

main().catch(err => console.log(err));