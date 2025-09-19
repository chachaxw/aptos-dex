# HyperPerp Matching Engine API Documentation

## 概述

HyperPerp Matching Engine 是一个基于 Rust 的高性能订单撮合引擎，提供 RESTful API 接口用于订单管理、市场数据查询等功能。

**基础信息：**
- 服务地址：`http://127.0.0.1:8080`
- 协议：HTTP/HTTPS
- 数据格式：JSON
- 字符编码：UTF-8

## 通用响应格式

### 成功响应
```json
{
  "status": "success",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 错误响应
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request parameters"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## API 接口

### 1. 市场信息查询

#### 1.1 获取所有市场信息

获取所有可用的交易市场信息。

**接口信息：**
- **URL：** `GET /markets`
- **描述：** 获取所有可用的交易市场列表
- **认证：** 无需认证

**响应示例：**
```json
[
  {
    "market_id": 1,
    "symbol": "BTC/USDC",
    "base_token": "BTC",
    "quote_token": "USDC"
  },
  {
    "market_id": 2,
    "symbol": "ETH/USDC",
    "base_token": "ETH",
    "quote_token": "USDC"
  },
  {
    "market_id": 3,
    "symbol": "SOL/USDC",
    "base_token": "SOL",
    "quote_token": "USDC"
  }
]
```

#### 1.2 根据市场ID查询市场信息

根据指定的市场ID获取单个市场信息。

**接口信息：**
- **URL：** `GET /markets/{market_id}`
- **描述：** 根据市场ID获取特定市场信息
- **认证：** 无需认证
- **路径参数：**
  - `market_id` (u64): 市场ID

**响应示例：**
```json
{
  "market_id": 3,
  "symbol": "SOL/USDC",
  "base_token": "SOL",
  "quote_token": "USDC"
}
```

**错误响应：**
- `404 Not Found`: 市场不存在

### 2. 健康检查

检查服务状态和可用性。

**接口信息：**
- **URL：** `GET /health`
- **描述：** 检查匹配引擎服务是否正常运行
- **认证：** 无需认证

**响应示例：**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "service": "hyperperp-matching-engine"
}
```

**cURL 示例：**
```bash
curl -X GET "http://127.0.0.1:8080/health" \
  -H "Content-Type: application/json"
```

---

### 2. 提交订单

提交新的买卖订单到撮合引擎。

**接口信息：**
- **URL：** `POST /orders`
- **描述：** 提交订单到撮合引擎进行匹配
- **认证：** 无需认证

**请求参数：**
```json
{
  "user_address": "0x1234567890abcdef1234567890abcdef12345678",
  "market_id": 1,
  "side": "buy",
  "order_type": "limit",
  "size": "100.50",
  "price": "50000.00",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**参数说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_address | string | 是 | 用户钱包地址 |
| market_id | number | 是 | 市场ID |
| side | string | 是 | 订单方向：`buy` 或 `sell` |
| order_type | string | 是 | 订单类型：`market` 或 `limit` |
| size | string | 是 | 订单数量（字符串格式的十进制数） |
| price | string | 否 | 订单价格（限价单必填，市价单不填） |
| expires_at | string | 否 | 订单过期时间（ISO 8601格式） |

**响应示例：**
```json
{
  "order": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_address": "0x1234567890abcdef1234567890abcdef12345678",
    "market_id": 1,
    "side": "buy",
    "order_type": "limit",
    "size": "100.50",
    "price": "50000.00",
    "filled_size": "0.00",
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "expires_at": "2024-12-31T23:59:59Z"
  },
  "trades": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "market_id": 1,
      "taker_order_id": "550e8400-e29b-41d4-a716-446655440000",
      "maker_order_id": "550e8400-e29b-41d4-a716-446655440002",
      "taker_address": "0x1234567890abcdef1234567890abcdef12345678",
      "maker_address": "0x9876543210fedcba9876543210fedcba98765432",
      "size": "50.25",
      "price": "50000.00",
      "side": "buy",
      "created_at": "2024-01-01T00:00:00Z",
      "settlement_batch_id": null
    }
  ]
}
```

**cURL 示例：**

**限价买单：**
```bash
curl -X POST "http://127.0.0.1:8080/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "0x1234567890abcdef1234567890abcdef12345678",
    "market_id": 1,
    "side": "buy",
    "order_type": "limit",
    "size": "100.50",
    "price": "50000.00",
    "expires_at": "2024-12-31T23:59:59Z"
  }'
