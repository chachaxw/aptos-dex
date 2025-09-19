#!/usr/bin/env node

/**
 * Add Collateral to HyperPerp Account
 * This script properly deposits APT to increase user collateral
 */

const { AptosClient, AptosAccount, TxnBuilderTypes, BCS } = require('aptos');

const NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';
const ADMIN_PRIVATE_KEY = '0xfc3ffc5da0d9b2c817e86c8babf350dbdef2aa66cd63920d59367a78e8006b0f';

async function addCollateral() {
  try {
    console.log('💰 Adding Collateral to HyperPerp Account...');
    
    // Create client and account
    const client = new AptosClient(NODE_URL);
    const userAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('User address:', userAccount.address().toString());
    console.log('Contract address:', CONTRACT_ADDRESS);
    
    // Step 1: Check current account state
    console.log('\n1️⃣ Checking current account state...');
    const resources = await client.getAccountResources(userAccount.address().toString());
    
    // Check APT balance
    const aptCoinStore = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    if (!aptCoinStore) {
      console.log('❌ No APT coin store found. Need to register for APT coins first.');
      
      // Register for APT coins
      console.log('📝 Registering for APT coins...');
      const registerPayload = {
        type: "entry_function_payload",
        function: "0x1::managed_coin::register",
        type_arguments: ["0x1::aptos_coin::AptosCoin"],
        arguments: []
      };
      
      const registerTxn = await client.generateTransaction(userAccount.address(), registerPayload);
      const registerBcsTxn = AptosClient.generateBCSTransaction(userAccount, registerTxn);
      const registerResponse = await client.submitTransaction(registerBcsTxn);
      
      console.log('⏳ Waiting for APT coin registration...');
      await client.waitForTransaction(registerResponse.hash);
      console.log('✅ APT coins registered!');
      
      // Now fund the account
      console.log('💰 Funding account with APT...');
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      try {
        const { stdout } = await execAsync(
          `cd /Users/chacha/Develop/aptos-dex/move/contracts/hyperperp && aptos account fund-with-faucet --profile hyperperp-devnet --amount 100000000`
        );
        console.log('✅ Account funded:', stdout);
      } catch (error) {
        console.log('❌ Faucet funding failed:', error.message);
        return;
      }
    } else {
      const balance = parseInt(aptCoinStore.data.coin.value);
      const balanceInAPT = balance / 100_000_000;
      console.log('✅ APT Balance:', balanceInAPT, 'APT');
      
      if (balance < 1000000) { // Less than 1 APT
        console.log('💰 Funding account with more APT...');
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        try {
          const { stdout } = await execAsync(
            `cd /Users/chacha/Develop/aptos-dex/move/contracts/hyperperp && aptos account fund-with-faucet --profile hyperperp-devnet --amount 100000000`
          );
          console.log('✅ Account funded:', stdout);
        } catch (error) {
          console.log('❌ Faucet funding failed:', error.message);
        }
      }
    }
    
    // Step 2: Check HyperPerp account
    console.log('\n2️⃣ Checking HyperPerp account...');
    const updatedResources = await client.getAccountResources(userAccount.address().toString());
    const hyperperpAccount = updatedResources.find(r => r.type.includes('hyperperp::account::Account'));
    
    if (hyperperpAccount) {
      console.log('✅ HyperPerp account found:');
      console.log('   Collateral:', hyperperpAccount.data.collateral);
      console.log('   Owner:', hyperperpAccount.data.owner);
    } else {
      console.log('❌ HyperPerp account not found');
      return;
    }
    
    // Step 3: Deposit APT to HyperPerp vault
    console.log('\n3️⃣ Depositing APT to HyperPerp vault...');
    const depositAmount = 5000000; // 5 APT in smallest units
    console.log(`Depositing ${depositAmount / 100_000_000} APT...`);
    
    const depositPayload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::vault::deposit`,
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: [depositAmount.toString(), CONTRACT_ADDRESS]
    };
    
    const depositTxn = await client.generateTransaction(userAccount.address(), depositPayload);
    const depositBcsTxn = AptosClient.generateBCSTransaction(userAccount, depositTxn);
    const depositResponse = await client.submitTransaction(depositBcsTxn);
    
    console.log('⏳ Waiting for deposit confirmation...');
    await client.waitForTransaction(depositResponse.hash);
    
    console.log('✅ Deposit successful!');
    console.log('   Transaction hash:', depositResponse.hash);
    
    // Step 4: Verify updated collateral
    console.log('\n4️⃣ Verifying updated collateral...');
    const finalResources = await client.getAccountResources(userAccount.address().toString());
    const finalHyperperpAccount = finalResources.find(r => r.type.includes('hyperperp::account::Account'));
    
    if (finalHyperperpAccount) {
      console.log('✅ Updated HyperPerp account:');
      console.log('   Collateral:', finalHyperperpAccount.data.collateral);
      console.log('   Previous collateral: 0');
      console.log('   New collateral:', finalHyperperpAccount.data.collateral);
      console.log('   Collateral added:', finalHyperperpAccount.data.collateral);
    }
    
    // Step 5: Test order submission
    console.log('\n5️⃣ Testing order submission with collateral...');
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
    
    console.log('\n🎉 Collateral addition complete!');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.message.includes('ABORTED')) {
      console.log('   This might mean insufficient funds or account issues');
    }
  }
}

addCollateral();
