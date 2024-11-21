import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { RaydiumCpSwap } from "../target/types/raydium_cp_swap";

import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { setupInitializeTest, initialize, calculateFee, updateDiscountAuthority, createAccountWithSol, updateDiscountConfig, deposit, swap_base_input, logTrangaction, sleep, getDiscountConfigAddress } from "./utils";
import { assert } from "chai";
import { ConfirmOptions, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

describe("mono test", () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const owner = anchor.Wallet.local().payer;
    console.log("owner: ", owner.publicKey.toString());
    const connection = anchor.getProvider().connection;
  
    const program = anchor.workspace.RaydiumCpSwap as Program<RaydiumCpSwap>;

    // let walletDiscountAuthority: Keypair; //P = createAccountWithSol(connection, owner);
  
    const confirmOptions: ConfirmOptions = {
      skipPreflight: true,
      commitment: 'confirmed'
    };
  
    // it("create pool without fee", async () => {
    //     const info = await connection.getAccountInfo(owner.publicKey);
    //     console.log(`owner has ${info.lamports/LAMPORTS_PER_SOL} sol`);
    //   const { configAddress, token0, token0Program, token1, token1Program } =
    //     await setupInitializeTest(
    //       program,
    //       anchor.getProvider().connection,
    //       owner,
    //       {
    //         config_index: 0,
    //         tradeFeeRate: new BN(100),
    //         protocolFeeRate: new BN(1000),
    //         fundFeeRate: new BN(25000),
    //         create_fee: new BN(0),
    //       },
    //       { transferFeeBasisPoints: 0, MaxFee: 0 },
    //       confirmOptions
    //     );
        
  
    //   const initAmount0 = new BN(10000000000);
    //   const initAmount1 = new BN(10000000000);
    //   const { poolAddress, poolState } = await initialize(
    //     program,
    //     owner,
    //     configAddress,
    //     token0,
    //     token0Program,
    //     token1,
    //     token1Program,
    //     confirmOptions,
    //     { initAmount0, initAmount1 }
    //   );
    //   let vault0 = await getAccount(
    //     anchor.getProvider().connection,
    //     poolState.token0Vault,
    //     "processed",
    //     poolState.token0Program
    //   );
    //   assert.equal(vault0.amount.toString(), initAmount0.toString());
  
    //   let vault1 = await getAccount(
    //     anchor.getProvider().connection,
    //     poolState.token1Vault,
    //     "processed",
    //     poolState.token1Program
    //   );
    //   assert.equal(vault1.amount.toString(), initAmount1.toString());
    // });

    // it("create accounts", async () => {
    //     walletDiscountAuthority = await createAccountWithSol(connection, owner);
    // });
  
    it("create pool with fee and make swaps with different discounts", async () => {
      const { configAddress, token0, token0Program, token1, token1Program } =
        await setupInitializeTest(
          program,
          anchor.getProvider().connection,
          owner,
          {
            config_index: 1,
            tradeFeeRate: new BN(100),
            protocolFeeRate: new BN(1000),
            fundFeeRate: new BN(25000),
            create_fee: new BN(100000000),
          },
          { transferFeeBasisPoints: 0, MaxFee: 0 },
          confirmOptions
        );

        const walletDiscountAuthority = await createAccountWithSol(connection, owner);
        console.log(`walletDiscountAuthority ${walletDiscountAuthority.publicKey}`);

        const user1 = await createAccountWithSol(connection, owner);
        console.log(`user1 ${user1.publicKey}`);

        await updateDiscountAuthority(program, connection, owner, configAddress, walletDiscountAuthority.publicKey);
    //     await updateDiscountConfig(program, connection, walletDiscountAuthority, user1.publicKey, 50);
    //     const discountConfigPdaUser1 = getDiscountConfigAddress(program, user1.publicKey);
    //   let discountAccountUser1 = await program.account.discountConfig.fetchNullable(discountConfigPdaUser1);
    //     if (discountAccountUser1 === null) {
    //         console.error("DiscountConfig account not initialized!");
    //     } else {
    //         console.log(discountConfigPdaUser1.toBase58(), discountAccountUser1);
    //     }
      const initAmount0 = new BN(10000000000);
      const initAmount1 = new BN(10000000000);
      const { poolAddress, poolState } = await initialize(
        program,
        owner,
        configAddress,
        token0,
        token0Program,
        token1,
        token1Program,
        confirmOptions,
        { initAmount0, initAmount1 }
      );
      let vault0 = await getAccount(
        anchor.getProvider().connection,
        poolState.token0Vault,
        "processed",
        poolState.token0Program
      );
      assert.equal(vault0.amount.toString(), initAmount0.toString());
  
      let vault1 = await getAccount(
        anchor.getProvider().connection,
        poolState.token1Vault,
        "processed",
        poolState.token1Program
      );
      assert.equal(vault1.amount.toString(), initAmount1.toString());
      const txDeposit = await deposit(
        program,
        owner,
        poolState.ammConfig,
        poolState.token0Mint,
        poolState.token0Program,
        poolState.token1Mint,
        poolState.token1Program,
        new BN(10000000000),
        new BN(100000000000),
        new BN(100000000000),
        confirmOptions
      );
      console.log(`Deposit tx: ${txDeposit}`);
      await sleep(5000);
    //   await updateDiscountConfig(program, connection, walletDiscountAuthority, owner.publicKey, 0, confirmOptions);
    //   await sleep(5000);
    //   const discountConfigPdaOwner = getDiscountConfigAddress(program, owner.publicKey);
    //   let discountAccount = await program.account.discountConfig.fetchNullable(discountConfigPdaOwner);
    //     if (discountAccount === null) {
    //         console.error("DiscountConfig account not initialized!");
    //     } else {
    //         console.log(discountConfigPdaOwner.toBase58(), discountAccount);
    //     }
      const txSwap1 = await swap_base_input(
        program,
        owner,
        poolState.ammConfig,
        poolState.token0Mint,
        poolState.token0Program,
        poolState.token1Mint,
        poolState.token1Program,
        new BN(100000),
        new BN(0),
        confirmOptions
      );
      await logTrangaction(connection, txSwap1);
      await sleep(5000);
      
      await updateDiscountConfig(program, connection, walletDiscountAuthority, owner.publicKey, 75, confirmOptions);
    //   let discountAccount = await program.account.discountConfig.fetchNullable(discountConfigPdaOwner);
    //     if (discountAccount === null) {
    //         console.error("DiscountConfig account not initialized!");
    //     } else {
    //         console.log(discountConfigPdaOwner.toBase58(), discountAccount);
    //     }
    //   await logTrangaction(connection, txUpdateDiscount2);
      await sleep(5000);
      const txSwap2 = await swap_base_input(
        program,
        owner,
        poolState.ammConfig,
        poolState.token0Mint,
        poolState.token0Program,
        poolState.token1Mint,
        poolState.token1Program,
        new BN(100000),
        new BN(0),
        confirmOptions
      );
      await logTrangaction(connection, txSwap2);
    });
    
});
  