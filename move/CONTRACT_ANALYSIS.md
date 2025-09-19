# HyperPerp Move合约架构分析

## 概述

HyperPerp是一个基于Aptos区块链的去中心化永续合约交易平台。本文档详细分析了所有Move合约的职责、方法以及它们之间的调用关系。

## 1. 核心合约职责分析

### 1.1 account.move - 用户账户管理
**职责**: 管理用户的交易账户，包括抵押品、未结算PnL、持仓等

**数据结构**:
```move
public struct Account has key {
    owner: address,
    collateral: u64,
    unsettled_pnl: u128,
    last_funding_ts: u64,
    positions: table::Table<u64, address>,
}
```

**主要方法**:
- `open(user: &signer)`: 为用户创建交易账户
- `add_collateral(addr: address, amount: u64)`: 增加抵押品
- `sub_collateral(addr: address, amount: u64)`: 减少抵押品
- `get_collateral(addr: address): u64`: 获取抵押品余额

### 1.2 positions.move - 持仓管理
**职责**: 管理用户的永续合约持仓

**数据结构**:
```move
public struct Position has key, drop, store {
    owner: address,
    market_id: u64,
    size: u128,
    is_long: bool,
    entry_notional: u128,
    funding_acc: u128,
    last_updated: u64,
}
```

**主要方法**:
- `initialize(owner: &signer)`: 初始化用户持仓注册表
- `get_position(owner: address, market_id: u64)`: 获取持仓信息
- `add_size(position: &mut Position, size_delta: u128, is_long: bool)`: 更新持仓大小
- `close_position(position: &mut Position)`: 关闭持仓
- `update_entry_notional(position: &mut Position, notional: u128)`: 更新入场名义价值

### 1.3 perp_engine.move - 永续合约引擎
**职责**: 核心交易引擎，处理订单匹配、结算、费用计算

**数据结构**:
```move
public struct BatchFill has drop, store, copy { 
    taker: address, 
    maker: address, 
    market_id: u64, 
    size: u128, 
    price_x: u64, 
    fee_bps: u64, 
    ts: u64 
}

public struct SettlementBatch has drop, store, copy { 
    fills: vector<BatchFill>, 
    oracle_ts: u64, 
    min_px: u64, 
    max_px: u64, 
    expiry: u64 
}
```

**主要方法**:
- `apply_batch(admin: &signer, batch: SettlementBatch, events_addr: address)`: 批量处理交易
- `apply_fill(owner: address, market_id: u64, size_delta: u128, px: u64, is_long: bool, events_addr: address)`: 处理单个成交
- `calculate_fees(size: u128, price_x: u64, fee_bps: u64)`: 计算交易费用
- `close_position(owner: address, market_id: u64, close_price: u64, events_addr: address)`: 关闭持仓
- `check_trade_risk(owner: address, market_id: u64, size: u128, price: u64)`: 风险检查

### 1.4 vault.move - 资金库管理
**职责**: 管理用户资金存取和协议资金库

**主要方法**:
- `init<T>(cfg_owner: &signer, vault_owner: &signer, min_deposit: u64)`: 初始化资金库
- `deposit<T>(user: &signer, amount: u64, cfg_addr: address)`: 用户存款
- `withdraw_to<T>(caller: &signer, recipient: address, amount: u64, cfg_addr: address)`: 白名单提款
- `admin_sweep<T>(admin: &signer, amount: u64, cfg_addr: address)`: 管理员紧急提取

### 1.5 vault_coin.move - 代币资金管理
**职责**: 管理USDC代币的内部账本和转账

**主要方法**:
- `init_ledger(admin: &signer)`: 初始化USDC账本
- `deposit<CoinType>(user: &signer, admin_addr: address, amount: u128)`: 代币存款
- `withdraw_for<CoinType>(admin: &signer, to: address, amount: u128)`: 代币提款
- `transfer_internal(admin: &signer, from: address, to: address, amount: u128)`: 内部转账

## 2. 辅助合约职责

### 2.1 market_registry.move - 市场注册
**职责**: 管理交易市场配置

**主要方法**:
- `init(admin: &signer)`: 初始化市场注册表
- `add_market(admin: &signer, symbol: vector<u8>, imr_bps: u64, mmr_bps: u64, lot: u64, tick: u64, max_leverage_x: u64)`: 添加新市场

### 2.2 oracle_adapter.move - 价格预言机
**职责**: 管理价格数据

**主要方法**:
- `init(admin: &signer, staleness_secs: u64)`: 初始化价格缓存
- `push_price(admin: &signer, market_id: u64, px: u64, conf: u64, ts: u64)`: 推送价格
- `read_price(cfg_addr: address, market_id: u64, now_ts: u64)`: 读取价格

