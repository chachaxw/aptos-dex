# HyperPerp Rust Matching Engine

A high-performance off-chain matching engine that integrates with HyperPerp Move contracts on Aptos.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Users/Bots    │───►│  Rust Matching  │───►│  Move Contracts │
│   Submit Orders │    │     Engine      │    │   Settlement    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │    Database     │
                       └─────────────────┘
```

## ✨ Features

- **High-Performance Order Matching**: In-memory order book with price-time priority
- **Batch Settlement**: Groups trades into settlement batches for gas efficiency
- **Real-time API**: REST API for order submission, cancellation, and order book data
- **Database Persistence**: PostgreSQL for order and trade history
- **Aptos Integration**: Direct integration with HyperPerp Move contracts
- **Event Broadcasting**: Real-time trade events via channels
- **Error Recovery**: Robust error handling and settlement retry logic

## 🚀 Quick Start

### Prerequisites

1. **PostgreSQL Database**
```bash
# Install PostgreSQL
brew install postgresql
brew services start postgresql

# Create database
createdb hyperperp
```

2. **Rust Environment**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

3. **Aptos CLI** (for contract deployment)
```bash
pip3 install aptos-cli
```

### Setup

1. **Clone and Build**
```bash
git clone <your-repo>
cd rust-matching-engine
cargo build --release
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Run Database Migrations**
Migrations run automatically on first startup.

4. **Deploy Move Contracts**
```bash
cd ../move/contracts/hyperperp
aptos move publish --profile hyperperp-testnet
```

5. **Start the Matching Engine**
```bash
cargo run
```

## 📡 API Reference

### Submit Order
```bash
POST /orders
Content-Type: application/json

{
  "user_address": "0xa11ce",
  "market_id": 1,
  "side": "buy",
  "order_type": "limit",
  "size": "10.0",
  "price": "30000.0"
}
```

### Cancel Order
```bash
POST /orders/{order_id}
```

### Get Order Book
```bash
GET /orderbook/{market_id}
```

Response:
```json
{
  "market_id": 1,
  "bids": [
    {"price": "29950.0", "size": "5.0", "order_count": 2},
    {"price": "29900.0", "size": "10.0", "order_count": 1}
  ],
  "asks": [
    {"price": "30050.0", "size": "3.0", "order_count": 1},
    {"price": "30100.0", "size": "7.0", "order_count": 3}
  ],
  "last_updated": "2024-01-01T12:00:00Z"
}
```

## 🔄 Integration Flow

### 1. Order Submission
```
User → REST API → Matching Engine → Database
                       ↓
                   Order Matching
                       ↓
                   Trade Creation
```

### 2. Settlement Process
```
Pending Trades → Settlement Batches → Move Contract → Blockchain
                        ↓
                   Database Update
                        ↓
                  Position Updates
```

### 3. Move Contract Integration

The matching engine calls your deployed `perp_engine::apply_batch` function:

```move
public fun apply_batch(
    admin: &signer, 
    batch: SettlementBatch, 
    events_addr: address
) {
    // Validates and applies trades
    // Updates user positions
    // Emits events
}
```

## 🛠️ Configuration

### Environment Variables

```bash
# Server
HYPERPERP_SERVER__HOST=127.0.0.1
HYPERPERP_SERVER__PORT=8080

# Database
HYPERPERP_DATABASE_URL=postgresql://postgres:password@localhost:5432/hyperperp

# Aptos
HYPERPERP_APTOS__NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
HYPERPERP_APTOS__ADMIN_ADDRESS=0xa11ce
HYPERPERP_APTOS__ADMIN_PRIVATE_KEY=0x123...
HYPERPERP_APTOS__CONTRACT_ADDRESS=0xc0ffee
HYPERPERP_APTOS__CHAIN_ID=2

# Settlement
HYPERPERP_SETTLEMENT__BATCH_SIZE=10
HYPERPERP_SETTLEMENT__BATCH_TIMEOUT_SECS=5
HYPERPERP_SETTLEMENT__MAX_PRICE_SLIPPAGE=0.05
```

### Config File (config.toml)

Alternative to environment variables:

```toml
[server]
host = "127.0.0.1"
port = 8080

[aptos]
node_url = "https://fullnode.testnet.aptoslabs.com/v1"
admin_address = "0xa11ce"
# ... etc
```

## 📊 Database Schema

### Orders Table
- `id` (UUID): Unique order ID
- `user_address` (TEXT): User's wallet address
- `market_id` (BIGINT): Market identifier
- `side` (ENUM): 'buy' or 'sell'
- `order_type` (ENUM): 'market' or 'limit'
- `size` (DECIMAL): Order size
- `price` (DECIMAL): Order price (null for market orders)
- `filled_size` (DECIMAL): Amount filled
- `status` (ENUM): Order status
- Timestamps and expiration

### Trades Table
- `id` (UUID): Unique trade ID
- Trade details (taker/maker, size, price)
- `settlement_batch_id` (UUID): Link to settlement batch

### Settlement Batches Table
- `id` (UUID): Unique batch ID
- Oracle timestamp and price bounds
- Settlement status and transaction hash

## 🔧 Development

### Adding New Markets

1. **Register Market in Move Contract**
```move
// In your Move contract initialization
market_registry::add_market(
    admin, 
    b"BTC-USD", 
    5000,  // IMR BPS
    4000,  // MMR BPS
    1,     // lot size
    1,     // tick size
    20     // max leverage
);
```

2. **No Changes Needed in Rust**: The matching engine automatically supports new market IDs.

### Custom Order Types

Extend the `OrderType` enum in `models.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "order_type", rename_all = "lowercase")]
pub enum OrderType {
    Market,
    Limit,
    StopLoss,    // New type
    TakeProfit,  // New type
}
```

### Performance Tuning

- **Batch Size**: Increase `batch_size` for higher throughput
- **Timeout**: Decrease `batch_timeout_secs` for faster settlement
- **Database**: Use connection pooling and read replicas
- **Caching**: Add Redis for order book caching

## 🧪 Testing

```bash
# Unit tests
cargo test

# Integration tests with local Aptos node
cargo test --test integration

# Load testing
cargo test --test load_test --release
```

## 🚀 Production Deployment

### Using Docker

```dockerfile
FROM rust:1.75 as builder
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /target/release/hyperperp-matching-engine /usr/local/bin/
CMD ["hyperperp-matching-engine"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hyperperp-matching-engine
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hyperperp-matching-engine
  template:
    spec:
      containers:
      - name: matching-engine
        image: hyperperp/matching-engine:latest
        env:
        - name: HYPERPERP_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

## 📈 Monitoring

The engine exposes metrics at `/health` endpoint and logs structured data for monitoring:

```bash
curl http://localhost:8080/health
```

Use with Prometheus, Grafana, or your monitoring solution of choice.

## 🔐 Security Considerations

- **Private Keys**: Store admin private keys securely (HashiCorp Vault, AWS Secrets Manager)
- **Access Control**: Use authentication middleware for API endpoints
- **Rate Limiting**: Implement rate limiting to prevent abuse
- **Input Validation**: All user inputs are validated and sanitized
- **Database Security**: Use connection encryption and proper access controls

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.
