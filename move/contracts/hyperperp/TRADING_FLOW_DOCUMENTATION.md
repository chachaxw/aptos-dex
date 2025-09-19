# 永续合约撮合交易流程文档

## 概述
本文档详细说明了 HyperPerp 永续合约系统的完整撮合交易流程，包括所有需要调用的函数、参数和链上状态变化。

## 系统架构

### 核心模块
1. **perp_engine** - 永续合约引擎，处理撮合和结算
2. **positions** - 持仓管理
3. **vault_coin** - 资金金库（使用 Coin 标准）
4. **account** - 用户账户管理
5. **oracle_adapter** - 价格预言机
6. **events** - 事件系统
7. **gov** - 治理模块

## 完整交易流程

### 阶段 1: 系统初始化

#### 1.1 配置模块初始化
```bash
aptos move run --function-id "0x{admin}::config::init" --args address:"0x{usdc_metadata}"
```
- **功能**: 初始化系统配置，设置 USDC 元数据
- **参数**: USDC 代币元数据地址
- **权限**: 管理员

#### 1.2 治理模块初始化
```bash
aptos move run --function-id "0x{admin}::gov::init_admins_single" --args address:"0x{admin}"
```
- **功能**: 设置管理员权限
- **参数**: 管理员地址
- **权限**: 管理员

#### 1.3 事件系统初始化
```bash
aptos move run --function-id "0x{admin}::events::init_events"
```
- **功能**: 初始化事件存储系统
- **权限**: 管理员

#### 1.4 金库初始化
```bash
aptos move run --function-id "0x{admin}::vault_coin::init_ledger"
```
- **功能**: 初始化资金金库
- **权限**: 管理员

#### 1.5 预言机初始化
```bash
aptos move run --function-id "0x{admin}::oracle_adapter::init" --args u64:60
```
- **功能**: 初始化价格预言机，设置价格过期时间
- **参数**: 价格过期时间（秒）
- **权限**: 管理员

### 阶段 2: 用户账户初始化

#### 2.1 创建用户账户
```bash
aptos move run --function-id "0x{admin}::account::open" --profile user
```
- **功能**: 为用户创建交易账户
- **权限**: 用户自己
- **链上变化**: 创建 `Account` 资源，包含抵押品、未结算 PnL 等信息

### 阶段 3: 资金管理

#### 3.1 用户存款
```bash
aptos move run --function-id "0x{admin}::vault_coin::deposit" --type-args "0x29b0681a76b20595201859a5d2b269ae9d1fe98251198cefa513c95267003c0c::mint_test_coin::Coin" --args address:"0x{admin}" u128:amount --profile user
```
- **功能**: 用户存入 USDC 作为交易保证金
- **参数**: 
  - 管理员地址
  - 存款数量（6位小数）
- **权限**: 用户自己
- **链上变化**: 
  - 用户 USDC 余额减少
  - 金库 USDC 余额增加
  - 用户账户抵押品增加
  - 触发 `DepositEvent` 事件

### 阶段 4: 价格推送

#### 4.1 推送市场价格
```bash
aptos move run --function-id "0x{admin}::oracle_adapter::push_price" --args u64:market_id u64:price u64:confidence u64:timestamp --profile admin
```
- **功能**: 推送市场价格数据
- **参数**:
  - 市场ID（如 1 代表 BTC）
  - 价格（8位小数，如 30000000 代表 30000 USDC）
  - 价格置信度
  - 时间戳
- **权限**: 管理员
- **链上变化**: 更新价格存储，用于交易验证

### 阶段 5: 撮合交易执行

#### 5.1 执行撮合交易批次结算
```bash
aptos move run --function-id "0x{admin}::perp_engine::apply_batch_simple" \
  --args address:"0x{taker}" address:"0x{maker}" u64:market_id u128:size u64:price u64:fee_bps \
  u64:timestamp u64:oracle_ts u64:min_price u64:max_price u64:expiry address:"0x{events}" \
  --profile admin
```
- **功能**: 执行撮合交易，更新持仓和资金
- **参数**:
  - Taker 地址（买方）
  - Maker 地址（卖方）
  - 市场ID
  - 交易数量
  - 交易价格（8位小数）
  - 手续费（基点）
  - 时间戳
  - 预言机时间戳
  - 最小价格（价格保护）
  - 最大价格（价格保护）
  - 过期时间
  - 事件地址
