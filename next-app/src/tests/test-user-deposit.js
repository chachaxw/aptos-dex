#!/usr/bin/env node

/**
 * Test User Deposit with Proper Signing
 * This script demonstrates the correct way to handle user deposits
 */

const { AptosClient, AptosAccount, TxnBuilderTypes, BCS } = require('aptos');

const NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';
const ADMIN_PRIVATE_KEY = '0xfc3ffc5da0d9b2c817e86c8babf350dbdef2aa66cd63920d59367a78e8006b0f';

async function testUserDeposit() {
  try {
    console.log('🧪 Testing User Deposit with Proper Signing...');
    
    // Create client and admin account (acting as user for testing)
    const client = new AptosClient(NODE_URL);
    const userAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('User address:', userAccount.address().toString());
    console.log('Contract address:', CONTRACT_ADDRESS);
    
    // Check if user has APT balance
    const resources = await client.getAccountResources(userAccount.address().toString());
    const aptCoinStore = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    
    if (!aptCoinStore) {
      console.log('❌ User has no APT balance');
      return;
    }
    
    const balance = parseInt(aptCoinStore.data.coin.value);
    const balanceInAPT = balance / 100_000_000;
    console.log('✅ User APT balance:', balanceInAPT, 'APT');
    
    // Check if user has HyperPerp account
    const hyperperpAccount = resources.find(r => r.type.includes('hyperperp::account::Account'));
    if (!hyperperpAccount) {
      console.log('📝 Creating HyperPerp account...');
      
      // Create account
      const payload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::account::open`,
        type_arguments: [],
        arguments: []
      };
      
      const rawTxn = await client.generateTransaction(userAccount.address(), payload);
      const bcsTxn = AptosClient.generateBCSTransaction(userAccount, rawTxn);
      const response = await client.submitTransaction(bcsTxn);
      
      console.log('⏳ Waiting for account creation...');
      await client.waitForTransaction(response.hash);
      console.log('✅ HyperPerp account created');
    } else {
      console.log('✅ HyperPerp account exists');
    }
    
    // Now test deposit
    const depositAmount = 1000000; // 1 APT in smallest units
    console.log(`\n💰 Depositing ${depositAmount / 100_000_000} APT...`);
    
    const depositPayload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::vault::deposit`,
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: [depositAmount.toString(), CONTRACT_ADDRESS]
    };
    
    const rawTxn = await client.generateTransaction(userAccount.address(), depositPayload);
    const bcsTxn = AptosClient.generateBCSTransaction(userAccount, rawTxn);
    const response = await client.submitTransaction(bcsTxn);
    
    console.log('⏳ Waiting for deposit confirmation...');
    await client.waitForTransaction(response.hash);
    
    console.log('✅ Deposit successful!');
    console.log('   Transaction hash:', response.hash);
    
    // Check updated account
    const updatedResources = await client.getAccountResources(userAccount.address().toString());
    const updatedHyperperpAccount = updatedResources.find(r => r.type.includes('hyperperp::account::Account'));
    
    if (updatedHyperperpAccount) {
      console.log('✅ Updated HyperPerp account:');
      console.log('   Collateral:', updatedHyperperpAccount.data.collateral);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.message.includes('ABORTED')) {
      console.log('   This might mean the account already exists or insufficient funds');
    }
  }
}

testUserDeposit();