```

**市价卖单：**
```bash
curl -X POST "http://127.0.0.1:8080/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "0x1234567890abcdef1234567890abcdef12345678",
    "market_id": 1,
    "side": "sell",
    "order_type": "market",
    "size": "50.00"
  }'
```

---

### 3. 取消订单

取消指定的订单。

**接口信息：**
- **URL：** `POST /orders/{order_id}`
- **描述：** 取消指定的订单
- **认证：** 无需认证

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| order_id | string | 是 | 订单ID（UUID格式） |

**响应状态码：**
- `200 OK` - 订单取消成功
- `404 Not Found` - 订单不存在或已无法取消
- `500 Internal Server Error` - 服务器内部错误

**cURL 示例：**
```bash
curl -X POST "http://127.0.0.1:8080/orders/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json"
```

---

### 4. 获取订单簿

获取指定市场的订单簿信息。

**接口信息：**
- **URL：** `GET /orderbook/{market_id}`
- **描述：** 获取指定市场的订单簿
- **认证：** 无需认证

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| market_id | number | 是 | 市场ID |

**响应示例：**
```json
{
  "market_id": 1,
  "bids": [
    {
      "price": "50100.00",
      "size": "150.75",
      "order_count": 3
    },
    {
      "price": "50000.00",
      "size": "200.50",
      "order_count": 5
    }
  ],
  "asks": [
    {
      "price": "50200.00",
      "size": "100.25",
      "order_count": 2
    },
    {
      "price": "50300.00",
      "size": "75.00",
      "order_count": 1
    }
  ],
  "last_updated": "2024-01-01T00:00:00Z"
}
```

**响应字段说明：**
| 字段 | 类型 | 说明 |
|------|------|------|
| market_id | number | 市场ID |
| bids | array | 买单队列（按价格从高到低排序） |
| asks | array | 卖单队列（按价格从低到高排序） |
| last_updated | string | 最后更新时间 |

**订单簿层级字段：**
| 字段 | 类型 | 说明 |
|------|------|------|
| price | string | 价格 |
| size | string | 总数量 |
| order_count | number | 订单数量 |

**cURL 示例：**
```bash
curl -X GET "http://127.0.0.1:8080/orderbook/1" \
  -H "Content-Type: application/json"
```

---

### 5. 查询交易记录

查询指定市场的历史交易记录。

**接口信息：**
- **URL：** `GET /trades/{market_id}?limit=50`
- **描述：** 获取指定市场的交易记录
- **认证：** 无需认证

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| market_id | number | 是 | 市场ID |

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回记录数量限制（默认50，最大1000） |

**响应示例：**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "market_id": 1,
    "taker_order_id": "550e8400-e29b-41d4-a716-446655440001",
    "maker_order_id": "550e8400-e29b-41d4-a716-446655440002",
    "taker_address": "0x1234567890abcdef1234567890abcdef12345678",
    "maker_address": "0x9876543210fedcba9876543210fedcba98765432",
    "size": "100.50",
    "price": "50000.00",
    "side": "buy",
    "created_at": "2024-01-01T00:00:00Z",
    "settlement_batch_id": null
  }
]
```

**cURL 示例：**
```bash
curl -X GET "http://127.0.0.1:8080/trades/1?limit=100" \
  -H "Content-Type: application/json"
```

---

### 6. 查询用户交易记录

查询指定用户的历史交易记录。

**接口信息：**
- **URL：** `GET /trades/user/{user_address}?limit=50`
- **描述：** 获取指定用户的交易记录
- **认证：** 无需认证

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_address | string | 是 | 用户钱包地址 |

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回记录数量限制（默认50，最大1000） |

**响应格式：** 与市场交易记录相同

**cURL 示例：**
```bash
curl -X GET "http://127.0.0.1:8080/trades/user/0x1234567890abcdef1234567890abcdef12345678" \
  -H "Content-Type: application/json"
```

