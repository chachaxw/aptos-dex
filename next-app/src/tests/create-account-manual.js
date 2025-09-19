#!/usr/bin/env node

/**
 * Create Account Manually
 * Manually call the account::open function
 */

const { AptosClient, AptosAccount, TxnBuilderTypes, BCS } = require('aptos');

const NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';
const ADMIN_PRIVATE_KEY = '0xfc3ffc5da0d9b2c817e86c8babf350dbdef2aa66cd63920d59367a78e8006b0f';

async function createAccount() {
  try {
    console.log('🔧 Creating HyperPerp Account...');
    
    // Create client and account
    const client = new AptosClient(NODE_URL);
    const adminAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('Admin address:', adminAccount.address().toString());
    
    // Create account
    const payload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::account::open`,
      type_arguments: [],
      arguments: []
    };
    
    console.log('📝 Creating account transaction...');
    console.log('Function:', payload.function);
    
    const rawTxn = await client.generateTransaction(adminAccount.address(), payload);
    const bcsTxn = AptosClient.generateBCSTransaction(adminAccount, rawTxn);
    const transactionRes = await client.submitTransaction(bcsTxn);
    
    console.log('⏳ Waiting for transaction confirmation...');
    await client.waitForTransaction(transactionRes.hash);
    
    console.log('✅ Account created successfully!');
    console.log('   Transaction hash:', transactionRes.hash);
    
    // Check if account was created
    const resources = await client.getAccountResources(adminAccount.address().toString());
    const hyperperpAccount = resources.find(r => r.type.includes('hyperperp::account::Account'));
    
    if (hyperperpAccount) {
      console.log('✅ HyperPerp account found:');
      console.log('   Type:', hyperperpAccount.type);
      console.log('   Data:', JSON.stringify(hyperperpAccount.data, null, 2));
    } else {
      console.log('❌ HyperPerp account not found');
    }
    
  } catch (error) {
    console.log('❌ Error creating account:', error.message);
    if (error.message.includes('ABORTED')) {
      console.log('   This might mean the account already exists');
    }
  }
}

createAccount();
