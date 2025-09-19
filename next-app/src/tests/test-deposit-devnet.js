#!/usr/bin/env node

/**
 * Test Deposit on Devnet
 * Test deposit functionality with devnet setup
 */

const API_BASE_URL = 'http://localhost:8080';

async function testDeposit() {
  try {
    console.log('🧪 Testing Deposit on Devnet...');
    
    // Use the admin address as the user for testing
    const userAddress = "0xac60e5c9354e06da4ae20734ba9ab63d5ecdb433f01e8f884495d06a3db2d975";
    const amount = 100000000; // 1 APT in smallest units
    
    console.log('User address:', userAddress);
    console.log('Amount:', amount, 'smallest units (1 APT)');
    
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

    console.log('Response status:', response.status);
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ Deposit successful!');
      console.log('   Transaction hash:', result.transaction_hash);
      console.log('   Amount:', result.amount);
      console.log('   User:', result.user_address);
    } else {
      console.log('❌ Deposit failed:', responseText);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testDeposit();