---

### 7. 查询特定交易

根据交易ID查询特定交易的详细信息。

**接口信息：**
- **URL：** `GET /trades/trade/{trade_id}`
- **描述：** 获取特定交易的详细信息
- **认证：** 无需认证

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| trade_id | string | 是 | 交易ID（UUID格式） |

**响应示例：**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "market_id": 1,
  "taker_order_id": "550e8400-e29b-41d4-a716-446655440001",
  "maker_order_id": "550e8400-e29b-41d4-a716-446655440002",
  "taker_address": "0x1234567890abcdef1234567890abcdef12345678",
  "maker_address": "0x9876543210fedcba9876543210fedcba98765432",
  "size": "100.50",
  "price": "50000.00",
  "side": "buy",
  "created_at": "2024-01-01T00:00:00Z",
  "settlement_batch_id": null
}
```

**响应状态码：**
- `200 OK` - 查询成功
- `400 Bad Request` - 交易ID格式错误
- `404 Not Found` - 交易不存在
- `500 Internal Server Error` - 服务器内部错误

**cURL 示例：**
```bash
curl -X GET "http://127.0.0.1:8080/trades/trade/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json"
```

---

### 8. 查询用户订单

查询指定用户的所有订单。

**接口信息：**
- **URL：** `GET /orders/user/{user_address}?status=pending&limit=50`
- **描述：** 获取指定用户的订单列表
- **认证：** 无需认证

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_address | string | 是 | 用户钱包地址 |

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 订单状态过滤（pending, partially_filled, filled, cancelled, expired） |
| limit | number | 否 | 返回记录数量限制（默认50，最大1000） |

**响应示例：**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_address": "0x1234567890abcdef1234567890abcdef12345678",
    "market_id": 1,
    "side": "buy",
    "order_type": "limit",
    "size": "100.50",
    "price": "50000.00",
    "filled_size": "50.25",
    "status": "partially_filled",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:05:00Z",
    "expires_at": "2024-12-31T23:59:59Z"
  }
]
```

**cURL 示例：**
```bash
curl -X GET "http://127.0.0.1:8080/orders/user/0x1234567890abcdef1234567890abcdef12345678?status=pending" \
  -H "Content-Type: application/json"
```

---

### 9. 查询订单状态

根据订单ID查询特定订单的当前状态。

**接口信息：**
- **URL：** `GET /orders/{order_id}`
- **描述：** 获取特定订单的详细信息
- **认证：** 无需认证

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| order_id | string | 是 | 订单ID（UUID格式） |

**响应示例：**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_address": "0x1234567890abcdef1234567890abcdef12345678",
  "market_id": 1,
  "side": "buy",
  "order_type": "limit",
  "size": "100.50",
  "price": "50000.00",
  "filled_size": "50.25",
  "status": "partially_filled",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:05:00Z",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**响应状态码：**
- `200 OK` - 查询成功
- `400 Bad Request` - 订单ID格式错误
- `404 Not Found` - 订单不存在
- `500 Internal Server Error` - 服务器内部错误

**cURL 示例：**
```bash
curl -X GET "http://127.0.0.1:8080/orders/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json"
```

---

### 10. 获取市场数据

获取指定市场的统计数据和市场信息。

**接口信息：**
- **URL：** `GET /market/{market_id}/data`
- **描述：** 获取指定市场的统计数据
- **认证：** 无需认证

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| market_id | number | 是 | 市场ID |

**响应示例：**
```json
{
  "market_id": 1,
  "last_price": "50000.00",
  "volume_24h": "1500000.50",
  "price_change_24h": "2.5",
  "high_24h": "51000.00",
  "low_24h": "49000.00",
  "trade_count_24h": 1250,
  "last_updated": "2024-01-01T00:00:00Z"
}
```

**响应字段说明：**
| 字段 | 类型 | 说明 |
|------|------|------|
| market_id | number | 市场ID |
| last_price | string | 最新成交价格 |
| volume_24h | string | 24小时交易量 |
| price_change_24h | string | 24小时价格变化百分比 |
| high_24h | string | 24小时最高价 |
| low_24h | string | 24小时最低价 |
| trade_count_24h | number | 24小时交易次数 |
| last_updated | string | 最后更新时间 |

