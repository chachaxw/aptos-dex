# 配置总结

## ✅ 当前配置状态

### 数据库连接
- **PostgreSQL**: ✅ 已连接
  - 主机: `localhost:5432`
  - 数据库: `orderbook`
  - 用户: `postgres`
  - 密码: `password`
  - 连接字符串: `postgresql://postgres:password@localhost:5432/orderbook`

- **Redis**: ✅ 已连接
  - 主机: `localhost:6379`
  - 连接字符串: `redis://localhost:6379`

### 配置文件 (config.toml)
```toml
[server]
host = "127.0.0.1"
port = 8080

[database]
url = "postgresql://postgres:password@localhost:5432/orderbook"

[redis]
url = "redis://127.0.0.1:6379"

[aptos]
node_url = "https://fullnode.testnet.aptoslabs.com/v1"
admin_address = "0xf088abc10dd7dbc83f95cd621fa85964a8f5d7efecf10272fb2cc6a909b8e647"
admin_private_key = "ed25519-priv-0xc919a81b08fd79a13936d4c8cde5aef42c79b4bf4b9493c7d9915758bf07ddfb"
contract_address = "0xf088abc10dd7dbc83f95cd621fa85964a8f5d7efecf10272fb2cc6a909b8e647"
chain_id = 2

[settlement]
batch_size = 10
batch_timeout_secs = 5
max_price_slippage = 0.05
```

## 🚀 启动步骤

### 1. 检查服务状态
```bash
./check_connections.sh
```

### 2. 运行撮合引擎
```bash
cargo run
```

### 3. 测试 API
```bash
# 健康检查
curl http://localhost:8080/health

# 获取订单簿
curl http://localhost:8080/orderbook/1
```

## 📊 数据存储架构

```
┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │
│   (主数据库)     │    │     (缓存)       │
├─────────────────┤    ├─────────────────┤
│ • 订单数据       │    │ • 订单簿缓存     │
│ • 交易记录       │    │ • 订单缓存       │
│ • 结算批次       │    │ • 市场统计       │
│ • 历史数据       │    │ • 最近交易       │
└─────────────────┘    └─────────────────┘
```

## 🔧 环境变量支持

你也可以通过环境变量覆盖配置：

```bash
export HYPERPERP_DATABASE__URL="postgresql://postgres:password@localhost:5432/orderbook"
export HYPERPERP_REDIS__URL="redis://localhost:6379"
export HYPERPERP_SERVER__HOST="0.0.0.0"
export HYPERPERP_SERVER__PORT="8080"
```

## 🛠️ 故障排除

### 如果连接失败：

1. **检查 Docker 容器状态**:
   ```bash
   docker ps
   ```

2. **重启服务**:
   ```bash
   docker restart orderbook-postgres orderbook-redis
   ```

3. **查看日志**:
   ```bash
   docker logs orderbook-postgres
   docker logs orderbook-redis
   ```

4. **测试连接**:
   ```bash
   ./check_connections.sh
   ```

## 📈 性能监控

### PostgreSQL 监控
```bash
# 连接数
docker exec orderbook-postgres psql -U postgres -d orderbook -c "SELECT count(*) FROM pg_stat_activity;"

# 数据库大小
docker exec orderbook-postgres psql -U postgres -d orderbook -c "SELECT pg_size_pretty(pg_database_size('orderbook'));"
```

### Redis 监控
```bash
# 内存使用
docker exec orderbook-redis redis-cli info memory

# 键数量
docker exec orderbook-redis redis-cli dbsize
```

## 🔐 安全建议

1. **生产环境**:
   - 更改默认密码
   - 启用 SSL 连接
   - 限制网络访问

2. **开发环境**:
   - 当前配置适合开发测试
   - 数据存储在 Docker 卷中

## 📚 相关文档

- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [Redis 文档](https://redis.io/documentation)
- [Rust SQLx 文档](https://docs.rs/sqlx/)
- [Rust Redis 文档](https://docs.rs/redis/)

