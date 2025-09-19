#!/usr/bin/env node

/**
 * Initialize Vault
 * Initialize the HyperPerp vault contract
 */

const { AptosClient, AptosAccount, TxnBuilderTypes, BCS } = require('aptos');

const NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';
const ADMIN_PRIVATE_KEY = '0xfc3ffc5da0d9b2c817e86c8babf350dbdef2aa66cd63920d59367a78e8006b0f';

async function initVault() {
  try {
    console.log('🔧 Initializing HyperPerp Vault...');
    
    // Create client and account
    const client = new AptosClient(NODE_URL);
    const adminAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('Admin address:', adminAccount.address().toString());
    console.log('Contract address:', CONTRACT_ADDRESS);
    
    // Get account resources to check if vault is already initialized
    const resources = await client.getAccountResources(adminAccount.address().toString());
    const vaultConfig = resources.find(r => r.type.includes('vault::Config'));
    
    if (vaultConfig) {
      console.log('✅ Vault already initialized');
      return;
    }
    
    // Initialize vault
    const payload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::vault::init`,
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: [
        1000000 // min_deposit (1 APT in smallest units)
      ]
    };
    
    console.log('📝 Creating vault initialization transaction...');
    
    const rawTxn = await client.generateTransaction(adminAccount.address(), payload);
    const bcsTxn = AptosClient.generateBCSTransaction(adminAccount, rawTxn);
    const transactionRes = await client.submitTransaction(bcsTxn);
    
    console.log('⏳ Waiting for transaction confirmation...');
    await client.waitForTransaction(transactionRes.hash);
    
    console.log('✅ Vault initialized successfully!');
    console.log('   Transaction hash:', transactionRes.hash);
    
  } catch (error) {
    console.log('❌ Error initializing vault:', error.message);
  }
}

initVault();
