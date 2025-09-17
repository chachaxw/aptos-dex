use anyhow::{Context, Result};
use aptos_crypto::ed25519::{Ed25519PrivateKey, Ed25519PublicKey};
use aptos_crypto::ValidCryptoMaterialStringExt;
use aptos_rust_sdk::client::builder::AptosClientBuilder;
use hex;
use aptos_rust_sdk::client::config::AptosNetwork;
use aptos_rust_sdk_types::api_types::{
    address::AccountAddress,
    chain_id::ChainId,
    module_id::ModuleId,
    transaction::{
        EntryFunction, GenerateSigningMessage, RawTransaction, SignedTransaction, TransactionPayload,
    },
    transaction_authenticator::TransactionAuthenticator,
};
use rust_decimal::Decimal;
use std::convert::TryFrom;
use std::str::FromStr;
use tracing::info;

use crate::{
    config::AptosConfig,
    models::SettlementBatch,
};

#[derive(Debug)]
pub struct AptosClient {
    client: aptos_rust_sdk::client::rest_api::AptosFullnodeClient,
    admin_private_key: Ed25519PrivateKey,
    admin_address: AccountAddress,
    contract_address: AccountAddress,
    chain_id: ChainId,
}

impl AptosClient {
    fn parse_private_key(key_str: &str) -> Result<Ed25519PrivateKey> {
        // Remove the "ed25519-priv-0x" prefix if present
        let hex_str = key_str
            .strip_prefix("ed25519-priv-0x")
            .unwrap_or(key_str);
        
        // Convert hex string to bytes
        let bytes = hex::decode(hex_str)
            .context("Failed to decode private key hex string")?;
        
        // Create Ed25519PrivateKey from bytes
        Ed25519PrivateKey::try_from(bytes.as_slice())
            .context("Failed to create Ed25519PrivateKey from bytes")
    }
    pub async fn new(config: &AptosConfig) -> Result<Self> {
        // Create client using the new SDK
        let network = match config.chain_id {
            1 => AptosNetwork::mainnet(),
            2 => AptosNetwork::testnet(),
            _ => AptosNetwork::testnet(), // Default to testnet
        };
        let client = AptosClientBuilder::new(network).build();
        
        // Load admin private key - parse from config format (ed25519-priv-0x...)
        let private_key = Self::parse_private_key(&config.admin_private_key)
            .context("Failed to parse admin private key")?;
        
        let admin_address = AccountAddress::from_str(&config.admin_address)?;
        let contract_address = AccountAddress::from_str(&config.contract_address)?;
        let chain_id = match config.chain_id {
            1 => ChainId::Mainnet,
            2 => ChainId::Testnet,
            3 => ChainId::Testing,
            id => ChainId::Other(id as u8),
        };

        let aptos_client = Self {
            client,
            admin_private_key: private_key,
            admin_address,
            contract_address,
            chain_id,
        };

        info!("Aptos client initialized for admin: {}", aptos_client.admin_address);

        Ok(aptos_client)
    }


    pub async fn submit_settlement_batch(
        &self,
        batch: &SettlementBatch,
    ) -> Result<String> {
        info!("Submitting settlement batch: {} trades", batch.trades.len());

        // Get current state for sequence number and timestamp
        let state = self.client.get_state().await?;
        
        // Get account resources to find sequence number
        let resources = self.client.get_account_resources(self.admin_address.to_string()).await?;
        let sequence_number = resources.into_inner()
            .iter()
            .find(|r| r.type_ == "0x1::account::Account")
            .and_then(|r| r.data.get("sequence_number"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        // Create transaction payload
        let payload = TransactionPayload::EntryFunction(EntryFunction::new(
            ModuleId::new(self.contract_address, "perp_engine".to_string()),
            "apply_batch".to_string(),
            vec![], // no type arguments
            vec![
                bcs::to_bytes(&self.create_settlement_batch_data(batch))?,
                bcs::to_bytes(&self.admin_address)?, // events_addr
            ],
        ));

        // Create raw transaction
        let raw_txn = RawTransaction::new(
            self.admin_address,
            sequence_number,
            payload,
            100_000, // max_gas_amount
            100,     // gas_unit_price
            state.timestamp_usecs / 1000 / 1000 + 30, // expiration_timestamp_secs
            self.chain_id,
        );

        // Sign transaction
        let message = raw_txn.generate_signing_message()?;
        let signature = self.admin_private_key.sign_message(&message);
        
        // Create signed transaction
        let signed_txn = SignedTransaction::new(
            raw_txn,
            TransactionAuthenticator::ed25519(
                Ed25519PublicKey::from(&self.admin_private_key),
                signature,
            ),
        );

        // Submit transaction
        let result = self.client.submit_transaction(signed_txn).await?;
        let response_data = result.into_inner();
        
        // Extract hash from the response JSON
        let txn_hash = response_data
            .get("hash")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        
        info!("Settlement transaction submitted: {}", txn_hash);
        Ok(txn_hash)
    }

    fn create_settlement_batch_data(&self, batch: &SettlementBatch) -> SettlementBatchData {
        SettlementBatchData {
            fills: batch.trades.iter().map(|trade| {
                BatchFillData {
                    taker: AccountAddress::from_str(&trade.taker_address).unwrap_or(AccountAddress::ZERO),
                    maker: AccountAddress::from_str(&trade.maker_address).unwrap_or(AccountAddress::ZERO),
                    market_id: trade.market_id,
                    size: self.decimal_to_u128(trade.size).unwrap_or(0),
                    price_x: self.decimal_to_u128(trade.price * Decimal::from(100_000_000)).unwrap_or(0),
                    fee_bps: 10, // 0.1% fee
                    ts: trade.created_at.timestamp() as u64,
                }
            }).collect(),
            oracle_ts: batch.oracle_timestamp,
            min_px: self.decimal_to_u128(batch.min_price * Decimal::from(100_000_000)).unwrap_or(0),
            max_px: self.decimal_to_u128(batch.max_price * Decimal::from(100_000_000)).unwrap_or(u128::MAX),
            expiry: batch.expiry_timestamp,
        }
    }

    fn decimal_to_u128(&self, decimal: Decimal) -> Result<u128> {
        decimal
            .to_string()
            .parse()
            .context("Failed to convert decimal to u128")
    }

    pub async fn get_account_balance(&self, address: &str) -> Result<u64> {
        let resources = self.client.get_account_resources(address.to_string()).await?;
        
        // Find the coin store resource
        for resource in resources.into_inner() {
            if resource.type_ == "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>" {
                if let Some(coin) = resource.data.get("coin") {
                    if let Some(value) = coin.get("value") {
                        if let Some(balance_str) = value.as_str() {
                            return balance_str.parse().context("Failed to parse balance");
                        }
                    }
                }
            }
        }

        Ok(0)
    }
}

#[derive(Debug, Clone, serde::Serialize)]
struct BatchFillData {
    taker: AccountAddress,
    maker: AccountAddress,
    market_id: u64,
    size: u128,
    price_x: u128,
    fee_bps: u64,
    ts: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
struct SettlementBatchData {
    fills: Vec<BatchFillData>,
    oracle_ts: u64,
    min_px: u128,
    max_px: u128,
    expiry: u64,
}
