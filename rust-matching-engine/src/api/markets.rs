use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::SharedState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketInfo {
    pub market_id: u64,
    pub symbol: String,
    pub base_token: String,
    pub quote_token: String,
}

// 硬编码的市场数据
fn get_markets() -> Vec<MarketInfo> {
    vec![
        MarketInfo {
            market_id: 1,
            symbol: "BTC/USDC".to_string(),
            base_token: "BTC".to_string(),
            quote_token: "USDC".to_string(),
        },
        MarketInfo {
            market_id: 2,
            symbol: "ETH/USDC".to_string(),
            base_token: "ETH".to_string(),
            quote_token: "USDC".to_string(),
        },
        MarketInfo {
            market_id: 3,
            symbol: "SOL/USDC".to_string(),
            base_token: "SOL".to_string(),
            quote_token: "USDC".to_string(),
        },
    ]
}

/// 根据market_id查询市场信息
pub async fn get_market(
    State(_state): State<SharedState>,
    Path(market_id): Path<u64>,
) -> Result<Json<MarketInfo>, StatusCode> {
    info!("Querying market info for market_id: {}", market_id);

    // 获取市场数据并查找对应的市场信息
    let markets = get_markets();
    let market = markets.iter().find(|m| m.market_id == market_id);

    match market {
        Some(market_info) => {
            info!("Found market: {} ({})", market_info.symbol, market_info.market_id);
            Ok(Json(market_info.clone()))
        }
        None => {
            error!("Market not found for market_id: {}", market_id);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// 获取所有市场信息
pub async fn get_all_markets(
    State(_state): State<SharedState>,
) -> Result<Json<Vec<MarketInfo>>, StatusCode> {
    info!("Querying all markets");

    let markets = get_markets();
    info!("Returning {} markets", markets.len());
    
    Ok(Json(markets))
}
