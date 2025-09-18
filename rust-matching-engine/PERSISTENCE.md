# 数据持久化说明

## 📊 数据存储架构

本撮合引擎现在支持双重持久化存储：

### 1. PostgreSQL - 主数据库
- **用途**: 持久化存储所有关键数据
- **存储内容**:
  - 订单数据 (`orders` 表)
  - 交易记录 (`trades` 表)
  - 结算批次 (`settlement_batches` 表)

### 2. Redis - 缓存和实时数据
- **用途**: 高性能缓存和实时数据存储
- **存储内容**:
  - 订单簿缓存 (`orderbook:*`)
  - 订单缓存 (`order:*`)
  - 市场统计 (`market_stats:*`)
  - 最近交易 (`recent_trades:*`)

## 🚀 快速启动

### 1. 启动数据库服务
```bash
# 启动 Redis 和 PostgreSQL
./start.sh

# 或者手动启动
docker-compose up -d postgres redis
```

### 2. 运行撮合引擎
```bash
cargo run
```

### 3. 测试持久化功能
```bash
# 运行持久化测试
cargo run --bin test_persistence
```

## 🔧 配置说明

### 环境变量
```bash
# PostgreSQL 配置
HYPERPERP_DATABASE_URL=postgresql://postgres:password@localhost:5432/hyperperp

# Redis 配置
HYPERPERP_REDIS_URL=redis://localhost:6379
```

### 配置文件 (config.toml)
```toml
[server]
host = "127.0.0.1"
port = 8080

[redis]
url = "redis://127.0.0.1:6379"

[aptos]
node_url = "https://fullnode.testnet.aptoslabs.com/v1"
admin_address = "0xa11ce"
admin_private_key = "your_private_key"
contract_address = "0xc0ffee"
chain_id = 2

[settlement]
batch_size = 10
batch_timeout_secs = 5
max_price_slippage = 0.05
```

## 📈 数据流图

```
用户提交订单
    ↓
REST API 接收
    ↓
撮合引擎处理
    ↓
┌─────────────────┬─────────────────┐
│   PostgreSQL    │      Redis      │
│   (持久化)       │     (缓存)       │
├─────────────────┼─────────────────┤
│ • 订单数据       │ • 订单簿缓存     │
│ • 交易记录       │ • 订单缓存       │
│ • 结算批次       │ • 市场统计       │
│ • 历史数据       │ • 最近交易       │
└─────────────────┴─────────────────┘
    ↓
区块链结算
```

## 🔄 数据同步机制

### 1. 订单数据同步
- **写入**: 同时写入 PostgreSQL 和 Redis
- **读取**: 优先从 Redis 读取，失败时从 PostgreSQL 读取
- **更新**: 同时更新两个存储

### 2. 订单簿缓存
- **TTL**: 1小时自动过期
- **更新**: 每次订单变化时更新缓存
- **恢复**: 服务重启时从 PostgreSQL 恢复

### 3. 市场统计
- **TTL**: 5分钟自动过期
- **更新**: 实时更新统计数据
- **查询**: 快速获取市场概览

## 🛠️ 开发工具

### 1. 数据库管理
```bash
# 连接 PostgreSQL
psql postgresql://postgres:password@localhost:5432/hyperperp

# 连接 Redis
redis-cli -h localhost -p 6379
```

### 2. 监控命令
```bash
# 查看 Redis 缓存
redis-cli keys "*"

# 查看特定市场订单簿
redis-cli get "orderbook:1"

# 查看市场统计
redis-cli get "market_stats:1"
```

### 3. 清理缓存
```bash
# 清理所有缓存
redis-cli flushall

# 清理特定模式
redis-cli --scan --pattern "orderbook:*" | xargs redis-cli del
```

## 🔍 故障排除

### 1. 连接问题
```bash
# 检查服务状态
docker-compose ps

# 查看服务日志
docker-compose logs postgres
docker-compose logs redis
```

### 2. 数据不一致
```bash
# 清理 Redis 缓存，强制从 PostgreSQL 恢复
redis-cli flushall

# 重启撮合引擎
cargo run
```

### 3. 性能问题
```bash
# 监控 Redis 内存使用
redis-cli info memory

# 监控 PostgreSQL 连接
psql -c "SELECT * FROM pg_stat_activity;"
```

## 📊 性能优化建议

### 1. Redis 优化
- 设置合适的内存限制
- 启用持久化 (AOF)
- 使用连接池

### 2. PostgreSQL 优化
- 创建适当的索引
- 配置连接池
- 定期清理历史数据

### 3. 应用优化
- 批量操作减少网络开销
- 异步处理提高并发
- 合理设置 TTL 避免内存泄漏

## 🔐 安全考虑

### 1. 数据库安全
- 使用强密码
- 限制网络访问
- 启用 SSL 连接

### 2. Redis 安全
- 设置密码认证
- 限制命令执行
- 监控异常访问

### 3. 应用安全
- 输入验证
- SQL 注入防护
- 访问控制

## 📚 相关文档

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Redis 官方文档](https://redis.io/documentation)
- [Rust SQLx 文档](https://docs.rs/sqlx/)
- [Rust Redis 文档](https://docs.rs/redis/)

