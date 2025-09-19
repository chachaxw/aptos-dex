#!/usr/bin/env node

/**
 * Test Order Submission Flow
 * This script demonstrates how to submit orders to the matching engine
 */

const API_BASE_URL = 'http://localhost:8080';

// Test order data
const testOrders = [
  {
    user_address: "0xf088abc10dd7dbc83f95cd621fa85964a8f5d7efecf10272fb2cc6a909b8e647",
    market_id: 1,
    side: "Buy",
    order_type: "Limit",
    size: "0.1",
    price: "40000"
  },
  {
    user_address: "0xf088abc10dd7dbc83f95cd621fa85964a8f5d7efecf10272fb2cc6a909b8e647",
    market_id: 1,
    side: "Sell",
    order_type: "Limit", 
    size: "0.05",
    price: "41000"
  },
  {
    user_address: "0xf088abc10dd7dbc83f95cd621fa85964a8f5d7efecf10272fb2cc6a909b8e647",
    market_id: 1,
    side: "Buy",
    order_type: "Market",
    size: "0.2"
  }
];

async function checkEngineHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    console.log('✅ Matching Engine Status:', data.status);
    return true;
  } catch (error) {
    console.log('❌ Matching Engine Offline:', error.message);
    return false;
  }
}

async function depositFunds(userAddress, amount) {
  try {
    console.log(`\n💰 Depositing ${amount} APT for user ${userAddress}...`);
    
    const response = await fetch(`${API_BASE_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        user_address: userAddress,
        amount: amount
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Deposit Successful!');
    console.log('   Transaction Hash:', result.transaction_hash);
    console.log('   Amount:', result.amount, 'APT');
    console.log('   User:', result.user_address);
    
    return result;
  } catch (error) {
    console.log('❌ Deposit Failed:', error.message);
    return null;
  }
}

async function submitOrder(orderData) {
  try {
    console.log(`\n📤 Submitting ${orderData.side} ${orderData.size} ${orderData.order_type} order...`);
    
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Order Submitted Successfully!');
    console.log('   Order ID:', result.order.id);
    console.log('   Status:', result.order.status);
    console.log('   Trades:', result.trades.length);
    
    if (result.trades.length > 0) {
      console.log('   🎯 Immediate Trades:');
      result.trades.forEach((trade, i) => {
        console.log(`      Trade ${i+1}: ${trade.size} @ $${trade.price}`);
      });
    }
    
    return result;
  } catch (error) {
    console.log('❌ Order Failed:', error.message);
    return null;
  }
}

async function getOrderBook(marketId) {
  try {
    const response = await fetch(`${API_BASE_URL}/orderbook/${marketId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const orderBook = await response.json();
    console.log(`\n📊 Order Book for Market ${marketId}:`);
    console.log('   Bids:', orderBook.bids.length, 'levels');
    console.log('   Asks:', orderBook.asks.length, 'levels');
    return orderBook;
  } catch (error) {
    console.log('❌ Failed to get order book:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 HyperPerp Order Submission Test');
  console.log('=====================================');
  
  // Check if matching engine is running
  const isHealthy = await checkEngineHealth();

  if (!isHealthy) {
    console.log('\n❌ Please start the matching engine first:');
    console.log('   cd rust-matching-engine && cargo run');
    process.exit(1);
  }

  // Deposit funds first (required for orders)
  const userAddress = testOrders[0].user_address;
  const depositAmount = 1000000; // 1 APT in smallest units (1e6)
  
  console.log('\n💰 Step 1: Depositing funds...');
  const depositResult = await depositFunds(userAddress, depositAmount);
  if (!depositResult) {
    console.log('❌ Deposit failed. Cannot proceed with orders.');
    process.exit(1);
  }

  // Wait a moment for deposit to be processed
  console.log('\n⏳ Waiting for deposit to be processed...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get initial order book
  await getOrderBook(1);

  // Submit test orders
  console.log('\n📝 Step 2: Submitting Test Orders...');
  for (const order of testOrders) {
    await submitOrder(order);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between orders
  }

  // Get final order book
  console.log('\n📊 Final Order Book:');
  await getOrderBook(1);

  console.log('\n✅ Test Complete!');
  console.log('\n💡 Next Steps:');
  console.log('   1. Check the matching engine logs for settlement activity');
  console.log('   2. View the frontend at http://localhost:3000');
  console.log('   3. Connect your wallet to see the order book update');
}

// Run the test
main().catch(console.error);
