use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{json, Value};

use crate::SharedState;

pub async fn health_check(
    State(_state): State<SharedState>,
) -> Result<Json<Value>, StatusCode> {
    Ok(Json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now(),
        "service": "hyperperp-matching-engine"
    })))
}
