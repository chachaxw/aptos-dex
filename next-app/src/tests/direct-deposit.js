#!/usr/bin/env node

/**
 * Direct Deposit to HyperPerp
 * Try to deposit directly without checking balance first
 */

const { AptosClient, AptosAccount } = require('aptos');

const NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';
const ADMIN_PRIVATE_KEY = '0xfc3ffc5da0d9b2c817e86c8babf350dbdef2aa66cd63920d59367a78e8006b0f';

async function directDeposit() {
  try {
    console.log('💰 Direct Deposit to HyperPerp...');
    
    const client = new AptosClient(NODE_URL);
    const userAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('User address:', userAccount.address().toString());
    
    // Try to deposit directly
    console.log('\n1️⃣ Attempting direct deposit...');
    const depositAmount = 100000000; // 1 APT in smallest units
    console.log(`Depositing ${depositAmount / 100_000_000} APT...`);
    
    const depositPayload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::vault::deposit`,
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: [depositAmount.toString(), CONTRACT_ADDRESS]
    };
    
    try {
      const depositTxn = await client.generateTransaction(userAccount.address(), depositPayload);
      const depositBcsTxn = AptosClient.generateBCSTransaction(userAccount, depositTxn);
      const depositResponse = await client.submitTransaction(depositBcsTxn);
      
      console.log('⏳ Waiting for deposit confirmation...');
      await client.waitForTransaction(depositResponse.hash);
      
      console.log('✅ Deposit successful!');
      console.log('   Transaction hash:', depositResponse.hash);
      
      // Check updated collateral
      console.log('\n2️⃣ Checking updated collateral...');
      const resources = await client.getAccountResources(userAccount.address().toString());
      const hyperperpAccount = resources.find(r => r.type.includes('hyperperp::account::Account'));
      
      if (hyperperpAccount) {
        console.log('✅ Updated HyperPerp account:');
        console.log('   Collateral:', hyperperpAccount.data.collateral);
        console.log('   Previous collateral: 0');
        console.log('   New collateral:', hyperperpAccount.data.collateral);
      }
      
      // Test order submission
      console.log('\n3️⃣ Testing order submission...');
      const API_BASE_URL = 'http://localhost:8080';
      
      const orderData = {
        user_address: userAccount.address().toString(),
        market_id: 1,
        side: "Buy",
        order_type: "Limit",
        size: "0.1",
        price: "40000"
      };
      
      try {
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(orderData)
        });
        
        if (orderResponse.ok) {
          const result = await orderResponse.json();
          console.log('✅ Order submitted successfully!');
          console.log('   Order ID:', result.order.id);
          console.log('   Status:', result.order.status);
        } else {
          const errorText = await orderResponse.text();
          console.log('❌ Order submission failed:', orderResponse.status, errorText);
        }
      } catch (error) {
        console.log('❌ Order submission error:', error.message);
      }
      
    } catch (error) {
      console.log('❌ Deposit failed:', error.message);
      
      if (error.message.includes('INSUFFICIENT_BALANCE')) {
        console.log('   The account has insufficient APT balance');
      } else if (error.message.includes('INVALID_AUTH_KEY')) {
        console.log('   Authentication key issue');
      } else {
        console.log('   Other error:', error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

directDeposit();
