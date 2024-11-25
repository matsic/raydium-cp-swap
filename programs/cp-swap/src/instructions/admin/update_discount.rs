use crate::states::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateDiscountConfig<'info> {
    #[account(mut,)]
    pub authority: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub user: UncheckedAccount<'info>,
    /// Initialize config state account to store protocol owner address and fee rates.
    #[account(
        init_if_needed,
        seeds = [
            DISCOUNT_CONFIG_SEED.as_bytes(),
            user.key().as_ref(),
        ],
        bump,
        payer = authority,
        space = DiscountConfig::LEN,
        constraint = discount_config.discount <= 75
    )]
    pub discount_config: Account<'info, DiscountConfig>,
    pub system_program: Program<'info, System>,
}

pub fn update_discount_config(ctx: Context<UpdateDiscountConfig>, discount_value: u8) -> Result<()> {    
    require_gte!(75u8, discount_value);
    require_keys_neq!(ctx.accounts.user.key(), Pubkey::default());
    let config = &mut ctx.accounts.discount_config;

    #[cfg(feature = "enable-log")]
    msg!(
        "update_discount_config {} bump {}, from:{}%, to:{}%",
        config.key(), config.bump,
        config.discount,
        discount_value
    );
    
    config.discount = discount_value;
    Ok(())
}