use anyhow::{Context, Result};
use aptos_crypto::ed25519::{Ed25519PrivateKey, Ed25519PublicKey};
use aptos_rust_sdk::client::builder::AptosClientBuilder;
use hex;
use aptos_rust_sdk::client::config::AptosNetwork;
use aptos_rust_sdk_types::api_types::{
    address::AccountAddress,
    chain_id::ChainId,
    module_id::ModuleId,
    transaction::{
        EntryFunction, GenerateSigningMessage, RawTransaction, SignedTransaction, TransactionPayload,
    },
    transaction_authenticator::TransactionAuthenticator,
    account::AccountResource,
};
use rust_decimal::Decimal;
use std::convert::TryFrom;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::{
    config::AptosConfig,
    models::SettlementBatch,
};

#[derive(Debug)]
pub struct AptosClient {
    client: aptos_rust_sdk::client::rest_api::AptosFullnodeClient,
    admin_private_key: Ed25519PrivateKey,
    admin_address: AccountAddress,
    contract_address: AccountAddress,
    chain_id: ChainId,
}

impl AptosClient {
    fn parse_private_key(key_str: &str) -> Result<Ed25519PrivateKey> {
        // Remove the "ed25519-priv-0x" prefix if present
        let hex_str = key_str
            .strip_prefix("ed25519-priv-0x")
            .unwrap_or(key_str);
        
        // Convert hex string to bytes
        let bytes = hex::decode(hex_str)
            .context("Failed to decode private key hex string")?;
        
        // Create Ed25519PrivateKey from bytes
        Ed25519PrivateKey::try_from(bytes.as_slice())
            .context("Failed to create Ed25519PrivateKey from bytes")
    }
    pub async fn new(config: &AptosConfig) -> Result<Self> {
        // Create client using the new SDK
        let network = match config.chain_id {
            1 => AptosNetwork::mainnet(),
            2 => AptosNetwork::testnet(),
            _ => AptosNetwork::testnet(), // Default to testnet
        };
        let client = AptosClientBuilder::new(network).build();
        
        // Load admin private key - parse from config format (ed25519-priv-0x...)
        let private_key = Self::parse_private_key(&config.admin_private_key)
            .context("Failed to parse admin private key")?;
        
        let admin_address = AccountAddress::from_str(&config.admin_address)?;
        let contract_address = AccountAddress::from_str(&config.contract_address)?;
        let chain_id = match config.chain_id {
            1 => ChainId::Mainnet,
            2 => ChainId::Testnet,
            3 => ChainId::Testing,
            id => ChainId::Other(id as u8),
        };

        let aptos_client = Self {
            client,
            admin_private_key: private_key,
            admin_address,
            contract_address,
            chain_id,
        };

        info!("Aptos client initialized for admin: {}", aptos_client.admin_address);

        Ok(aptos_client)
    }



    fn create_settlement_batch_data(&self, batch: &SettlementBatch) -> SettlementBatchData {
        SettlementBatchData {
            fills: batch.trades.iter().map(|trade| {
                BatchFillData {
                    taker: AccountAddress::from_str(&trade.taker_address).unwrap_or(AccountAddress::ZERO),
                    maker: AccountAddress::from_str(&trade.maker_address).unwrap_or(AccountAddress::ZERO),
                    market_id: trade.market_id,
                    size: self.decimal_to_u128(trade.size).unwrap_or(0),
                    price_x: self.decimal_to_u128(trade.price * Decimal::from(100_000_000)).unwrap_or(0),
                    fee_bps: 10, // 0.1% fee
                    ts: trade.created_at.timestamp() as u64,
                }
            }).collect(),
            oracle_ts: batch.oracle_timestamp,
            min_px: self.decimal_to_u128(batch.min_price * Decimal::from(100_000_000)).unwrap_or(0),
            max_px: self.decimal_to_u128(batch.max_price * Decimal::from(100_000_000)).unwrap_or(u128::MAX),
            expiry: batch.expiry_timestamp,
        }
    }

    fn decimal_to_u128(&self, decimal: Decimal) -> Result<u128> {
        decimal
            .to_string()
            .parse()
            .context("Failed to convert decimal to u128")
    }

    pub async fn get_account_balance(&self, address: &str) -> Result<u64> {
        let resources = self.client.get_account_resources(address.to_string()).await?;
        
        // Find the coin store resource
        for resource in resources.into_inner() {
            if resource.type_ == "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>" {
                if let Some(coin) = resource.data.get("coin") {
                    if let Some(value) = coin.get("value") {
                        if let Some(balance_str) = value.as_str() {
                            return balance_str.parse().context("Failed to parse balance");
                        }
                    }
                }
            }
        }

        Ok(0)
    }

    // ==================== 功能1: 下单时冻结资金 ====================
    
