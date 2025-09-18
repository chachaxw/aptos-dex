# HyperPerp Matching Engine - Aptos 链上交互实现

## 概述

本文档详细说明了如何使用 `aptos-rust-sdk`、`aptos-rust-sdk-types`、`aptos-crypto` 实现撮合引擎与 Aptos 链上合约的三个核心交互功能。

## 三个核心功能

### 1. 下单 -> 撮合引擎 -> 调用合约划转金额

**实现位置**: `src/api/orders.rs::submit_order()`

**功能流程**:
1. 用户提交订单
2. 计算所需抵押品 (`calculate_required_collateral`)
3. 验证用户抵押品余额 (`validate_collateral`)
4. 冻结用户资金 (`freeze_user_funds`)
5. 等待资金冻结确认
6. 提交订单到撮合引擎

**关键代码**:
```rust
// 计算所需抵押品
let required_collateral = calculate_required_collateral(&order);

// 验证用户抵押品
if !state.aptos_client.validate_collateral(&order.user_address, required_collateral).await? {
    return Err(StatusCode::BAD_REQUEST);
}

// 冻结用户资金
let tx_hash = state.aptos_client.freeze_user_funds(
    &order.user_address,
    required_collateral,
    order.market_id,
).await?;

// 等待确认
state.aptos_client.wait_for_transaction_confirmation(&tx_hash, 10).await?;
```

**链上调用**: `vault::deposit(amount, cfg_addr)`

### 2. 撮合成功 -> 调用合约批量结算

**实现位置**: `src/settlement.rs::settle_batch()`

**功能流程**:
1. 撮合引擎产生交易
2. 结算服务收集待结算交易
3. 创建结算批次
4. 调用合约批量结算
5. 更新交易状态

**关键代码**:
```rust
// 提交到区块链
let settlement_future = async {
    let client = self.aptos_client.lock().await;
    client.submit_settlement_batch(batch).await
};

match timeout(Duration::from_secs(30), settlement_future).await {
    Ok(Ok(transaction_hash)) => {
        batch.transaction_hash = Some(transaction_hash.clone());
        batch.status = SettlementStatus::Confirmed;
        // 更新数据库
    }
    // 错误处理...
}
```

**链上调用**: `perp_engine::apply_batch(batch_data, events_addr)`

### 3. 撤单 -> 撮合引擎删除订单簿 -> 取消冻结（划转回去）

**实现位置**: `src/api/orders.rs::cancel_order()`

**功能流程**:
1. 获取订单信息
2. 从撮合引擎取消订单
3. 计算解冻金额 (`calculate_unfrozen_amount`)
4. 解冻用户资金 (`unfreeze_user_funds`)
5. 等待解冻确认

**关键代码**:
```rust
// 取消订单
match state.matching_engine.write().await.cancel_order(order_uuid).await {
    Ok(true) => {
        // 计算解冻金额
        let unfrozen_amount = calculate_unfrozen_amount(&order_info);
        
        if unfrozen_amount > 0 {
            // 解冻用户资金
            let tx_hash = state.aptos_client.unfreeze_user_funds(
                &order_info.user_address,
                unfrozen_amount,
            ).await?;
            
            // 等待确认
            state.aptos_client.wait_for_transaction_confirmation(&tx_hash, 10).await?;
        }
    }
}
```

**链上调用**: `vault::withdraw_to(recipient, amount, cfg_addr)`

## AptosClient 核心方法

### 资金管理方法

```rust
impl AptosClient {
    /// 冻结用户资金
    pub async fn freeze_user_funds(&self, user_address: &str, amount: u64, market_id: u64) -> Result<String>
    
    /// 解冻用户资金
    pub async fn unfreeze_user_funds(&self, user_address: &str, amount: u64) -> Result<String>
    
    /// 批量解冻资金
    pub async fn batch_unfreeze_funds(&self, unfreeze_requests: Vec<(String, u64)>) -> Result<String>
    
    /// 验证用户抵押品
    pub async fn validate_collateral(&self, user_address: &str, required_amount: u64) -> Result<bool>
    
    /// 获取用户抵押品余额
    pub async fn get_user_collateral(&self, user_address: &str) -> Result<u64>
}
```

### 结算方法

