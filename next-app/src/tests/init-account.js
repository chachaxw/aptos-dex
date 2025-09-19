#!/usr/bin/env node

/**
 * Initialize User Account
 * Initialize the HyperPerp account for a user
 */

const { AptosClient, AptosAccount } = require('aptos');

const NODE_URL = 'https://fullnode.testnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0xa8e8b873967f6377dbf95b4d7905cff68270899f133408e6b8a13667a6b70336';
const ADMIN_PRIVATE_KEY = '0x6646457c414ae6fcc955f4fa625d572b243ccc1ab5d844cfb298d48cef450661';

async function initAccount() {
  try {
    console.log('🔧 Initializing HyperPerp Account...');
    
    // Create client and account
    const client = new AptosClient(NODE_URL);
    const adminAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('Admin address:', adminAccount.address().toString());
    console.log('Contract address:', CONTRACT_ADDRESS);
    
    // Get account resources to check if account is already initialized
    const resources = await client.getAccountResources(adminAccount.address().toString());
    const hyperperpAccount = resources.find(r => r.type.includes('account::Account'));
    
    if (hyperperpAccount) {
      console.log('✅ Account already initialized');
      console.log('   Collateral:', hyperperpAccount.data.collateral);
      return;
    }
    
    // Initialize account
    const payload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::account::open`,
      type_arguments: [],
      arguments: []
    };
    
    console.log('📝 Creating account initialization transaction...');
    
    const rawTxn = await client.generateTransaction(adminAccount.address(), payload);
    const bcsTxn = AptosClient.generateBCSTransaction(adminAccount, rawTxn);
    const transactionRes = await client.submitTransaction(bcsTxn);
    
    console.log('⏳ Waiting for transaction confirmation...');
    await client.waitForTransaction(transactionRes.hash);
    
    console.log('✅ Account initialized successfully!');
    console.log('   Transaction hash:', transactionRes.hash);
    
  } catch (error) {
    console.log('❌ Error initializing account:', error.message);
  }
}

initAccount();
