#!/bin/bash

echo "=== HyperPerp Matching Engine Aptos Integration Test ==="
echo "时间: $(date)"
echo ""

# 检查服务是否运行
echo "1. 检查服务健康状态..."
curl -X GET "http://127.0.0.1:8080/health" \
  -H "Content-Type: application/json" \
  -w "\nHTTP状态码: %{http_code}\n响应时间: %{time_total}s\n" \
  -s

echo ""
echo "----------------------------------------"
echo ""

# 测试1: 限价买单 - 应该触发资金冻结
echo "2. 测试限价买单 (触发资金冻结)..."
ORDER_RESPONSE=$(curl -X POST "http://127.0.0.1:8080/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "0x1234567890abcdef1234567890abcdef12345678",
    "market_id": 1,
    "side": "buy",
    "order_type": "limit",
    "size": "100.50",
    "price": "50000.00",
    "expires_at": "2024-12-31T23:59:59Z"
  }' \
  -w "\nHTTP状态码: %{http_code}\n响应时间: %{time_total}s\n" \
  -s)

echo "$ORDER_RESPONSE"

# 提取订单ID
ORDER_ID=$(echo "$ORDER_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "订单ID: $ORDER_ID"

echo ""
echo "----------------------------------------"
echo ""

# 测试2: 市价卖单 - 应该触发撮合和结算
echo "3. 测试市价卖单 (触发撮合和结算)..."
curl -X POST "http://127.0.0.1:8080/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "0x9876543210fedcba9876543210fedcba98765432",
    "market_id": 1,
    "side": "sell",
    "order_type": "market",
    "size": "50.00"
  }' \
  -w "\nHTTP状态码: %{http_code}\n响应时间: %{time_total}s\n" \
  -s

echo ""
echo "----------------------------------------"
echo ""

# 测试3: 查看订单簿
echo "4. 查看市场1的订单簿..."
curl -X GET "http://127.0.0.1:8080/orderbook/1" \
  -H "Content-Type: application/json" \
  -w "\nHTTP状态码: %{http_code}\n响应时间: %{time_total}s\n" \
  -s

echo ""
echo "----------------------------------------"
echo ""

# 测试4: 取消订单 - 应该触发资金解冻
if [ ! -z "$ORDER_ID" ]; then
    echo "5. 取消订单 (触发资金解冻)..."
    curl -X POST "http://127.0.0.1:8080/orders/$ORDER_ID" \
      -H "Content-Type: application/json" \
      -w "\nHTTP状态码: %{http_code}\n响应时间: %{time_total}s\n" \
      -s
else
    echo "5. 跳过取消订单测试 (未获取到订单ID)"
fi

echo ""
echo "----------------------------------------"
echo ""

# 测试5: 查看交易记录
echo "6. 查看市场1的交易记录..."
curl -X GET "http://127.0.0.1:8080/trades/1?limit=10" \
  -H "Content-Type: application/json" \
  -w "\nHTTP状态码: %{http_code}\n响应时间: %{time_total}s\n" \
  -s

echo ""
echo "=== 测试完成 ==="
echo ""
echo "观察要点："
echo "1. 下单时应该看到 'Freezing funds for user' 日志"
echo "2. 撮合成功时应该看到 'Submitting settlement batch' 日志"
echo "3. 撤单时应该看到 'Unfreezing funds for user' 日志"
echo "4. 所有操作都应该有对应的交易哈希"