    /// 用户下单时冻结资金 - 调用合约划转金额
    pub async fn freeze_user_funds(
        &self,
        user_address: &str,
        amount: u64,
        market_id: u64,
    ) -> Result<String> {
        info!("Freezing funds for user {}: {} APT in market {}", user_address, amount, market_id);

        // 获取用户账户信息
        let user_addr = AccountAddress::from_str(user_address)?;
        let resources = self.client.get_account_resources(user_address.to_string()).await?;
        let sequence_number = self.get_sequence_number(&resources.into_inner())?;

        // 创建冻结资金的交易载荷 - 调用vault::deposit
        let payload = TransactionPayload::EntryFunction(EntryFunction::new(
            ModuleId::new(self.contract_address, "vault".to_string()),
            "deposit".to_string(),
            vec![], // 类型参数
            vec![
                bcs::to_bytes(&amount)?,                    // amount
                bcs::to_bytes(&self.contract_address)?,      // cfg_addr
            ],
        ));

        // 创建原始交易
        let raw_txn = RawTransaction::new(
            user_addr,
            sequence_number,
            payload,
            100_000, // max_gas_amount
            100,     // gas_unit_price
            self.get_expiration_timestamp().await?,
            self.chain_id,
        );

        // 签名并提交交易
        let tx_hash = self.sign_and_submit_transaction(raw_txn).await?;
        info!("Funds frozen for user {}: tx {}", user_address, tx_hash);
        Ok(tx_hash)
    }

    /// 检查用户抵押品余额
    pub async fn get_user_collateral(&self, user_address: &str) -> Result<u64> {
        let resources = self.client.get_account_resources(user_address.to_string()).await?;
        
        // 查找账户资源中的抵押品余额
        for resource in resources.into_inner() {
            if resource.type_.contains("Account") {
                if let Some(collateral) = resource.data.get("collateral") {
                    if let Some(value) = collateral.as_str() {
                        return value.parse().context("Failed to parse collateral");
                    }
                }
            }
        }
        
        Ok(0)
    }

    /// 验证用户是否有足够抵押品
    pub async fn validate_collateral(
        &self,
        user_address: &str,
        required_amount: u64,
    ) -> Result<bool> {
        let collateral = self.get_user_collateral(user_address).await?;
        let has_sufficient = collateral >= required_amount;
        
        if !has_sufficient {
            warn!("Insufficient collateral for user {}: required {}, available {}", 
                user_address, required_amount, collateral);
        }
        
        Ok(has_sufficient)
    }

    // ==================== 功能2: 撮合成功后的批量结算 ====================
    
    /// 批量结算交易 - 调用合约批量结算
    pub async fn submit_settlement_batch(
        &self,
        batch: &SettlementBatch,
    ) -> Result<String> {
        info!("Submitting settlement batch: {} trades", batch.trades.len());

        // 获取管理员账户序列号
        let resources = self.client.get_account_resources(self.admin_address.to_string()).await?;
        let sequence_number = self.get_sequence_number(&resources.into_inner())?;

        // 创建结算批次数据
        let batch_data = self.create_settlement_batch_data(batch);

        // 创建交易载荷 - 调用perp_engine::apply_batch
        let payload = TransactionPayload::EntryFunction(EntryFunction::new(
            ModuleId::new(self.contract_address, "perp_engine".to_string()),
            "apply_batch".to_string(),
            vec![], // 无类型参数
            vec![
                bcs::to_bytes(&batch_data)?,
                bcs::to_bytes(&self.admin_address)?, // events_addr
            ],
        ));

        // 创建原始交易
        let raw_txn = RawTransaction::new(
            self.admin_address,
            sequence_number,
            payload,
            1_000_000, // 更高的gas限制用于批量操作
            100,       // gas_unit_price
            self.get_expiration_timestamp().await?,
            self.chain_id,
        );

        // 签名并提交
        let tx_hash = self.sign_and_submit_transaction(raw_txn).await?;
        info!("Settlement batch submitted: tx {}", tx_hash);
        Ok(tx_hash)
    }

