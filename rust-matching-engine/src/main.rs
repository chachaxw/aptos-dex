mod config;
mod matching_engine;
mod models;
mod api;
mod aptos_client;
mod database;
mod settlement;

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
        orders::{submit_order, cancel_order, get_order_book},
        health::health_check,
    },
    database::Database,
    aptos_client::AptosClient,
    settlement::SettlementService,
};
pub type SharedState = Arc<AppState>;

pub struct AppState {
    pub matching_engine: Arc<RwLock<MatchingEngine>>,
    pub database: Arc<Database>,
    pub aptos_client: Arc<AptosClient>,
    pub settlement_service: Arc<SettlementService>,
    pub config: Config,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::init();
    
    // Load configuration
    let config = Config::new()?;
    info!("Loaded configuration: {}", config.server.host);

    // Initialize database
    let database = Arc::new(Database::new(&config.database_url).await?);
    info!("Connected to database");

    // Initialize Aptos client
    let aptos_client = Arc::new(AptosClient::new(&config.aptos).await?);
    info!("Connected to Aptos node");

    // Initialize matching engine
    let matching_engine = Arc::new(RwLock::new(
        MatchingEngine::new(database.clone()).await?
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
        .route("/orders", post(submit_order))
        .route("/orders/:order_id", post(cancel_order))
        .route("/orderbook/:market_id", get(get_order_book))
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
