use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub aptos: AptosConfig,
    pub settlement: SettlementConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AptosConfig {
    pub node_url: String,
    pub admin_address: String,
    pub admin_private_key: String,
    pub contract_address: String,
    pub chain_id: u8,
    pub usdc_token_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementConfig {
    pub batch_size: usize,
    pub batch_timeout_secs: u64,
    pub max_price_slippage: f64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 8080,
            },
            database: DatabaseConfig {
                url: "postgresql://postgres:password@localhost:5432/orderbook".to_string(),
            },
            redis: RedisConfig {
                url: "redis://127.0.0.1:6379".to_string(),
            },
            aptos: AptosConfig {
                node_url: "https://fullnode.testnet.aptoslabs.com/v1".to_string(),
                admin_address: "0x517206cb6757cc0723667a05afb9c05675341cd79570ba7cfb72f63241d55a2e".to_string(),
                admin_private_key: "ed25519-priv-0x16784b15393b798ddf3be455032c4b61dcf7d57090863a545db898b65bd8dc46".to_string(),
                contract_address: "0x517206cb6757cc0723667a05afb9c05675341cd79570ba7cfb72f63241d55a2e".to_string(),
                chain_id: 2, // testnet
                usdc_token_type: "0x29b0681a76b20595201859a5d2b269ae9d1fe98251198cefa513c95267003c0c::mint_test_coin::Coin".to_string(),
            },
            settlement: SettlementConfig {
                batch_size: 10,
                batch_timeout_secs: 5,
                max_price_slippage: 0.05, // 5%
            },
        }
    }
}

impl Config {
    pub fn new() -> Result<Self> {
        let config = config::Config::builder()
            .add_source(config::Environment::with_prefix("HYPERPERP"))
            .add_source(config::File::with_name("config.toml").required(false))
            .build()?;

        Ok(config.try_deserialize().unwrap_or_else(|_| Config::default()))
    }
}
