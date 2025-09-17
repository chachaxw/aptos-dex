use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use rust_decimal::Decimal;
use std::str::FromStr;
use tracing::{error, info};
use uuid::Uuid;

use crate::{
    models::{
        Order, OrderBook, OrderBookLevel, OrderResponse, OrderStatus, OrderType,
        SubmitOrderRequest,
    },
    SharedState,
};

pub async fn submit_order(
    State(state): State<SharedState>,
    Json(req): Json<SubmitOrderRequest>,
) -> Result<Json<OrderResponse>, StatusCode> {
    info!("Received order submission: {} {} {}", 
        req.side, req.size, req.market_id);

    // Parse size
    let size = Decimal::from_str(&req.size)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Parse price if provided
    let price = match req.price {
        Some(p) => Some(Decimal::from_str(&p).map_err(|_| StatusCode::BAD_REQUEST)?),
        None => None,
    };

    // Validate market order doesn't have price
    if req.order_type == OrderType::Market && price.is_some() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Validate limit order has price
    if req.order_type == OrderType::Limit && price.is_none() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Create order
    let order = Order {
        id: Uuid::new_v4(),
        user_address: req.user_address,
        market_id: req.market_id,
        side: req.side,
        order_type: req.order_type,
        size,
        price,
        filled_size: Decimal::ZERO,
        status: OrderStatus::Pending,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        expires_at: req.expires_at,
    };

    // Submit order to matching engine
    match state.matching_engine.write().await.submit_order(order.clone()).await {
        Ok(trades) => {
            let response = OrderResponse { order, trades };
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to submit order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn cancel_order(
    State(state): State<SharedState>,
    Path(order_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let order_uuid = Uuid::from_str(&order_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    match state.matching_engine.write().await.cancel_order(order_uuid).await {
        Ok(true) => Ok(StatusCode::OK),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to cancel order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_order_book(
    State(state): State<SharedState>,
    Path(market_id): Path<u64>,
) -> Result<Json<OrderBook>, StatusCode> {
    let matching_engine = state.matching_engine.read().await;
    
    match matching_engine.get_order_book(market_id) {
        Some(order_book) => {
            let response = build_order_book_response(order_book);
            Ok(Json(response))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

fn build_order_book_response(order_book: &crate::matching_engine::OrderBook) -> OrderBook {
    let bids = aggregate_order_levels(order_book.get_bids());
    let asks = aggregate_order_levels(order_book.get_asks());

    OrderBook {
        market_id: order_book.market_id,
        bids,
        asks,
        last_updated: chrono::Utc::now(),
    }
}

fn aggregate_order_levels(orders: &[Order]) -> Vec<OrderBookLevel> {
    let mut levels = std::collections::HashMap::new();

    for order in orders {
        if let Some(price) = order.price {
            let remaining_size = order.size - order.filled_size;
            if remaining_size > Decimal::ZERO {
                let level = levels.entry(price).or_insert(OrderBookLevel {
                    price,
                    size: Decimal::ZERO,
                    order_count: 0,
                });
                level.size += remaining_size;
                level.order_count += 1;
            }
        }
    }

    let mut result: Vec<_> = levels.into_values().collect();
    result.sort_by(|a, b| b.price.cmp(&a.price)); // Descending order
    result
}