**cURL 示例：**
```bash
curl -X GET "http://127.0.0.1:8080/market/1/data" \
  -H "Content-Type: application/json"
```

## 数据模型

### Trade（交易记录）
```json
{
  "id": "string (UUID)",
  "market_id": "number",
  "taker_order_id": "string (UUID)",
  "maker_order_id": "string (UUID)",
  "taker_address": "string",
  "maker_address": "string",
  "size": "string (decimal)",
  "price": "string (decimal)",
  "side": "buy | sell",
  "created_at": "string (ISO 8601)",
  "settlement_batch_id": "string (UUID) | null"
}
```

### Order（订单）
```json
{
  "id": "string (UUID)",
  "user_address": "string",
  "market_id": "number",
  "side": "buy | sell",
  "order_type": "market | limit",
  "size": "string (decimal)",
  "price": "string (decimal) | null",
  "filled_size": "string (decimal)",
  "status": "pending | partially_filled | filled | cancelled | expired",
  "created_at": "string (ISO 8601)",
  "updated_at": "string (ISO 8601)",
  "expires_at": "string (ISO 8601) | null"
}
```

### MarketData（市场数据）
```json
{
  "market_id": "number",
  "last_price": "string (decimal) | null",
  "volume_24h": "string (decimal)",
  "price_change_24h": "string (decimal) | null",
  "high_24h": "string (decimal) | null",
  "low_24h": "string (decimal) | null",
  "trade_count_24h": "number",
  "last_updated": "string (ISO 8601)"
}
```

## 错误码说明

| HTTP状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | BAD_REQUEST | 请求参数错误 |
| 404 | NOT_FOUND | 资源不存在 |
| 500 | INTERNAL_SERVER_ERROR | 服务器内部错误 |

## 使用示例

### 完整的交易流程

1. **检查服务状态**
```bash
curl -X GET "http://127.0.0.1:8080/health"
```

2. **查看市场数据**
```bash
curl -X GET "http://127.0.0.1:8080/market/1/data"
```

3. **查看市场订单簿**
```bash
curl -X GET "http://127.0.0.1:8080/orderbook/1"
```

4. **提交买单**
```bash
curl -X POST "http://127.0.0.1:8080/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "0x1234567890abcdef1234567890abcdef12345678",
    "market_id": 1,
    "side": "buy",
    "order_type": "limit",
    "size": "100.00",
    "price": "50000.00"
  }'
```

5. **查询用户订单**
```bash
curl -X GET "http://127.0.0.1:8080/orders/user/0x1234567890abcdef1234567890abcdef12345678"
```

6. **查看交易记录**
```bash
curl -X GET "http://127.0.0.1:8080/trades/1?limit=100"
```

7. **取消订单**
```bash
curl -X POST "http://127.0.0.1:8080/orders/550e8400-e29b-41d4-a716-446655440000"
```

## 注意事项

1. **价格精度：** 所有价格和数量都使用字符串格式的十进制数，避免浮点数精度问题
2. **订单ID：** 订单ID使用UUID格式，全局唯一
3. **时间格式：** 所有时间字段使用ISO 8601格式（UTC时区）
4. **市场ID：** 市场ID为数字类型，用于标识不同的交易对
5. **订单匹配：** 市价单会立即与订单簿中的对手单进行匹配
6. **订单状态：** 订单状态会实时更新，包括部分成交、完全成交等状态
7. **分页限制：** 查询接口默认返回50条记录，最多1000条
8. **交易记录：** 交易记录按时间倒序排列，最新的交易在前

## 性能说明

- **并发处理：** 支持高并发订单处理
- **延迟：** 订单匹配延迟通常在毫秒级别
- **吞吐量：** 支持每秒处理数千笔订单
- **持久化：** 所有订单和交易数据都会持久化到数据库
- **缓存：** 订单簿数据使用Redis缓存，提高查询性能

## 技术支持

如有问题或建议，请联系开发团队。