    /// 检查交易状态
    pub async fn check_transaction_status(&self, tx_hash: &str) -> Result<bool> {
        match self.client.get_transaction_by_hash(tx_hash.to_string()).await {
            Ok(_tx) => {
                // 检查交易是否成功
                // 这里简化处理，实际应该检查交易状态
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    }

    /// 等待交易确认
    pub async fn wait_for_transaction_confirmation(
        &self,
        tx_hash: &str,
        max_attempts: u32,
    ) -> Result<bool> {
        for attempt in 1..=max_attempts {
            tokio::time::sleep(Duration::from_secs(1)).await;
            
            if self.check_transaction_status(tx_hash).await? {
                info!("Transaction {} confirmed after {} attempts", tx_hash, attempt);
                return Ok(true);
            }
        }
        
        warn!("Transaction {} not confirmed after {} attempts", tx_hash, max_attempts);
        Ok(false)
    }

    // ==================== 功能3: 撤单时解冻资金 ====================
    
    /// 用户撤单时解冻资金 - 取消冻结（划转回去）
    pub async fn unfreeze_user_funds(
        &self,
        user_address: &str,
        amount: u64,
    ) -> Result<String> {
        info!("Unfreezing funds for user {}: {} APT", user_address, amount);

        // 获取管理员账户信息（只有管理员可以执行提款）
        let resources = self.client.get_account_resources(self.admin_address.to_string()).await?;
        let sequence_number = self.get_sequence_number(&resources.into_inner())?;

        let user_addr = AccountAddress::from_str(user_address)?;

        // 创建解冻资金的交易载荷 - 调用vault::withdraw_to
        let payload = TransactionPayload::EntryFunction(EntryFunction::new(
            ModuleId::new(self.contract_address, "vault".to_string()),
            "withdraw_to".to_string(),
            vec![], // 类型参数
            vec![
                bcs::to_bytes(&user_addr)?,              // recipient
                bcs::to_bytes(&amount)?,                  // amount
                bcs::to_bytes(&self.contract_address)?,   // cfg_addr
            ],
        ));

        // 创建原始交易
        let raw_txn = RawTransaction::new(
            self.admin_address,
            sequence_number,
            payload,
            100_000, // max_gas_amount
            100,     // gas_unit_price
            self.get_expiration_timestamp().await?,
            self.chain_id,
        );

        // 签名并提交交易
        let tx_hash = self.sign_and_submit_transaction(raw_txn).await?;
        info!("Funds unfrozen for user {}: tx {}", user_address, tx_hash);
        Ok(tx_hash)
    }

    /// 批量解冻多个用户的资金
    pub async fn batch_unfreeze_funds(
        &self,
        unfreeze_requests: Vec<(String, u64)>,
    ) -> Result<String> {
        info!("Batch unfreezing funds for {} users", unfreeze_requests.len());

        let resources = self.client.get_account_resources(self.admin_address.to_string()).await?;
        let sequence_number = self.get_sequence_number(&resources.into_inner())?;

        // 创建批量解冻的交易载荷
        let payload = TransactionPayload::EntryFunction(EntryFunction::new(
            ModuleId::new(self.contract_address, "vault".to_string()),
            "batch_withdraw".to_string(),
            vec![],
            vec![
                bcs::to_bytes(&unfreeze_requests)?,
                bcs::to_bytes(&self.contract_address)?,
            ],
        ));

        let raw_txn = RawTransaction::new(
            self.admin_address,
            sequence_number,
            payload,
            500_000, // 更高的gas限制
            100,
            self.get_expiration_timestamp().await?,
            self.chain_id,
        );

        let tx_hash = self.sign_and_submit_transaction(raw_txn).await?;
        info!("Batch unfreeze submitted: tx {}", tx_hash);
        Ok(tx_hash)
    }

    // ==================== 通用辅助方法 ====================
    
    /// 签名并提交交易
    async fn sign_and_submit_transaction(
        &self,
        raw_txn: RawTransaction,
    ) -> Result<String> {
        // 生成签名消息
        let message = raw_txn.generate_signing_message()?;
        let signature = self.admin_private_key.sign_message(&message);
        
        // 创建签名交易
        let signed_txn = SignedTransaction::new(
            raw_txn,
            TransactionAuthenticator::ed25519(
                Ed25519PublicKey::from(&self.admin_private_key),
                signature,
            ),
        );

        // 提交交易
        let result = self.client.submit_transaction(signed_txn).await?;
        let response_data = result.into_inner();
        
        // 提取交易哈希
        let txn_hash = response_data
            .get("hash")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        
        info!("Transaction submitted: {}", txn_hash);
        Ok(txn_hash)
    }

    /// 获取账户序列号
    fn get_sequence_number(&self, resources: &[AccountResource]) -> Result<u64> {
        for resource in resources {
            if resource.type_ == "0x1::account::Account" {
                if let Some(seq) = resource.data.get("sequence_number")
                    .and_then(|s| s.as_str())
                    .and_then(|s| s.parse::<u64>().ok()) {
                    return Ok(seq);
                }
            }
        }
        Ok(0)
    }

    /// 获取过期时间戳
    async fn get_expiration_timestamp(&self) -> Result<u64> {
        let state = self.client.get_state().await?;
        Ok(state.timestamp_usecs / 1000 / 1000 + 30) // 30秒后过期
    }
}

#[derive(Debug, Clone, serde::Serialize)]
struct BatchFillData {
    taker: AccountAddress,
    maker: AccountAddress,
    market_id: u64,
    size: u128,
    price_x: u128,
    fee_bps: u64,
    ts: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
struct SettlementBatchData {
    fills: Vec<BatchFillData>,
    oracle_ts: u64,
    min_px: u128,
    max_px: u128,
    expiry: u64,
}
