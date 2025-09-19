#!/usr/bin/env node

/**
 * Simple Order Test (Bypass Deposit)
 * Test order submission without deposit requirement
 */

const API_BASE_URL = 'http://localhost:8080';

async function testOrderSubmission() {
  try {
    console.log('🧪 Testing Order Submission (Simple)...');
    
    // Test order data
    const orderData = {
      user_address: "0xac60e5c9354e06da4ae20734ba9ab63d5ecdb433f01e8f884495d06a3db2d975",
      market_id: 1,
      side: "Buy",
      order_type: "Limit",
      size: "0.1",
      price: "40000"
    };
    
    console.log('Order data:', JSON.stringify(orderData, null, 2));
    
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    console.log('Response status:', response.status);
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ Order submitted successfully!');
      console.log('   Order ID:', result.order.id);
      console.log('   Status:', result.order.status);
      console.log('   Trades:', result.trades.length);
    } else {
      console.log('❌ Order submission failed:', responseText);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testOrderSubmission();
