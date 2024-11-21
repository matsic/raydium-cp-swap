use anchor_lang::prelude::*;

pub const DISCOUNT_CONFIG_SEED: &str = "discount_config";

/// Holds the current owner of the factory
#[account]
#[derive(Default, Debug)]
pub struct DiscountConfig {
    /// Bump to identify PDA
    pub bump: u8,
    /// Discount value in percentage
    pub discount: u8,
}

impl DiscountConfig {
    pub const LEN: usize = 8 + 1 + 1;
    /// Returns discount in percentage u128
    pub fn get_discount<'info>(acc: &UncheckedAccount<'info>) -> Result<u128> {
        if acc.data_is_empty() {
            return Ok(0u128);
        };
        let discount_data = acc.data.borrow();
        if discount_data.len() != DiscountConfig::LEN {
            msg!("Account data length is invalid. Returning default discount: 0");
            return Ok(0u128);
        }
        // return Ok(discount_data[9] as u128); // works OK
        // need to skip discriminator 8 bytes
        match DiscountConfig::try_from_slice(&discount_data.get(8..).unwrap()) {
            Ok(config) => Ok(config.discount as u128),
            Err(err) => {
                msg!("Failed to parse account data into DiscountConfig: {}. Returning default discount: 0", err);
                Ok(0u128)
            },
        }
    }
}