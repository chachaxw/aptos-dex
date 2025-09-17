use anyhow::Result;
use rust_decimal::Decimal;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::broadcast;
use tracing::{debug, info};
use uuid::Uuid;

use crate::{
    database::Database,
    models::{Order, OrderSide, OrderStatus, OrderType, Trade},
};

pub struct MatchingEngine {
    order_books: HashMap<u64, OrderBook>,
    database: Arc<Database>,
    trade_sender: broadcast::Sender<Trade>,
}

pub struct OrderBook {
    pub market_id: u64,
    bids: Vec<Order>, // Buy orders, sorted by price descending
    asks: Vec<Order>, // Sell orders, sorted by price ascending
}

impl MatchingEngine {
    pub async fn new(database: Arc<Database>) -> Result<Self> {
        let (trade_sender, _) = broadcast::channel(1000);
        
        let mut engine = Self {
            order_books: HashMap::new(),
            database,
            trade_sender,
        };

        // Load existing orders from database
        engine.load_pending_orders().await?;
        
        Ok(engine)
    }

    pub fn get_trade_receiver(&self) -> broadcast::Receiver<Trade> {
        self.trade_sender.subscribe()
    }

    async fn load_pending_orders(&mut self) -> Result<()> {
        let orders = self.database.get_pending_orders().await?;
        info!("Loading {} pending orders", orders.len());

        for order in orders {
            let order_book = self.get_or_create_order_book(order.market_id);
            order_book.add_order(order);
        }

        Ok(())
    }

    pub async fn submit_order(&mut self, mut order: Order) -> Result<Vec<Trade>> {
        info!("Submitting order: {} {} {} @ {}", 
            order.side, order.size, order.market_id, 
            order.price.map(|p| p.to_string()).unwrap_or("MARKET".to_string()));

        // Save order to database
        self.database.insert_order(&order).await?;

        let order_book = self.get_or_create_order_book(order.market_id);
        
        // Try to match the order
        let trades = match order.order_type {
            OrderType::Market => self.match_market_order(order_book, &mut order).await?,
            OrderType::Limit => self.match_limit_order(order_book, &mut order).await?,
        };

        // Update order status
        if order.filled_size >= order.size {
            order.status = OrderStatus::Filled;
        } else if order.filled_size > Decimal::ZERO {
            order.status = OrderStatus::PartiallyFilled;
        }

        self.database.update_order(&order).await?;

        // Add remaining quantity to order book if not fully filled and it's a limit order
        if order.order_type == OrderType::Limit && order.status != OrderStatus::Filled {
            order_book.add_order(order);
        }

        // Broadcast trades
        for trade in &trades {
            let _ = self.trade_sender.send(trade.clone());
        }

        Ok(trades)
    }

    pub async fn cancel_order(&mut self, order_id: Uuid) -> Result<bool> {
        // Update in database
        let updated = self.database.cancel_order(order_id).await?;
        
        if updated {
            // Remove from order books
            for order_book in self.order_books.values_mut() {
                order_book.remove_order(order_id);
            }
            info!("Cancelled order: {}", order_id);
        }

        Ok(updated)
    }

    async fn match_market_order(
        &self,
        order_book: &mut OrderBook,
        order: &mut Order,
    ) -> Result<Vec<Trade>> {
        let mut trades = Vec::new();
        let opposing_orders = match order.side {
            OrderSide::Buy => &mut order_book.asks,
            OrderSide::Sell => &mut order_book.bids,
        };

        let mut remaining_size = order.size;
        let mut total_cost = Decimal::ZERO;

        while remaining_size > Decimal::ZERO && !opposing_orders.is_empty() {
            let maker_order = &mut opposing_orders[0];
            let available_size = maker_order.size - maker_order.filled_size;
            let fill_size = remaining_size.min(available_size);
            let fill_price = maker_order.price.unwrap(); // Limit orders always have price

            // Create trade
            let trade = Trade {
                id: Uuid::new_v4(),
                market_id: order.market_id,
                taker_order_id: order.id,
                maker_order_id: maker_order.id,
                taker_address: order.user_address.clone(),
                maker_address: maker_order.user_address.clone(),
                size: fill_size,
                price: fill_price,
                side: order.side.clone(),
                created_at: chrono::Utc::now(),
                settlement_batch_id: None,
            };

            // Update order filled amounts
            order.filled_size += fill_size;
            maker_order.filled_size += fill_size;
            remaining_size -= fill_size;
            total_cost += fill_size * fill_price;

            // Save trade to database
            self.database.insert_trade(&trade).await?;
            trades.push(trade);

            // Update maker order status
            if maker_order.filled_size >= maker_order.size {
                maker_order.status = OrderStatus::Filled;
                self.database.update_order(maker_order).await?;
                opposing_orders.remove(0);
            } else {
                maker_order.status = OrderStatus::PartiallyFilled;
                self.database.update_order(maker_order).await?;
            }
        }

        debug!("Market order matched {} trades, filled {}/{}", 
            trades.len(), order.filled_size, order.size);

        Ok(trades)
    }

