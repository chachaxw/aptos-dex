use anyhow::Result;
use rust_decimal::Decimal;
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::time::Duration;
use tracing::{debug, info};
use uuid::Uuid;

use crate::models::{Order, SettlementBatch, Trade};

pub struct Database {
    pool: PgPool,
}

impl Database {
    // Conversion functions between Decimal and String
    fn decimal_to_string(decimal: &Decimal) -> String {
        decimal.to_string()
    }

    fn string_to_decimal(s: &str) -> Decimal {
        s.parse().unwrap_or_default()
    }

    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .acquire_timeout(Duration::from_secs(30))
            .connect(database_url)
            .await?;

        info!("Connected to PostgreSQL database");
        
        let db = Self { pool };
        db.run_migrations().await?;
        
        Ok(db)
    }

    async fn run_migrations(&self) -> Result<()> {
        info!("Running database migrations");
        
        // Create custom types first with proper error handling
        self.create_type_if_not_exists("order_side", "('buy', 'sell')").await?;
        self.create_type_if_not_exists("order_type", "('market', 'limit')").await?;
        self.create_type_if_not_exists("order_status", "('pending', 'partially_filled', 'filled', 'cancelled', 'expired')").await?;
        self.create_type_if_not_exists("settlement_status", "('pending', 'submitted', 'confirmed', 'failed')").await?;
        
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS orders (
                id UUID PRIMARY KEY,
                user_address TEXT NOT NULL,
                market_id BIGINT NOT NULL,
                side order_side NOT NULL,
                order_type order_type NOT NULL,
                size DECIMAL NOT NULL,
                price DECIMAL,
                filled_size DECIMAL NOT NULL DEFAULT 0,
                status order_status NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ
            );
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS trades (
                id UUID PRIMARY KEY,
                market_id BIGINT NOT NULL,
                taker_order_id UUID NOT NULL,
                maker_order_id UUID NOT NULL,
                taker_address TEXT NOT NULL,
                maker_address TEXT NOT NULL,
                size DECIMAL NOT NULL,
                price DECIMAL NOT NULL,
                side order_side NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                settlement_batch_id UUID
            );
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS settlement_batches (
                id UUID PRIMARY KEY,
                oracle_timestamp BIGINT NOT NULL,
                min_price DECIMAL NOT NULL,
                max_price DECIMAL NOT NULL,
                expiry_timestamp BIGINT NOT NULL,
                status settlement_status NOT NULL DEFAULT 'pending',
                transaction_hash TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Create indexes
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_orders_market_status ON orders(market_id, status)")
            .execute(&self.pool)
            .await?;
            
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_trades_settlement_batch ON trades(settlement_batch_id)")
            .execute(&self.pool)
            .await?;

        debug!("Database migrations completed");
        Ok(())
    }
    
    async fn create_type_if_not_exists(&self, type_name: &str, values: &str) -> Result<()> {
        let check_query = format!("SELECT 1 FROM pg_type WHERE typname = '{}'", type_name);
        let exists = sqlx::query(&check_query)
            .fetch_optional(&self.pool)
            .await?;
            
        if exists.is_none() {
            let create_query = format!("CREATE TYPE {} AS ENUM {}", type_name, values);
            sqlx::query(&create_query)
                .execute(&self.pool)
                .await?;
            debug!("Created type: {}", type_name);
        } else {
            debug!("Type {} already exists", type_name);
        }
        
        Ok(())
    }

    pub async fn insert_order(&self, order: &Order) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO orders (
                id, user_address, market_id, side, order_type, 
                size, price, filled_size, status, created_at, 
                updated_at, expires_at
            ) VALUES ($1, $2, $3, $4, $5, CAST($6 AS numeric), CAST($7 AS numeric), CAST($8 AS numeric), $9, $10, $11, $12)
            "#,
        )
        .bind(order.id)
        .bind(&order.user_address)
        .bind(order.market_id as i64)
        .bind(&order.side)
        .bind(&order.order_type)
        .bind(Self::decimal_to_string(&order.size))
        .bind(order.price.map(|p| Self::decimal_to_string(&p)))
        .bind(Self::decimal_to_string(&order.filled_size))
        .bind(&order.status)
        .bind(order.created_at)
        .bind(order.updated_at)
        .bind(order.expires_at)
        .execute(&self.pool)
        .await?;

        debug!("Inserted order: {}", order.id);
        Ok(())
    }

    pub async fn update_order(&self, order: &Order) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE orders 
            SET filled_size = CAST($1 AS numeric), status = $2, updated_at = $3 
            WHERE id = $4
            "#,
        )
        .bind(Self::decimal_to_string(&order.filled_size))
        .bind(&order.status)
        .bind(chrono::Utc::now())
        .bind(order.id)
        .execute(&self.pool)
        .await?;

        debug!("Updated order: {}", order.id);
        Ok(())
    }

    pub async fn cancel_order(&self, order_id: Uuid) -> Result<bool> {
        let result = sqlx::query(
            r#"
            UPDATE orders 
            SET status = 'cancelled', updated_at = NOW() 
            WHERE id = $1 AND status IN ('pending', 'partially_filled')
            "#,
        )
        .bind(order_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn get_pending_orders(&self) -> Result<Vec<Order>> {
        let rows = sqlx::query(
            r#"
            SELECT id, user_address, market_id, side, order_type, 
                   CAST(size AS TEXT) as size, CAST(price AS TEXT) as price, 
                   CAST(filled_size AS TEXT) as filled_size, status, created_at, 
                   updated_at, expires_at
            FROM orders 
            WHERE status IN ('pending', 'partially_filled')
            ORDER BY created_at ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let orders = rows.into_iter().map(|row| Order {
            id: row.get("id"),
            user_address: row.get("user_address"),
            market_id: row.get::<i64, _>("market_id") as u64,
            side: row.get("side"),
            order_type: row.get("order_type"),
            size: Self::string_to_decimal(row.get::<&str, _>("size")),
            price: row.get::<Option<&str>, _>("price").map(|p| Self::string_to_decimal(p)),
            filled_size: Self::string_to_decimal(row.get::<&str, _>("filled_size")),
            status: row.get("status"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            expires_at: row.get("expires_at"),
        }).collect();

        Ok(orders)
    }

    pub async fn insert_trade(&self, trade: &Trade) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO trades (
                id, market_id, taker_order_id, maker_order_id,
                taker_address, maker_address, size, price, 
                side, created_at, settlement_batch_id
            ) VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS numeric), CAST($8 AS numeric), $9, $10, $11)
            "#,
        )
        .bind(trade.id)
        .bind(trade.market_id as i64)
        .bind(trade.taker_order_id)
        .bind(trade.maker_order_id)
        .bind(&trade.taker_address)
        .bind(&trade.maker_address)
        .bind(Self::decimal_to_string(&trade.size))
        .bind(Self::decimal_to_string(&trade.price))
        .bind(&trade.side)
        .bind(trade.created_at)
        .bind(trade.settlement_batch_id)
        .execute(&self.pool)
        .await?;

        debug!("Inserted trade: {}", trade.id);
        Ok(())
    }

    pub async fn get_pending_trades(&self) -> Result<Vec<Trade>> {
        let rows = sqlx::query(
            r#"
            SELECT id, market_id, taker_order_id, maker_order_id,
                   taker_address, maker_address, CAST(size AS TEXT) as size, 
                   CAST(price AS TEXT) as price, side, created_at, settlement_batch_id
            FROM trades 
            WHERE settlement_batch_id IS NULL
            ORDER BY created_at ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let trades = rows.into_iter().map(|row| Trade {
            id: row.get("id"),
            market_id: row.get::<i64, _>("market_id") as u64,
            taker_order_id: row.get("taker_order_id"),
            maker_order_id: row.get("maker_order_id"),
            taker_address: row.get("taker_address"),
            maker_address: row.get("maker_address"),
            size: Self::string_to_decimal(row.get::<&str, _>("size")),
            price: Self::string_to_decimal(row.get::<&str, _>("price")),
            side: row.get("side"),
            created_at: row.get("created_at"),
            settlement_batch_id: row.get("settlement_batch_id"),
        }).collect();

        Ok(trades)
    }

    pub async fn insert_settlement_batch(&self, batch: &SettlementBatch) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO settlement_batches (
                id, oracle_timestamp, min_price, max_price,
                expiry_timestamp, status, transaction_hash, created_at
            ) VALUES ($1, $2, CAST($3 AS numeric), CAST($4 AS numeric), $5, $6, $7, $8)
            "#,
        )
        .bind(batch.id)
        .bind(batch.oracle_timestamp as i64)
        .bind(Self::decimal_to_string(&batch.min_price))
        .bind(Self::decimal_to_string(&batch.max_price))
        .bind(batch.expiry_timestamp as i64)
        .bind(&batch.status)
        .bind(&batch.transaction_hash)
        .bind(batch.created_at)
        .execute(&self.pool)
        .await?;

        debug!("Inserted settlement batch: {}", batch.id);
        Ok(())
    }

    pub async fn update_settlement_batch(&self, batch: &SettlementBatch) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE settlement_batches 
            SET status = $1, transaction_hash = $2
            WHERE id = $3
            "#,
        )
        .bind(&batch.status)
        .bind(&batch.transaction_hash)
        .bind(batch.id)
        .execute(&self.pool)
        .await?;

        debug!("Updated settlement batch: {}", batch.id);
        Ok(())
    }

    pub async fn update_trade_settlement_batch(&self, trade_id: Uuid, batch_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE trades 
            SET settlement_batch_id = $1 
            WHERE id = $2
            "#,
        )
        .bind(batch_id)
        .bind(trade_id)
        .execute(&self.pool)
        .await?;

        debug!("Updated trade {} with settlement batch {}", trade_id, batch_id);
        Ok(())
    }

    pub async fn get_order(&self, order_id: Uuid) -> Result<Order> {
        let row = sqlx::query(
            r#"
            SELECT id, user_address, market_id, side, order_type, 
                   CAST(size AS TEXT) as size, CAST(price AS TEXT) as price, 
                   CAST(filled_size AS TEXT) as filled_size, status, created_at, 
                   updated_at, expires_at
            FROM orders 
            WHERE id = $1
            "#,
        )
        .bind(order_id)
        .fetch_one(&self.pool)
        .await?;

        let order = Order {
            id: row.get("id"),
            user_address: row.get("user_address"),
            market_id: row.get::<i64, _>("market_id") as u64,
            side: row.get("side"),
            order_type: row.get("order_type"),
            size: Self::string_to_decimal(row.get::<&str, _>("size")),
            price: row.get::<Option<&str>, _>("price").map(|p| Self::string_to_decimal(p)),
            filled_size: Self::string_to_decimal(row.get::<&str, _>("filled_size")),
            status: row.get("status"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            expires_at: row.get("expires_at"),
        };

        debug!("Retrieved order: {}", order.id);
        Ok(order)
    }

    pub async fn get_orders_by_user(
        &self, 
        user_address: &str, 
        status_filter: Option<&str>,
        limit: Option<i64>,
        offset: Option<i64>
    ) -> Result<Vec<Order>> {
        let mut query = String::from(
            r#"
            SELECT id, user_address, market_id, side, order_type, 
                   CAST(size AS TEXT) as size, CAST(price AS TEXT) as price, 
                   CAST(filled_size AS TEXT) as filled_size, status, created_at, 
                   updated_at, expires_at
            FROM orders 
            WHERE user_address = $1
            "#
        );
        
        let mut param_count = 1;
        
        if let Some(status) = status_filter {
            query.push_str(&format!(" AND status = ${}", param_count + 1));
            param_count += 1;
        }
        
        query.push_str(" ORDER BY created_at DESC");
        
        if let Some(limit_val) = limit {
            query.push_str(&format!(" LIMIT ${}", param_count + 1));
            param_count += 1;
        }
        
        if let Some(offset_val) = offset {
            query.push_str(&format!(" OFFSET ${}", param_count + 1));
        }

        let mut sqlx_query = sqlx::query(&query)
            .bind(user_address);
            
        if let Some(status) = status_filter {
            sqlx_query = sqlx_query.bind(status);
        }
        
        if let Some(limit_val) = limit {
            sqlx_query = sqlx_query.bind(limit_val);
        }
        
        if let Some(offset_val) = offset {
            sqlx_query = sqlx_query.bind(offset_val);
        }

        let rows = sqlx_query.fetch_all(&self.pool).await?;

        let orders: Vec<Order> = rows.into_iter().map(|row| Order {
            id: row.get("id"),
            user_address: row.get("user_address"),
            market_id: row.get::<i64, _>("market_id") as u64,
            side: row.get("side"),
            order_type: row.get("order_type"),
            size: Self::string_to_decimal(row.get::<&str, _>("size")),
            price: row.get::<Option<&str>, _>("price").map(|p| Self::string_to_decimal(p)),
            filled_size: Self::string_to_decimal(row.get::<&str, _>("filled_size")),
            status: row.get("status"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            expires_at: row.get("expires_at"),
        }).collect();

        debug!("Retrieved {} orders for user {}", orders.len(), user_address);
        Ok(orders)
    }

    pub async fn get_trades_by_user(
        &self, 
        user_address: &str,
        start_time: Option<chrono::DateTime<chrono::Utc>>,
        end_time: Option<chrono::DateTime<chrono::Utc>>,
        limit: Option<i64>,
        offset: Option<i64>
    ) -> Result<Vec<Trade>> {
        let mut query = String::from(
            r#"
            SELECT id, market_id, taker_order_id, maker_order_id,
                   taker_address, maker_address, CAST(size AS TEXT) as size, 
                   CAST(price AS TEXT) as price, side, created_at, settlement_batch_id
            FROM trades 
            WHERE (taker_address = $1 OR maker_address = $1)
            "#
        );
        
        let mut param_count = 1;
        
        if let Some(start) = start_time {
            query.push_str(&format!(" AND created_at >= ${}", param_count + 1));
            param_count += 1;
        }
        
        if let Some(end) = end_time {
            query.push_str(&format!(" AND created_at <= ${}", param_count + 1));
            param_count += 1;
        }
        
        query.push_str(" ORDER BY created_at DESC");
        
        if let Some(limit_val) = limit {
            query.push_str(&format!(" LIMIT ${}", param_count + 1));
            param_count += 1;
        }
        
        if let Some(offset_val) = offset {
            query.push_str(&format!(" OFFSET ${}", param_count + 1));
        }

        let mut sqlx_query = sqlx::query(&query)
            .bind(user_address);
            
        if let Some(start) = start_time {
            sqlx_query = sqlx_query.bind(start);
        }
        
        if let Some(end) = end_time {
            sqlx_query = sqlx_query.bind(end);
        }
        
        if let Some(limit_val) = limit {
            sqlx_query = sqlx_query.bind(limit_val);
        }
        
        if let Some(offset_val) = offset {
            sqlx_query = sqlx_query.bind(offset_val);
        }

        let rows = sqlx_query.fetch_all(&self.pool).await?;

        let trades: Vec<Trade> = rows.into_iter().map(|row| Trade {
            id: row.get("id"),
            market_id: row.get::<i64, _>("market_id") as u64,
            taker_order_id: row.get("taker_order_id"),
            maker_order_id: row.get("maker_order_id"),
            taker_address: row.get("taker_address"),
            maker_address: row.get("maker_address"),
            size: Self::string_to_decimal(row.get::<&str, _>("size")),
            price: Self::string_to_decimal(row.get::<&str, _>("price")),
            side: row.get("side"),
            created_at: row.get("created_at"),
            settlement_batch_id: row.get("settlement_batch_id"),
        }).collect();

        debug!("Retrieved {} trades for user {}", trades.len(), user_address);
        Ok(trades)
    }
}
