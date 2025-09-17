use anyhow::Result;
use redis::{Client, aio::ConnectionManager, AsyncCommands};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};
use uuid::Uuid;

use crate::models::{Order, OrderSide};

pub struct RedisClient {
    connection_manager: ConnectionManager,
}

impl RedisClient {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = Client::open(redis_url)?;
        let connection_manager = ConnectionManager::new(client).await?;
        
        info!("Connected to Redis");
        Ok(Self { connection_manager })
    }

    // Order Book Persistence
    pub async fn save_order_book(&mut self, market_id: u64, orders: &[Order]) -> Result<()> {
        let key = format!("orderbook:{}", market_id);
        let serialized = serde_json::to_string(orders)?;
        
        self.connection_manager
            .set_ex(&key, serialized, 3600) // 1 hour TTL
            .await?;
            
        debug!("Saved order book for market {} with {} orders", market_id, orders.len());
        Ok(())
    }

    pub async fn load_order_book(&mut self, market_id: u64) -> Result<Vec<Order>> {
        let key = format!("orderbook:{}", market_id);
        
        let result: Option<String> = self.connection_manager.get(&key).await?;
        match result {
            Some(serialized) => {
                let orders: Vec<Order> = serde_json::from_str(&serialized)?;
                debug!("Loaded {} orders for market {}", orders.len(), market_id);
                Ok(orders)
            }
            None => {
                debug!("No cached order book found for market {}", market_id);
                Ok(Vec::new())
            }
        }
    }

    // Order Cache
    pub async fn cache_order(&mut self, order: &Order) -> Result<()> {
        let key = format!("order:{}", order.id);
        let serialized = serde_json::to_string(order)?;
        
        self.connection_manager
            .set_ex(&key, serialized, 86400) // 24 hours TTL
            .await?;
            
        debug!("Cached order: {}", order.id);
        Ok(())
    }

    pub async fn get_cached_order(&mut self, order_id: Uuid) -> Result<Option<Order>> {
        let key = format!("order:{}", order_id);
        
        let result: Option<String> = self.connection_manager.get(&key).await?;
        match result {
            Some(serialized) => {
                let order: Order = serde_json::from_str(&serialized)?;
                Ok(Some(order))
            }
            None => Ok(None),
        }
    }

    pub async fn remove_cached_order(&mut self, order_id: Uuid) -> Result<()> {
        let key = format!("order:{}", order_id);
        self.connection_manager.del(&key).await?;
        debug!("Removed cached order: {}", order_id);
        Ok(())
    }

    // Market Statistics
    pub async fn update_market_stats(&mut self, market_id: u64, stats: &MarketStats) -> Result<()> {
        let key = format!("market_stats:{}", market_id);
        let serialized = serde_json::to_string(stats)?;
        
        self.connection_manager
            .set_ex(&key, serialized, 300) // 5 minutes TTL
            .await?;
            
        debug!("Updated market stats for market {}", market_id);
        Ok(())
    }

    pub async fn get_market_stats(&mut self, market_id: u64) -> Result<Option<MarketStats>> {
        let key = format!("market_stats:{}", market_id);
        
        let result: Option<String> = self.connection_manager.get(&key).await?;
        match result {
            Some(serialized) => {
                let stats: MarketStats = serde_json::from_str(&serialized)?;
                Ok(Some(stats))
            }
            None => Ok(None),
        }
    }

    // Trade History Cache
    pub async fn cache_recent_trades(&mut self, market_id: u64, trades: &[TradeSummary]) -> Result<()> {
        let key = format!("recent_trades:{}", market_id);
        let serialized = serde_json::to_string(trades)?;
        
        self.connection_manager
            .set_ex(&key, serialized, 3600) // 1 hour TTL
            .await?;
            
        debug!("Cached {} recent trades for market {}", trades.len(), market_id);
        Ok(())
    }

    pub async fn get_recent_trades(&mut self, market_id: u64) -> Result<Vec<TradeSummary>> {
        let key = format!("recent_trades:{}", market_id);
        
        let result: Option<String> = self.connection_manager.get(&key).await?;
        match result {
            Some(serialized) => {
                let trades: Vec<TradeSummary> = serde_json::from_str(&serialized)?;
                Ok(trades)
            }
            None => Ok(Vec::new()),
        }
    }

    // Health Check
    pub async fn ping(&mut self) -> Result<String> {
        // Simple health check by setting and getting a test key
        self.connection_manager.set("health_check", "pong").await?;
        let result: String = self.connection_manager.get("health_check").await?;
        self.connection_manager.del("health_check").await?;
        Ok(result)
    }

    // Clear all cache (for testing)
    pub async fn clear_all_cache(&mut self) -> Result<()> {
        let keys: Vec<String> = self.connection_manager.keys("orderbook:*").await?;
        if !keys.is_empty() {
            self.connection_manager.del(keys).await?;
        }
        
        let keys: Vec<String> = self.connection_manager.keys("order:*").await?;
        if !keys.is_empty() {
            self.connection_manager.del(keys).await?;
        }
        
        let keys: Vec<String> = self.connection_manager.keys("market_stats:*").await?;
        if !keys.is_empty() {
            self.connection_manager.del(keys).await?;
        }
        
        let keys: Vec<String> = self.connection_manager.keys("recent_trades:*").await?;
        if !keys.is_empty() {
            self.connection_manager.del(keys).await?;
        }
        
        info!("Cleared all cache");
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketStats {
    pub market_id: u64,
    pub total_orders: u64,
    pub total_volume: String, // Decimal as string
    pub last_price: Option<String>, // Decimal as string
    pub bid_count: u64,
    pub ask_count: u64,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeSummary {
    pub id: Uuid,
    pub market_id: u64,
    pub price: String, // Decimal as string
    pub size: String, // Decimal as string
    pub side: OrderSide,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}