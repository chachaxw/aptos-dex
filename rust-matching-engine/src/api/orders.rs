use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use std::str::FromStr;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::{
    models::{
        Order, OrderBook, OrderBookLevel, OrderResponse, OrderStatus, OrderType,
        SubmitOrderRequest, FreezeTransactionRequest, FreezeTransactionResponse,
        FreezeTransactionPayload, ConfirmOrderRequest, ConfirmOrderResponse,
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

    // ==================== 功能1: 下单时冻结资金 ====================
    // 计算所需抵押品
    let required_collateral = calculate_required_collateral(&order);
    
    // 验证用户抵押品
    if !state.aptos_client.validate_collateral(&order.user_address, required_collateral).await
        .map_err(|e| {
            error!("Failed to validate collateral: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })? {
        warn!("Insufficient collateral for user {}: required {}", order.user_address, required_collateral);
        return Err(StatusCode::BAD_REQUEST);
    }

    // 冻结用户资金
    match state.aptos_client.freeze_user_funds(
        &order.user_address,
        required_collateral,
        order.market_id,
    ).await {
        Ok(tx_hash) => {
            info!("Funds frozen for user {}: tx {}", order.user_address, tx_hash);
            
            // 等待资金冻结确认
            if !state.aptos_client.wait_for_transaction_confirmation(&tx_hash, 10).await
                .map_err(|e| {
                    error!("Failed to wait for freeze confirmation: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })? {
                warn!("Freeze transaction not confirmed for user {}", order.user_address);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
        Err(e) => {
            error!("Failed to freeze funds for user {}: {}", order.user_address, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

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

/// 计算所需抵押品
fn calculate_required_collateral(order: &Order) -> u64 {
    // 简化的抵押品计算逻辑
    let notional_value = match order.price {
        Some(price) => (order.size * price).to_u64().unwrap_or(0),
        None => order.size.to_u64().unwrap_or(0),
    };
    
    // 要求10%的抵押品，最少1000个最小单位
    (notional_value / 10).max(1)
}

pub async fn cancel_order(
    State(state): State<SharedState>,
    Path(order_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let order_uuid = Uuid::from_str(&order_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // 获取订单信息用于计算解冻金额
    let order_info = state.database.get_order(order_uuid).await
        .map_err(|e| {
            error!("Failed to get order info: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // 取消订单
    match state.matching_engine.write().await.cancel_order(order_uuid).await {
        Ok(true) => {
            // ==================== 功能3: 撤单时解冻资金 ====================
            // 计算需要解冻的资金
            let unfrozen_amount = calculate_unfrozen_amount(&order_info);
            
            if unfrozen_amount > 0 {
                // 解冻用户资金
                match state.aptos_client.unfreeze_user_funds(
                    &order_info.user_address,
                    unfrozen_amount,
                ).await {
                    Ok(tx_hash) => {
                        info!("Funds unfrozen for user {}: tx {}", order_info.user_address, tx_hash);
                        
                        // 等待资金解冻确认
                        if !state.aptos_client.wait_for_transaction_confirmation(&tx_hash, 10).await
                            .map_err(|e| {
                                error!("Failed to wait for unfreeze confirmation: {}", e);
                                StatusCode::INTERNAL_SERVER_ERROR
                            })? {
                            warn!("Unfreeze transaction not confirmed for user {}", order_info.user_address);
                            return Err(StatusCode::INTERNAL_SERVER_ERROR);
                        }
                    }
                    Err(e) => {
                        error!("Failed to unfreeze funds for user {}: {}", order_info.user_address, e);
                        return Err(StatusCode::INTERNAL_SERVER_ERROR);
                    }
                }
            }
            
            Ok(StatusCode::OK)
        }
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to cancel order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// 计算解冻金额
fn calculate_unfrozen_amount(order: &Order) -> u64 {
    let remaining_size = order.size - order.filled_size;
    if remaining_size == Decimal::ZERO {
        return 0;
    }

    let notional_value = match order.price {
        Some(price) => (remaining_size * price).to_u64().unwrap_or(0),
        None => remaining_size.to_u64().unwrap_or(0),
    };
    
    // 解冻对应的抵押品
    (notional_value / 10).max(1000)
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

// ==================== User-Signed Freeze API Endpoints ====================

/// Step 1: Request freeze transaction payload
pub async fn request_freeze_transaction(
    State(state): State<SharedState>,
    Json(req): Json<FreezeTransactionRequest>,
) -> Result<Json<FreezeTransactionResponse>, StatusCode> {
    info!("Received freeze transaction request: {} {} {}", 
        req.side, req.size, req.market_id);

    // Parse size
    let size = Decimal::from_str(&req.size)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Parse price for limit orders
    let price = match req.order_type {
        OrderType::Limit => {
            req.price.ok_or(StatusCode::BAD_REQUEST)?
                .parse::<Decimal>()
                .map_err(|_| StatusCode::BAD_REQUEST)?
        }
        OrderType::Market => Decimal::ZERO, // Market orders don't have price
    };

    // Create order with Pending status
    let order = Order {
        id: Uuid::new_v4(),
        user_address: req.user_address.clone(),
        market_id: req.market_id,
        side: req.side.clone(),
        order_type: req.order_type.clone(),
        size,
        price: if req.order_type == OrderType::Limit { Some(price) } else { None },
        filled_size: Decimal::ZERO,
        status: OrderStatus::Pending,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        expires_at: req.expires_at,
    };

    // Calculate required collateral
    let required_collateral = calculate_required_collateral(&order);
    
    // Validate user has sufficient collateral
    if !state.aptos_client.validate_collateral(&req.user_address, required_collateral).await
        .map_err(|e| {
            error!("Failed to validate collateral: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })? {
        warn!("Insufficient collateral for user {}: required {}", req.user_address, required_collateral);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Create freeze transaction payload
    let freeze_payload = FreezeTransactionPayload {
        function: format!("{}::vault::freeze_funds", state.config.aptos.contract_address),
        type_arguments: vec!["0x1::aptos_coin::AptosCoin".to_string()],
        arguments: vec![
            required_collateral.to_string(),
            req.market_id.to_string(),
        ],
        gas_limit: 100_000,
        gas_unit_price: 100,
    };

    let response = FreezeTransactionResponse {
        order_id: order.id,
        freeze_transaction_payload: freeze_payload,
        required_collateral,
        message: "Please sign the freeze transaction with your wallet to confirm the order".to_string(),
    };

    info!("Freeze transaction payload created for order {}: {} collateral required", 
        order.id, required_collateral);
    
    Ok(Json(response))
}

/// Step 2: Confirm order with signed transaction hash
pub async fn confirm_order(
    State(state): State<SharedState>,
    Json(req): Json<ConfirmOrderRequest>,
) -> Result<Json<ConfirmOrderResponse>, StatusCode> {
    info!("Received order confirmation: order_id={}, tx_hash={}", 
        req.order_id, req.signed_transaction_hash);

    // Verify the transaction was successful
    if !state.aptos_client.wait_for_transaction_confirmation(&req.signed_transaction_hash, 10).await
        .map_err(|e| {
            error!("Failed to verify transaction confirmation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })? {
        warn!("Transaction not confirmed for order {}", req.order_id);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Get the order from database (in a real implementation, you'd store pending orders)
    // For now, we'll create a new order and process it
    let order = Order {
        id: req.order_id,
        user_address: "".to_string(), // This would be retrieved from database
        market_id: 1, // This would be retrieved from database
        side: crate::models::OrderSide::Buy, // This would be retrieved from database
        order_type: crate::models::OrderType::Limit, // This would be retrieved from database
        size: Decimal::from_str("0.1").unwrap(),
        price: Some(Decimal::from_str("40000").unwrap()),
        filled_size: Decimal::ZERO,
        status: OrderStatus::Pending,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        expires_at: None,
    };

    // Submit order to matching engine
    match state.matching_engine.write().await.submit_order(order.clone()).await {
        Ok(trades) => {
            let response = ConfirmOrderResponse {
                order,
                trades,
                message: "Order confirmed and submitted successfully".to_string(),
            };
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to submit confirmed order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
