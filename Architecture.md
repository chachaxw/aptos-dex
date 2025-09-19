## 系统架构概览

本项目是基于 Aptos 区块链的永续合约交易所，采用**链下撮合 + 链上结算**的混合架构：

- **链下部分**：Rust 匹配引擎处理订单撮合
- **链上部分**：Move 智能合约处理资金管理和仓位结算
- **通信桥梁**：AptosClient 负责链下到链上的数据同步

## 核心模块说明

### 1. 链上模块 (Move)
- `account` - 用户账户和抵押品管理
- `positions` - 仓位管理
- `vault` - 资金托管金库
- `vault_coin` - USDC 代币账本
- `perp_engine` - 永续合约引擎和批量结算
- `market_registry` - 市场参数管理
- `oracle_adapter` - 价格预言机
- `liquidation` - 清算机制
- `events` - 事件系统
- `gov` - 治理和权限管理

### 2. 链下模块 (Rust)
- `matching_engine` - 订单撮合引擎
- `settlement` - 批量结算服务
- `aptos_client` - 区块链交互客户端
- `api` - REST API 接口

## 完整交易流程

### 阶段1：用户开户和充值
```move
// 1. 用户开户
account::open(user: &signer)

// 2. 充值抵押品
vault::deposit<CoinType>(
    user: &signer,
    amount: u64,
    cfg_addr: address
)
```

**接口参数：**
- `user`: 用户签名者
- `amount`: 充值数量
- `cfg_addr`: 配置地址

### 阶段2：下单流程

#### 2.1 直接下单（服务端冻结资金）
```http
POST /api/orders
Content-Type: application/json

{
    "user_address": "0x...",
    "market_id": 1,
    "side": "buy|sell",
    "order_type": "market|limit",
    "size": "100.0",
    "price": "50000.0",  // 限价单必填
    "expires_at": "2024-01-01T00:00:00Z"
}
```

#### 2.2 用户签名下单（推荐）
```http
// Step 1: 请求冻结交易载荷
POST /api/orders/freeze
{
    "user_address": "0x...",
    "market_id": 1,
    "side": "buy",
    "order_type": "limit",
    "size": "100.0",
    "price": "50000.0",
    "expires_at": "2024-01-01T00:00:00Z"
}

// 返回冻结交易载荷
{
    "order_id": "uuid",
    "freeze_transaction_payload": {
        "function": "0x...::vault_coin::deposit",
        "type_arguments": ["0x29b0...::mint_test_coin::Coin"],
        "arguments": ["0x...", "1000000000"],
        "gas_limit": 100000,
        "gas_unit_price": 100
    },
    "required_collateral": 1000000,
    "message": "Please sign the freeze transaction..."
}

// Step 2: 确认订单
POST /api/orders/confirm
{
    "order_id": "uuid",
    "signed_transaction_hash": "0x..."
}
```

### 阶段3：订单撮合（链下）
匹配引擎自动处理：
- 价格优先、时间优先撮合
- 生成成交记录 (Trade)
- 更新订单状态

### 阶段4：批量结算（链上）
```move
// 批量结算接口
perp_engine::apply_batch(
    admin: &signer,
    batch: SettlementBatch,
    events_addr: address
)
```

**SettlementBatch 结构：**
```move
struct SettlementBatch {
    fills: vector<BatchFill>,
    oracle_ts: u64,
    min_px: u64,
    max_px: u64,
    expiry: u64
}

struct BatchFill {
    taker: address,
    maker: address,
    market_id: u64,
    size: u128,
    price_x: u64,
    fee_bps: u64,
    ts: u64
}
```

### 阶段5：仓位管理
```move
// 获取仓位信息
perp_engine::get_position_info(
    owner: address,
    market_id: u64
): (u128, u128, u128)  // (size, entry_notional, funding_acc)

// 检查仓位是否存在
perp_engine::position_exists(
    owner: address,
    market_id: u64
): bool
```

### 阶段6：资金管理
```move
// 提取资金
vault::withdraw_to<CoinType>(
    caller: &signer,
    recipient: address,
    amount: u64,
    cfg_addr: address
)

// 管理员提取
vault::admin_sweep<CoinType>(
    admin: &signer,
    amount: u64,
    cfg_addr: address
)
```

## 关键接口参数详解

### 订单相关
- `market_id`: 市场ID（如 BTC-PERP = 1）
- `side`: 买卖方向（"buy" | "sell"）
- `order_type`: 订单类型（"market" | "limit"）
- `size`: 订单数量（Decimal 字符串）
- `price`: 限价单价格（Decimal 字符串）
- `expires_at`: 过期时间（ISO 8601 格式）

### 仓位相关
- `owner`: 用户地址
- `market_id`: 市场ID
- `size`: 仓位大小（u128）
- `is_long`: 是否多头（bool）
- `entry_notional`: 开仓名义价值（u128）
- `funding_acc`: 资金费率累积（u128）

### 价格相关
- `price_x`: 定点价格（u64，需要除以 px_scale）
- `px_scale`: 价格精度（1e8）
- `oracle_ts`: 预言机时间戳（u64）
- `min_px/max_px`: 价格边界（防滑点保护）

### 费用相关
- `fee_bps`: 手续费基点（u64）
- `taker_fee`: 吃单方手续费（u64）
- `maker_fee`: 做单方手续费（u64）
- `protocol_fee`: 协议手续费（u64）

## 管理员功能

### 市场管理
```move
// 添加市场
market_registry::add_market(
    admin: &signer,
    symbol: vector<u8>,      // "BTC-PERP"
    imr_bps: u64,           // 初始保证金率（基点）
    mmr_bps: u64,           // 维持保证金率（基点）
    lot: u64,               // 最小交易单位
    tick: u64,              // 最小价格变动
    max_leverage_x: u64     // 最大杠杆倍数
): u64  // 返回市场ID
```

### 价格管理
```move
// 推送价格
oracle_adapter::push_price(
    admin: &signer,
    market_id: u64,
    px: u64,        // 价格
    conf: u64,      // 置信度
    ts: u64         // 时间戳
)
```

### 治理功能
```move
// 暂停功能
gov::set_pause(
    admin: &signer,
    mask: u64,      // 暂停位掩码
    on: bool        // 是否暂停
)

// 添加管理员
gov::add_admin(
    admin: &signer,
    new_member: address
)
```

## 事件系统

系统会发出以下关键事件：
- `DepositEvent` - 充值事件
- `WithdrawEvent` - 提取事件
- `FillEvent` - 成交事件
- `PositionUpdateEvent` - 仓位更新事件
- `PositionCloseEvent` - 仓位平仓事件
- `LiquidationEvent` - 清算事件
- `FundingEvent` - 资金费率事件

## 风险控制

### 清算机制
```move
liquidation::liquidate(
    caller: &signer,
    victim: address,
    market_id: u64,
    px: u64,
    events_addr: address
)
```

### 风险检查
```move
perp_engine::check_trade_risk(
    owner: address,
    market_id: u64,
    size: u128,
    price: u64
): bool
```

这个系统设计完整，支持完整的永续合约交易流程，包括订单管理、撮合、结算、风险控制等核心功能。