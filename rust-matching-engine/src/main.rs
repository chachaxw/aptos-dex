mod config;
mod matching_engine;
mod models;
mod api;
mod aptos_client;
mod database;
mod settlement;
mod redis_client;

use anyhow::Result;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{info, warn};

use crate::{
    config::Config,
    matching_engine::MatchingEngine,
    api::{
        orders::{submit_order, cancel_order, get_order_book, request_freeze_transaction, confirm_order},
        health::health_check,
        markets::{get_market, get_all_markets},
        deposit::deposit_funds,
        user_queries::{get_user_orders, get_user_trades},
    },
    database::Database,
    aptos_client::AptosClient,
    settlement::SettlementService,
    redis_client::RedisClient,
};
pub type SharedState = Arc<AppState>;

pub struct AppState {
    pub matching_engine: Arc<RwLock<MatchingEngine>>,
    pub database: Arc<Database>,
    pub redis_client: Arc<RwLock<RedisClient>>,
    pub aptos_client: Arc<AptosClient>,
    pub settlement_service: Arc<SettlementService>,
    pub config: Config,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    // Load configuration
    let config = Config::new()?;
    info!("Loaded configuration: {}", config.server.host);

    // Initialize database
    let database = Arc::new(Database::new(&config.database.url).await?);
    info!("Connected to database");

    // Initialize Redis client
    let redis_client = Arc::new(RwLock::new(RedisClient::new(&config.redis.url).await?));
    info!("Connected to Redis");

    // Initialize Aptos client
    let aptos_client = Arc::new(AptosClient::new(&config.aptos).await?);
    info!("Connected to Aptos node");

    // Initialize matching engine
    let matching_engine = Arc::new(RwLock::new(
        MatchingEngine::new(database.clone(), redis_client.clone()).await?
    ));
    info!("Matching engine initialized");

    // Initialize settlement service
    let settlement_service = Arc::new(
        SettlementService::new(
            aptos_client.clone(),
            database.clone(),
            config.settlement.clone()
        ).await?
    );
    info!("Settlement service initialized");

    // Create shared application state
    let state = Arc::new(AppState {
        matching_engine,
        database,
        redis_client,
        aptos_client,
        settlement_service: settlement_service.clone(),
        config: config.clone(),
    });

    // Start settlement service background task
    let settlement_handle = tokio::spawn(async move {
        settlement_service.start_settlement_loop().await
    });

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/deposit", post(deposit_funds))
        .route("/orders", post(submit_order))
        .route("/orders/:order_id", post(cancel_order))
        .route("/orderbook/:market_id", get(get_order_book))
        .route("/markets", get(get_all_markets))
        .route("/markets/:market_id", get(get_market))
        .route("/orders/freeze", post(request_freeze_transaction))
        .route("/orders/confirm", post(confirm_order))
        .route("/orders/user/:user_address", get(get_user_orders))
        .route("/trades/user/:user_address", get(get_user_trades))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(
        format!("{}:{}", config.server.host, config.server.port)
    ).await?;

    info!("🚀 HyperPerp Matching Engine listening on {}:{}", 
        config.server.host, config.server.port);

    // Start server
    let server_handle = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    // Wait for either server or settlement service to complete
    tokio::select! {
        result = server_handle => {
            warn!("Server terminated: {:?}", result);
        }
        result = settlement_handle => {
            warn!("Settlement service terminated: {:?}", result);
        }
    }

    Ok(())
}