```rust
impl AptosClient {
    /// 批量结算交易
    pub async fn submit_settlement_batch(&self, batch: &SettlementBatch) -> Result<String>
    
    /// 检查交易状态
    pub async fn check_transaction_status(&self, tx_hash: &str) -> Result<bool>
    
    /// 等待交易确认
    pub async fn wait_for_transaction_confirmation(&self, tx_hash: &str, max_attempts: u32) -> Result<bool>
}
```

### 通用方法

```rust
impl AptosClient {
    /// 签名并提交交易
    async fn sign_and_submit_transaction(&self, raw_txn: RawTransaction) -> Result<String>
    
    /// 获取账户序列号
    fn get_sequence_number(&self, resources: &FullnodeResponse<Vec<AccountResource>>) -> Result<u64>
    
    /// 获取过期时间戳
    async fn get_expiration_timestamp(&self) -> Result<u64>
}
```

## 配置要求

### config.toml
```toml
[aptos]
node_url = "https://fullnode.testnet.aptoslabs.com/v1"
admin_address = "0x..."  # 管理员地址
admin_private_key = "ed25519-priv-0x..."  # 管理员私钥
contract_address = "0x..."  # 合约地址
chain_id = 2  # testnet

[settlement]
batch_size = 10
batch_timeout_secs = 5
max_price_slippage = 0.05
```

### Cargo.toml 依赖
```toml
[dependencies]
aptos-rust-sdk = {git = "https://github.com/aptos-labs/aptos-rust-sdk", package = "aptos-rust-sdk"}
aptos-rust-sdk-types = {git = "https://github.com/aptos-labs/aptos-rust-sdk", package = "aptos-rust-sdk-types"}
aptos-crypto = {git = "https://github.com/aptos-labs/aptos-rust-sdk", package = "aptos-crypto"}
bcs = "0.1.4"
hex = "0.4.3"
```

## 测试方法

### 1. 启动服务
```bash
cd /Users/zhaojingchao/Projects/web3/aptos-hyper-dex/rust-matching-engine
cargo run
```

### 2. 运行集成测试
```bash
./test_aptos_integration.sh
```

### 3. 观察日志
关键日志输出：
- `Freezing funds for user {}: {} APT in market {}`
- `Funds frozen for user {}: tx {}`
- `Submitting settlement batch: {} trades`
- `Settlement batch submitted: tx {}`
- `Unfreezing funds for user {}: {} APT`
- `Funds unfrozen for user {}: tx {}`

## 错误处理

### 常见错误及解决方案

1. **抵押品不足**
   - 错误: `Insufficient collateral for user`
   - 解决: 确保用户有足够的抵押品余额

2. **交易超时**
   - 错误: `Transaction not confirmed after {} attempts`
   - 解决: 检查网络连接和gas设置

3. **合约调用失败**
   - 错误: `Failed to freeze/unfreeze funds`
   - 解决: 检查合约地址和权限设置

4. **序列号错误**
   - 错误: `Failed to get sequence number`
   - 解决: 检查账户状态和网络连接

## 性能优化

### 1. 批量处理
- 使用批量解冻减少链上交易数量
- 设置合理的批次大小和超时时间

### 2. 异步处理
- 资金冻结/解冻异步执行
- 结算服务独立运行

### 3. 错误重试
- 实现指数退避重试机制
- 设置合理的超时时间

## 安全考虑

### 1. 私钥管理
- 使用环境变量存储私钥
- 实现私钥轮换机制

### 2. 权限控制
- 只有管理员可以执行结算
- 实现多重签名验证

### 3. 资金安全
- 实现抵押品验证
- 设置最大交易限额

## 监控和日志

### 关键指标
- 资金冻结/解冻成功率
- 结算批次处理时间
- 链上交易确认时间

### 日志级别
- `INFO`: 正常操作日志
- `WARN`: 警告信息
- `ERROR`: 错误信息

## 总结

通过以上实现，HyperPerp Matching Engine 成功集成了 Aptos 链上交互功能，实现了：

1. ✅ **下单时资金冻结** - 确保用户有足够抵押品
2. ✅ **撮合成功后批量结算** - 高效处理交易结算
3. ✅ **撤单时资金解冻** - 及时释放用户资金

所有功能都使用标准的 `aptos-rust-sdk` 进行实现，确保了与 Aptos 区块链的完全兼容性。
