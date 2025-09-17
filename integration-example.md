# 🔗 HyperPerp Integration Guide

This guide shows how to connect your Rust matching engine with the Move contracts and frontend.

## 🏗️ Complete Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js UI    │◄──►│  Rust Matching  │◄──►│  Move Contracts │
│   (Frontend)    │    │     Engine      │    │   (On-chain)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Wallets  │    │   PostgreSQL    │    │  Aptos Network  │
│   (Petra, etc)  │    │    Database     │    │   (Testnet)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Step-by-Step Integration

### Step 1: Deploy Move Contracts

```bash
cd /Users/chacha/Develop/aptos-dex/move/contracts/hyperperp

# Initialize Aptos profile
aptos init --profile hyperperp-testnet
# Enter your private key when prompted

# Deploy contracts  
aptos move publish --profile hyperperp-testnet

# Note the contract address for later use
```

### Step 2: Generate Move ABI

```bash
# Generate ABI files for the Rust client
aptos move compile --save-metadata
```

### Step 3: Setup Matching Engine

```bash
cd /Users/chacha/Develop/aptos-dex/rust-matching-engine

# Install dependencies
cargo build

# Setup database
docker-compose up -d postgres

# Configure environment
cp .env.example .env
# Edit .env with your deployed contract address and private key

# Start the matching engine
cargo run
```

### Step 4: Update Frontend Integration

Add matching engine client to your Next.js app:

```typescript
// src/lib/matching-engine-client.ts
export class MatchingEngineClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  async submitOrder(order: {
    user_address: string;
    market_id: number;
    side: 'buy' | 'sell';
    order_type: 'market' | 'limit';
    size: string;
    price?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    return response.json();
  }

  async getOrderBook(marketId: number) {
    const response = await fetch(`${this.baseUrl}/orderbook/${marketId}`);
    return response.json();
  }

  async cancelOrder(orderId: string) {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      method: 'POST'
    });
    return response.ok;
  }
}
```

### Step 5: Create Trading Component

```typescript
// src/components/TradingInterface.tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { MatchingEngineClient } from '@/lib/matching-engine-client';

const matchingEngine = new MatchingEngineClient();

export function TradingInterface() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [orderData, setOrderData] = useState({
    side: 'buy' as 'buy' | 'sell',
    size: '',
    price: '',
    orderType: 'limit' as 'market' | 'limit'
  });

  const handleSubmitOrder = async () => {
    if (!account?.address) return;

    try {
      const order = {
        user_address: account.address,
        market_id: 1, // BTC market
        side: orderData.side,
        order_type: orderData.orderType,
        size: orderData.size,
        price: orderData.orderType === 'limit' ? orderData.price : undefined
      };

      const result = await matchingEngine.submitOrder(order);
      console.log('Order submitted:', result);
      
      // If there are immediate trades, they will be settled automatically
      // The settlement service will handle calling the Move contracts
      
    } catch (error) {
      console.error('Failed to submit order:', error);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Place Order</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Side</label>
          <select
            value={orderData.side}
            onChange={(e) => setOrderData(prev => ({
              ...prev,
              side: e.target.value as 'buy' | 'sell'
            }))}
            className="w-full p-2 border rounded"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Order Type</label>
          <select
            value={orderData.orderType}
            onChange={(e) => setOrderData(prev => ({
              ...prev,
              orderType: e.target.value as 'market' | 'limit'
            }))}
            className="w-full p-2 border rounded"
          >
            <option value="limit">Limit</option>
            <option value="market">Market</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Size</label>
          <input
            type="number"
            value={orderData.size}
            onChange={(e) => setOrderData(prev => ({
              ...prev,
              size: e.target.value
            }))}
            placeholder="0.0"
            className="w-full p-2 border rounded"
          />
        </div>

        {orderData.orderType === 'limit' && (
          <div>
            <label className="block text-sm font-medium mb-2">Price</label>
            <input
              type="number"
              value={orderData.price}
              onChange={(e) => setOrderData(prev => ({
                ...prev,
                price: e.target.value
              }))}
              placeholder="0.0"
              className="w-full p-2 border rounded"
            />
          </div>
        )}

        <button
          onClick={handleSubmitOrder}
          disabled={!account}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {account ? 'Submit Order' : 'Connect Wallet'}
        </button>
      </div>
    </div>
  );
}
```

## 🔄 Data Flow

### Order Submission Flow
```
1. User submits order via Next.js UI
2. Frontend calls Rust Matching Engine API
3. Matching Engine stores order in PostgreSQL
4. Matching Engine attempts to match against order book
5. If trades occur, they're queued for settlement
6. Settlement Service batches trades and calls Move contract
7. Move contract updates positions and emits events
8. Frontend listens for events and updates UI
```

### Real-time Updates
```
1. Matching Engine broadcasts trade events
2. Settlement Service confirms blockchain transactions  
3. Indexer picks up on-chain events
4. Frontend subscribes to real-time data via WebSocket
```

## 🧪 Testing the Integration

### Test Order Submission

```bash
# Test matching engine API directly
curl -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "0xa11ce",
    "market_id": 1,
    "side": "buy", 
    "order_type": "limit",
    "size": "10.0",
    "price": "30000.0"
  }'
```

### Test Order Book

```bash
curl http://localhost:8080/orderbook/1
```

### Monitor Settlement

```bash
# Watch logs for settlement activity
cargo run | grep "Settlement"
```

## 🏭 Production Considerations

### Security
- **API Authentication**: Add JWT or API key authentication
- **Rate Limiting**: Prevent spam orders
- **Input Validation**: Validate all order parameters
- **Private Key Management**: Use secure key storage

### Performance
- **Database Optimization**: Index frequently queried columns
- **Caching**: Redis for order book snapshots
- **Load Balancing**: Multiple matching engine instances
- **Connection Pooling**: Optimize database connections

### Monitoring
- **Metrics**: Prometheus metrics for order volume, latency, etc.
- **Alerting**: Alert on settlement failures or high latency
- **Logging**: Structured logs for troubleshooting
- **Health Checks**: Endpoint monitoring

### Deployment
```yaml
# k8s-deployment.yaml
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
    metadata:
      labels:
        app: hyperperp-matching-engine
    spec:
      containers:
      - name: matching-engine
        image: hyperperp/matching-engine:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: hyperperp-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

## 🎯 Next Steps

1. **Enhanced Order Types**: Stop-loss, take-profit, iceberg orders
2. **Market Making**: Automated liquidity provision
3. **Risk Management**: Position limits, margin calls
4. **Analytics**: Trading metrics and reporting
5. **Mobile App**: React Native trading interface

## ❓ Troubleshooting

### Common Issues

**Orders not matching**: Check price precision and market depth
**Settlement failures**: Verify admin account has sufficient gas
**Database errors**: Ensure PostgreSQL is running and accessible
**Aptos connection**: Verify node URL and network configuration

### Debug Commands

```bash
# Check matching engine health
curl http://localhost:8080/health

# View database orders
psql -h localhost -U postgres -d hyperperp -c "SELECT * FROM orders LIMIT 10;"

# Check Aptos account
aptos account lookup-address --profile hyperperp-testnet
```

This integration provides a solid foundation for a production-ready decentralized exchange! 🚀