### 2.3 risk.move - 风险管理
**职责**: 检查保证金要求

**主要方法**:
- `check_maintenance(collateral: u64, pos_size: u128, px: u64)`: 检查维持保证金

### 2.4 liquidation.move - 清算管理
**职责**: 处理用户清算

**主要方法**:
- `liquidate(_caller: &signer, victim: address, market_id: u64, px: u64, events_addr: address)`: 执行清算

### 2.5 gov.move - 治理管理
**职责**: 管理管理员权限和暂停机制

**主要方法**:
- `init_admins(creator: &signer, members: vector<address>)`: 初始化管理员
- `set_pause(admin: &signer, mask: u64, on: bool)`: 设置暂停状态
- `is_admin(s: &signer): bool`: 检查管理员权限

## 3. 工具合约

### 3.1 events.move - 事件管理
**职责**: 定义和发出各种交易事件

**事件类型**:
- `DepositEvent`: 存款事件
- `WithdrawEvent`: 提款事件
- `FillEvent`: 成交事件
- `FundingEvent`: 资金费率事件
- `LiquidationEvent`: 清算事件
- `PositionUpdateEvent`: 持仓更新事件
- `PositionCloseEvent`: 持仓关闭事件

### 3.2 errors.move - 错误码管理
**职责**: 定义各种错误码

**主要错误码**:
- `E_NOT_INITIALIZED`: 未初始化
- `E_ALREADY_INITIALIZED`: 已初始化
- `E_UNAUTHORIZED`: 未授权
- `E_PAUSED`: 已暂停
- `E_INSUFFICIENT_MARGIN`: 保证金不足
- `E_PRICE_OUT_OF_BOUNDS`: 价格超出范围
- `E_ORACLE_STALE`: 预言机数据过期

### 3.3 constants.move - 常量定义
**职责**: 定义系统常量

**主要常量**:
- `PX_SCALE`: 价格精度 (1e8)
- `RATE_SCALE`: 费率精度 (1e8)
- `BPS_SCALE`: 基点精度 (10000)
- `USDC_DECIMALS`: USDC精度 (6)

### 3.4 config.move - 配置管理
**职责**: 管理系统配置

### 3.5 fee.move - 费用管理
**职责**: 管理交易费用参数

## 4. 合约调用链路分析

### 4.1 交易流程调用链路
```
用户发起交易
    ↓
perp_engine::apply_batch()
    ↓
perp_engine::apply_fill()
    ↓
positions::add_size() / positions::update_entry_notional()
    ↓
account::add_collateral() / account::sub_collateral()
    ↓
vault_coin::transfer_internal()
    ↓
events::emit_fill() / events::emit_position_update()
```

### 4.2 存款流程调用链路
```
用户存款
    ↓
vault::deposit()
    ↓
account::add_collateral()
    ↓
vault_coin::deposit()
    ↓
events::emit_deposit()
```

### 4.3 提款流程调用链路
```
用户提款
    ↓
vault::withdraw_to()
    ↓
gov::is_withdrawer() (权限检查)
    ↓
account::sub_collateral()
    ↓
vault_coin::withdraw_for()
    ↓
events::emit_withdraw()
```

### 4.4 清算流程调用链路
```
触发清算
    ↓
liquidation::liquidate()
    ↓
risk::check_maintenance()
    ↓
positions::get_position_size()
    ↓
perp_engine::close_position()
    ↓
events::emit_liq()
```

### 4.5 风险管理调用链路
```
交易前检查
    ↓
perp_engine::check_trade_risk()
    ↓
risk::check_maintenance()
    ↓
account::get_collateral()
    ↓
positions::get_position()
```

## 5. 系统架构特点

### 5.1 模块化设计
- 每个合约负责特定功能领域
- 松耦合的模块间通信
- 清晰的职责分离

### 5.2 权限管理
- 多级权限控制（管理员、白名单用户）
- 暂停机制保护系统安全
- 细粒度的操作权限

### 5.3 风险管理
- 实时保证金检查
- 自动清算机制
- 价格边界验证

### 5.4 事件驱动
- 完整的事件记录
- 链上状态追踪
- 外部系统集成

## 6. 总结

HyperPerp系统通过模块化的Move合约设计，实现了一个完整的去中心化永续合约交易平台。系统包含用户账户管理、持仓管理、交易引擎、资金管理、风险管理、清算机制等核心功能，通过清晰的调用链路和事件机制，确保了系统的安全性和可扩展性。

这种设计模式为其他DeFi项目提供了很好的参考，展示了如何在Aptos区块链上构建复杂的金融应用。
