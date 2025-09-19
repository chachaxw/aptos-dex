use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::{models::Order, SharedState};

#[derive(Debug, Deserialize)]
pub struct UserOrdersQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UserTradesQuery {
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct UserOrdersResponse {
    pub orders: Vec<Order>,
    pub total: usize,
}

#[derive(Debug, Serialize)]
pub struct UserTradesResponse {
    pub trades: Vec<crate::models::Trade>,
    pub total: usize,
}

/// 根据用户地址查询订单列表
pub async fn get_user_orders(
    State(state): State<SharedState>,
    Path(user_address): Path<String>,
    Query(params): Query<UserOrdersQuery>,
) -> Result<Json<UserOrdersResponse>, StatusCode> {
    info!("Querying orders for user: {}", user_address);

    // 验证用户地址格式（简单验证）
    if user_address.is_empty() || user_address.len() < 10 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 查询用户订单
    let orders = state.database.get_orders_by_user(
        &user_address,
        params.status.as_deref(),
        params.limit,
        params.offset,
    ).await.map_err(|e| {
        error!("Failed to get user orders: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = UserOrdersResponse {
        total: orders.len(),
        orders,
    };

    info!("Retrieved {} orders for user {}", response.total, user_address);
    Ok(Json(response))
}

/// 根据用户地址查询交易记录
pub async fn get_user_trades(
    State(state): State<SharedState>,
    Path(user_address): Path<String>,
    Query(params): Query<UserTradesQuery>,
) -> Result<Json<UserTradesResponse>, StatusCode> {
    info!("Querying trades for user: {}", user_address);

    // 验证用户地址格式（简单验证）
    if user_address.is_empty() || user_address.len() < 10 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 解析时间参数
    let start_time = if let Some(start_str) = &params.start_time {
        match chrono::DateTime::parse_from_rfc3339(start_str) {
            Ok(dt) => Some(dt.with_timezone(&chrono::Utc)),
            Err(e) => {
                error!("Invalid start_time format: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    } else {
        None
    };

    let end_time = if let Some(end_str) = &params.end_time {
        match chrono::DateTime::parse_from_rfc3339(end_str) {
            Ok(dt) => Some(dt.with_timezone(&chrono::Utc)),
            Err(e) => {
                error!("Invalid end_time format: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    } else {
        None
    };

    // 查询用户交易记录
    let trades = state.database.get_trades_by_user(
        &user_address,
        start_time,
        end_time,
        params.limit,
        params.offset,
    ).await.map_err(|e| {
        error!("Failed to get user trades: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = UserTradesResponse {
        total: trades.len(),
        trades,
    };

    info!("Retrieved {} trades for user {}", response.total, user_address);
    Ok(Json(response))
}

/// 查询所有交易记录（不指定用户）
pub async fn get_all_trades(
    State(state): State<SharedState>,
    Query(params): Query<UserTradesQuery>,
) -> Result<Json<UserTradesResponse>, StatusCode> {
    info!("Querying all trades");

    // 解析时间参数
    let start_time = if let Some(start_str) = &params.start_time {
        match chrono::DateTime::parse_from_rfc3339(start_str) {
            Ok(dt) => Some(dt.with_timezone(&chrono::Utc)),
            Err(e) => {
                error!("Invalid start_time format: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    } else {
        None
    };

    let end_time = if let Some(end_str) = &params.end_time {
        match chrono::DateTime::parse_from_rfc3339(end_str) {
            Ok(dt) => Some(dt.with_timezone(&chrono::Utc)),
            Err(e) => {
                error!("Invalid end_time format: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    } else {
        None
    };

    // 查询所有交易记录
    let trades = state.database.get_all_trades(
        start_time,
        end_time,
        params.limit,
        params.offset,
    ).await.map_err(|e| {
        error!("Failed to get all trades: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = UserTradesResponse {
        total: trades.len(),
        trades,
    };

    info!("Retrieved {} trades (all)", response.total);
    Ok(Json(response))
}
