use anyhow::Result;
use rust_decimal::prelude::FromPrimitive;
use std::{sync::Arc, time::Duration};
use tokio::time::{interval, timeout};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::{
    aptos_client::AptosClient,
    config::SettlementConfig,
    database::Database,
    models::{SettlementBatch, SettlementStatus, Trade},
};

pub struct SettlementService {
    aptos_client: Arc<tokio::sync::Mutex<Arc<AptosClient>>>,
    database: Arc<Database>,
    config: SettlementConfig,
}

impl SettlementService {
    pub async fn new(
        aptos_client: Arc<AptosClient>,
        database: Arc<Database>,
        config: SettlementConfig,
    ) -> Result<Self> {
        Ok(Self {
            aptos_client: Arc::new(tokio::sync::Mutex::new(aptos_client)),
            database,
            config,
        })
    }

    pub async fn start_settlement_loop(&self) -> Result<()> {
        info!("Starting settlement service loop");
        let mut interval = interval(Duration::from_secs(self.config.batch_timeout_secs));

        loop {
            interval.tick().await;

            if let Err(e) = self.process_settlement_batch().await {
                error!("Settlement batch processing error: {}", e);
                // Continue running despite errors
            }
        }
    }

    async fn process_settlement_batch(&self) -> Result<()> {
        // Get pending trades
        let pending_trades = self.database.get_pending_trades().await?;
        
        if pending_trades.is_empty() {
            debug!("No pending trades for settlement");
            return Ok(());
        }

        // Group trades by market and create settlement batches
        let mut batches = self.create_settlement_batches(pending_trades).await?;

        for batch in &mut batches {
            if let Err(e) = self.settle_batch(batch).await {
                error!("Failed to settle batch {}: {}", batch.id, e);
                // Mark batch as failed
                batch.status = SettlementStatus::Failed;
                self.database.update_settlement_batch(batch).await?;
            }
        }

        Ok(())
    }

    async fn create_settlement_batches(&self, trades: Vec<Trade>) -> Result<Vec<SettlementBatch>> {
        let mut batches = Vec::new();
        let mut current_batch_trades = Vec::new();
        let mut current_market_id: Option<u64> = None;

        for trade in trades {
            // Group by market and batch size
            if current_market_id != Some(trade.market_id) 
                || current_batch_trades.len() >= self.config.batch_size {
                
                if !current_batch_trades.is_empty() {
                    batches.push(self.create_batch_from_trades(current_batch_trades).await?);
                    current_batch_trades = Vec::new();
                }
                current_market_id = Some(trade.market_id);
            }

            current_batch_trades.push(trade);
        }

        // Add remaining trades
        if !current_batch_trades.is_empty() {
            batches.push(self.create_batch_from_trades(current_batch_trades).await?);
        }

        Ok(batches)
    }

    async fn create_batch_from_trades(&self, trades: Vec<Trade>) -> Result<SettlementBatch> {
        if trades.is_empty() {
            return Err(anyhow::anyhow!("Cannot create batch from empty trades"));
        }

        let market_id = trades[0].market_id;
        
        // Calculate price bounds with slippage protection
        let prices: Vec<_> = trades.iter().map(|t| t.price).collect();
        let min_price = prices.iter().min().unwrap().clone();
        let max_price = prices.iter().max().unwrap().clone();
        
        let slippage = FromPrimitive::from_f64(self.config.max_price_slippage)
            .unwrap_or(rust_decimal::Decimal::new(5, 2)); // 5%
        
        let price_range = max_price - min_price;
        let adjusted_min = min_price - (price_range * slippage);
        let adjusted_max = max_price + (price_range * slippage);

        let batch = SettlementBatch {
            id: Uuid::new_v4(),
            trades,
            oracle_timestamp: chrono::Utc::now().timestamp() as u64,
            min_price: adjusted_min.max(rust_decimal::Decimal::ZERO),
            max_price: adjusted_max,
            expiry_timestamp: (chrono::Utc::now() + chrono::Duration::seconds(300)).timestamp() as u64, // 5 min expiry
            status: SettlementStatus::Pending,
            transaction_hash: None,
            created_at: chrono::Utc::now(),
        };

        // Save batch to database
        self.database.insert_settlement_batch(&batch).await?;
        info!("Created settlement batch {} with {} trades for market {}", 
            batch.id, batch.trades.len(), market_id);

        Ok(batch)
    }

    async fn settle_batch(&self, batch: &mut SettlementBatch) -> Result<()> {
        info!("Settling batch {} with {} trades", batch.id, batch.trades.len());

        // Mark trades as part of this batch
        for trade in &batch.trades {
            self.database.update_trade_settlement_batch(trade.id, batch.id).await?;
        }

        // Submit to blockchain with timeout
        let settlement_future = async {
            let client = self.aptos_client.lock().await;
            client.submit_settlement_batch(batch).await
        };

        match timeout(Duration::from_secs(30), settlement_future).await {
            Ok(Ok(transaction_hash)) => {
                batch.transaction_hash = Some(transaction_hash.clone());
                batch.status = SettlementStatus::Confirmed;
                self.database.update_settlement_batch(batch).await?;
                info!("Settlement batch {} confirmed with tx: {}", batch.id, transaction_hash);
                Ok(())
            }
            Ok(Err(e)) => {
                warn!("Settlement batch {} failed: {}", batch.id, e);
                batch.status = SettlementStatus::Failed;
                self.database.update_settlement_batch(batch).await?;
                Err(e)
            }
            Err(_) => {
                warn!("Settlement batch {} timed out", batch.id);
                batch.status = SettlementStatus::Failed;
                self.database.update_settlement_batch(batch).await?;
                Err(anyhow::anyhow!("Settlement timeout"))
            }
        }
    }
}
