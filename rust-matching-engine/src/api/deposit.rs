use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use tracing::{error, info};

use crate::{
    models::{DepositRequest, DepositResponse},
    SharedState,
};

pub async fn deposit_funds(
    State(state): State<SharedState>,
    Json(req): Json<DepositRequest>,
) -> Result<Json<DepositResponse>, StatusCode> {
    info!("Received deposit request: {} APT from {}", req.amount, req.user_address);

    // Validate amount
    if req.amount <= 0 {
        error!("Invalid deposit amount: {}", req.amount);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Call Aptos contract to deposit funds
    match state.aptos_client.deposit_funds(
        &req.user_address,
        req.amount,
    ).await {
        Ok(tx_hash) => {
            info!("Deposit successful for user {}: tx {}", req.user_address, tx_hash);
            
            // Wait for confirmation
            if !state.aptos_client.wait_for_transaction_confirmation(&tx_hash, 3).await
                .map_err(|e| {
                    error!("Failed to wait for deposit confirmation: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })? {
                error!("Deposit transaction not confirmed for user {}", req.user_address);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }

            let response = DepositResponse {
                transaction_hash: tx_hash,
                amount: req.amount,
                user_address: req.user_address.clone(),
            };

            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to deposit funds for user {}: {}", req.user_address, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
