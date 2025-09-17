use anyhow::{Context, Result};
use aptos_sdk::{
    crypto::{ed25519::Ed25519PrivateKey, PrivateKey, Uniform},
    rest_client::{Client, FaucetClient, PendingTransaction},
    transaction_builder::TransactionBuilder,
    types::{
        account_address::AccountAddress,
        chain_id::ChainId,
        transaction::{EntryFunction, TransactionPayload},
        LocalAccount,
    },
};
use rust_decimal::Decimal;
use std::str::FromStr;
use tracing::{debug, error, info};

use crate::{
    config::AptosConfig,
    models::{SettlementBatch, Trade},
};

pub struct AptosClient {
    client: Client,
    admin_account: LocalAccount,
    contract_address: AccountAddress,
    chain_id: ChainId,
}

impl AptosClient {
    pub async fn new(config: &AptosConfig) -> Result<Self> {
        let client = Client::new(config.node_url.parse()?);
        
        // Load admin private key
        let private_key = Ed25519PrivateKey::from_encoded_string(&config.admin_private_key)
            .context("Failed to parse admin private key")?;
        
        let admin_account = LocalAccount::new(
            AccountAddress::from_str(&config.admin_address)?,
            private_key,
            0, // sequence number will be fetched
        );

        let contract_address = AccountAddress::from_str(&config.contract_address)?;
        let chain_id = ChainId::new(config.chain_id);

        let mut aptos_client = Self {
            client,
            admin_account,
            contract_address,
            chain_id,
        };

        // Sync account sequence number
        aptos_client.sync_admin_account().await?;
        info!("Aptos client initialized for admin: {}", aptos_client.admin_account.address());

        Ok(aptos_client)
    }

    async fn sync_admin_account(&mut self) -> Result<()> {
        let account_response = self
            .client
            .get_account(self.admin_account.address())
            .await?;

        let sequence_number = account_response.inner().sequence_number;
        *self.admin_account.sequence_number_mut() = sequence_number;
        debug!("Synced admin account sequence number: {}", sequence_number);

        Ok(())
    }

    pub async fn submit_settlement_batch(
        &mut self,
        batch: &SettlementBatch,
    ) -> Result<String> {
        info!("Submitting settlement batch: {} trades", batch.trades.len());

        // Convert trades to BatchFill structs
        let batch_fills = batch.trades.iter().map(|trade| {
            self.trade_to_batch_fill(trade)
        }).collect::<Result<Vec<_>>>()?;

        // Create settlement batch payload
        let settlement_batch = self.create_settlement_batch_payload(
            batch_fills,
            batch.oracle_timestamp,
            batch.min_price,
            batch.max_price,
            batch.expiry_timestamp,
        );

        // Create transaction
        let payload = TransactionPayload::EntryFunction(EntryFunction::new(
            self.contract_address.into(),
            "perp_engine".parse()?,
            "apply_batch".parse()?,
            vec![], // no type arguments
            vec![
                bcs::to_bytes(&settlement_batch)?,
                bcs::to_bytes(&self.admin_account.address())?, // events_addr
            ],
        ));

        let transaction = TransactionBuilder::new(payload)
            .sender(self.admin_account.address())
            .sequence_number(self.admin_account.sequence_number())
            .max_gas_amount(100_000)
            .gas_unit_price(100)
            .expiration_timestamp_secs(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)?
                    .as_secs() + 30
            )
            .chain_id(self.chain_id)
            .build();

        // Sign and submit transaction
        let signed_txn = self.admin_account.sign_with_transaction_builder(transaction);
        let pending_txn = self.client.submit(&signed_txn).await?;

        let txn_hash = pending_txn.hash.to_string();
        info!("Settlement transaction submitted: {}", txn_hash);

        // Wait for transaction confirmation
        match self.wait_for_transaction(&pending_txn).await {
            Ok(_) => {
                info!("Settlement transaction confirmed: {}", txn_hash);
                Ok(txn_hash)
            }
            Err(e) => {
                error!("Settlement transaction failed: {} - {}", txn_hash, e);
                Err(e)
            }
        }
    }

    async fn wait_for_transaction(&self, pending_txn: &PendingTransaction) -> Result<()> {
        let start_time = std::time::Instant::now();
        const TIMEOUT_SECS: u64 = 30;

        loop {
            if start_time.elapsed().as_secs() > TIMEOUT_SECS {
                return Err(anyhow::anyhow!("Transaction confirmation timeout"));
            }

            match self.client.wait_for_transaction(pending_txn).await {
                Ok(response) => {
                    if response.inner().success {
                        return Ok(());
                    } else {
                        return Err(anyhow::anyhow!(
                            "Transaction failed: {:?}", 
                            response.inner().vm_status
                        ));
                    }
                }
                Err(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
        }
    }

    fn trade_to_batch_fill(&self, trade: &Trade) -> Result<BatchFillData> {
        Ok(BatchFillData {
            taker: AccountAddress::from_str(&trade.taker_address)?,
            maker: AccountAddress::from_str(&trade.maker_address)?,
            market_id: trade.market_id,
            size: self.decimal_to_u128(trade.size)?,
            price_x: self.decimal_to_u128(trade.price * Decimal::from(100_000_000))?, // Convert to 1e8 scale
            fee_bps: 10, // 0.1% fee
            ts: trade.created_at.timestamp() as u64,
        })
    }

    fn create_settlement_batch_payload(
        &self,
        fills: Vec<BatchFillData>,
        oracle_ts: u64,
        min_price: Decimal,
        max_price: Decimal,
        expiry: u64,
    ) -> SettlementBatchData {
        SettlementBatchData {
            fills,
            oracle_ts,
            min_px: self.decimal_to_u128(min_price * Decimal::from(100_000_000)).unwrap_or(0),
            max_px: self.decimal_to_u128(max_price * Decimal::from(100_000_000)).unwrap_or(u128::MAX),
            expiry,
        }
    }

    fn decimal_to_u128(&self, decimal: Decimal) -> Result<u128> {
        decimal
            .to_string()
            .parse()
            .context("Failed to convert decimal to u128")
    }

    pub async fn get_account_balance(&self, address: &str) -> Result<u64> {
        let account = AccountAddress::from_str(address)?;
        let resource = self
            .client
            .get_account_resource(account, "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>")
            .await?;

        // Parse balance from resource data
        if let Some(data) = resource.inner().data.as_object() {
            if let Some(coin) = data.get("coin") {
                if let Some(value) = coin.get("value") {
                    if let Some(balance_str) = value.as_str() {
                        return balance_str.parse().context("Failed to parse balance");
                    }
                }
            }
        }

        Ok(0)
    }
}

#[derive(Debug, Clone)]
struct BatchFillData {
    taker: AccountAddress,
    maker: AccountAddress,
    market_id: u64,
    size: u128,
    price_x: u128,
    fee_bps: u64,
    ts: u64,
}

#[derive(Debug, Clone)]
struct SettlementBatchData {
    fills: Vec<BatchFillData>,
    oracle_ts: u64,
    min_px: u128,
    max_px: u128,
    expiry: u64,
}
