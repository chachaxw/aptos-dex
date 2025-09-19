use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Order {
    pub id: Uuid,
    pub user_address: String,
    pub market_id: u64,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub size: Decimal,
    pub price: Option<Decimal>,
    pub filled_size: Decimal,
    pub status: OrderStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "order_side", rename_all = "lowercase")]
pub enum OrderSide {
    Buy,
    Sell,
}

impl fmt::Display for OrderSide {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrderSide::Buy => write!(f, "Buy"),
            OrderSide::Sell => write!(f, "Sell"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "order_type", rename_all = "lowercase")]
pub enum OrderType {
    Market,
    Limit,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "order_status", rename_all = "lowercase")]
pub enum OrderStatus {
    Pending,
    PartiallyFilled,
    Filled,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub market_id: u64,
    pub taker_order_id: Uuid,
    pub maker_order_id: Uuid,
    pub taker_address: String,
    pub maker_address: String,
    pub size: Decimal,
    pub price: Decimal,
    pub side: OrderSide,
    pub created_at: DateTime<Utc>,
    pub settlement_batch_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementBatch {
    pub id: Uuid,
    pub trades: Vec<Trade>,
    pub oracle_timestamp: u64,
    pub min_price: Decimal,
    pub max_price: Decimal,
    pub expiry_timestamp: u64,
    pub status: SettlementStatus,
    pub transaction_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "settlement_status", rename_all = "lowercase")]
pub enum SettlementStatus {
    Pending,
    Submitted,
    Confirmed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitOrderRequest {
    pub user_address: String,
    pub market_id: u64,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub size: String, // Decimal as string
    pub price: Option<String>, // Optional for market orders
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderResponse {
    pub order: Order,
    pub trades: Vec<Trade>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderBookLevel {
    pub price: Decimal,
    pub size: Decimal,
    pub order_count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderBook {
    pub market_id: u64,
    pub bids: Vec<OrderBookLevel>,
    pub asks: Vec<OrderBookLevel>,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MarketData {
    pub market_id: u64,
    pub last_price: Option<Decimal>,
    pub volume_24h: Decimal,
    pub price_change_24h: Option<Decimal>,
    pub high_24h: Option<Decimal>,
    pub low_24h: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DepositRequest {
    pub user_address: String,
    pub amount: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DepositResponse {
    pub transaction_hash: String,
    pub amount: u64,
    pub user_address: String,
}