- **权限**: 管理员
- **链上变化**:
  - 更新 Taker 和 Maker 的持仓
  - 计算并收取手续费
  - 执行资金转移
  - 触发 `FillEvent` 和 `PositionUpdateEvent` 事件

### 阶段 6: 资金结算

#### 6.1 提取资金
```bash
aptos move run --function-id "0x{admin}::vault_coin::withdraw_for" --type-args "0x29b0681a76b20595201859a5d2b269ae9d1fe98251198cefa513c95267003c0c::mint_test_coin::Coin" --args address:"0x{user}" u128:amount --profile admin
```
- **功能**: 为指定用户提取资金
- **参数**:
  - 用户地址
  - 提取数量
- **权限**: 管理员
- **链上变化**:
  - 金库 USDC 余额减少
  - 用户 USDC 余额增加
  - 用户账户抵押品减少
  - 触发 `WithdrawEvent` 事件

## 关键数据结构

### BatchFill 结构
```move
public struct BatchFill {
    taker: address,      // 买方地址
    maker: address,      // 卖方地址
    market_id: u64,      // 市场ID
    size: u128,          // 交易数量
    price_x: u64,        // 价格（8位小数）
    fee_bps: u64,        // 手续费（基点）
    ts: u64              // 时间戳
}
```

### Position 结构
```move
public struct Position {
    owner: address,           // 持仓者地址
    market_id: u64,           // 市场ID
    size: u128,               // 持仓数量
    is_long: bool,            // 是否多头
    entry_notional: u128,     // 开仓名义价值
    funding_acc: u128,        // 资金费率累计
    last_updated: u64,        // 最后更新时间
}
```

## 事件系统

### 主要事件类型
1. **DepositEvent** - 存款事件
2. **WithdrawEvent** - 提款事件
3. **FillEvent** - 成交事件
4. **PositionUpdateEvent** - 持仓更新事件
5. **PositionCloseEvent** - 平仓事件
6. **FundingEvent** - 资金费率事件
7. **LiquidationEvent** - 清算事件

## 风险控制

### 价格保护
- 交易价格必须在 `min_price` 和 `max_price` 范围内
- 防止价格操纵和异常交易

### 时间保护
- 交易必须在 `expiry` 时间前执行
- 防止过期交易执行

### 抵押品检查
- 交易前检查用户抵押品是否充足
- 维护保证金要求

## 手续费机制

### 手续费计算
- Taker 支付完整手续费
- Maker 获得手续费返佣（通常为 50%）
- 协议保留剩余手续费

### 手续费结构
```move
public struct FeeCalculation {
    taker_fee: u64,      // Taker 手续费
    maker_fee: u64,      // Maker 返佣
    protocol_fee: u64,   // 协议手续费
    total_fee: u64,      // 总手续费
}
```

## 测试和验证

### 运行完整测试
```bash
cd move/contracts/hyperperp
./sh_scripts/complete_trading_test.sh
```

### 验证要点
1. 所有交易成功执行
2. 余额变化正确
3. 持仓状态更新
4. 事件正确触发
5. 链上状态一致

## 注意事项

1. **权限管理**: 大部分操作需要管理员权限
2. **价格精度**: 价格使用 8 位小数，数量使用 6 位小数
3. **时间同步**: 确保时间戳与链上时间同步
4. **资金安全**: 所有资金操作都有相应的权限控制
5. **事件监听**: 建议监听相关事件来跟踪交易状态

## 故障排除

### 常见错误
1. **权限不足**: 确保使用正确的管理员账户
2. **余额不足**: 检查用户是否有足够的 USDC
3. **价格超出范围**: 检查价格是否在保护范围内
4. **交易过期**: 确保在有效时间内执行交易
5. **账户未初始化**: 确保用户账户已创建

### 调试建议
1. 检查交易哈希和状态
2. 查看链上事件日志
3. 验证账户余额和持仓
4. 确认所有模块已正确初始化