    async fn match_limit_order(
        &self,
        order_book: &mut OrderBook,
        order: &mut Order,
    ) -> Result<Vec<Trade>> {
        let mut trades = Vec::new();
        let order_price = order.price.unwrap(); // Limit orders always have price

        let opposing_orders = match order.side {
            OrderSide::Buy => &mut order_book.asks,
            OrderSide::Sell => &mut order_book.bids,
        };

        let mut remaining_size = order.size;

        // Match against opposing orders
        let mut i = 0;
        while i < opposing_orders.len() && remaining_size > Decimal::ZERO {
            let maker_order = &mut opposing_orders[i];
            let maker_price = maker_order.price.unwrap();

            // Check if prices cross
            let can_match = match order.side {
                OrderSide::Buy => order_price >= maker_price,
                OrderSide::Sell => order_price <= maker_price,
            };

            if !can_match {
                break;
            }

            let available_size = maker_order.size - maker_order.filled_size;
            let fill_size = remaining_size.min(available_size);

            // Create trade at maker's price (price priority)
            let trade = Trade {
                id: Uuid::new_v4(),
                market_id: order.market_id,
                taker_order_id: order.id,
                maker_order_id: maker_order.id,
                taker_address: order.user_address.clone(),
                maker_address: maker_order.user_address.clone(),
                size: fill_size,
                price: maker_price,
                side: order.side.clone(),
                created_at: chrono::Utc::now(),
                settlement_batch_id: None,
            };

            // Update order filled amounts
            order.filled_size += fill_size;
            maker_order.filled_size += fill_size;
            remaining_size -= fill_size;

            // Save trade to database
            self.database.insert_trade(&trade).await?;
            trades.push(trade);

            // Update maker order status
            if maker_order.filled_size >= maker_order.size {
                maker_order.status = OrderStatus::Filled;
                self.database.update_order(maker_order).await?;
                opposing_orders.remove(i);
            } else {
                maker_order.status = OrderStatus::PartiallyFilled;
                self.database.update_order(maker_order).await?;
                i += 1;
            }
        }

        debug!("Limit order matched {} trades, filled {}/{}", 
            trades.len(), order.filled_size, order.size);

        Ok(trades)
    }

    pub fn get_order_book(&self, market_id: u64) -> Option<&OrderBook> {
        self.order_books.get(&market_id)
    }

    fn get_or_create_order_book(&mut self, market_id: u64) -> &mut OrderBook {
        self.order_books
            .entry(market_id)
            .or_insert_with(|| OrderBook::new(market_id))
    }
}

impl OrderBook {
    fn new(market_id: u64) -> Self {
        Self {
            market_id,
            bids: Vec::new(),
            asks: Vec::new(),
        }
    }

    fn add_order(&mut self, order: Order) {
        match order.side {
            OrderSide::Buy => {
                self.bids.push(order);
                // Sort by price descending (highest price first)
                self.bids.sort_by(|a, b| {
                    b.price.unwrap_or(Decimal::ZERO)
                        .cmp(&a.price.unwrap_or(Decimal::ZERO))
                        .then_with(|| a.created_at.cmp(&b.created_at))
                });
            }
            OrderSide::Sell => {
                self.asks.push(order);
                // Sort by price ascending (lowest price first)
                self.asks.sort_by(|a, b| {
                    a.price.unwrap_or(Decimal::MAX)
                        .cmp(&b.price.unwrap_or(Decimal::MAX))
                        .then_with(|| a.created_at.cmp(&b.created_at))
                });
            }
        }
    }

    fn remove_order(&mut self, order_id: Uuid) -> bool {
        let bid_removed = self.bids.retain(|o| o.id != order_id);
        let ask_removed = self.asks.retain(|o| o.id != order_id);
        bid_removed || ask_removed
    }

    pub fn get_bids(&self) -> &[Order] {
        &self.bids
    }

    pub fn get_asks(&self) -> &[Order] {
        &self.asks
    }
}
