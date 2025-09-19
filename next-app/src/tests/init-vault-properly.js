#!/usr/bin/env node

/**
 * Initialize Vault Properly
 * Initialize the HyperPerp vault with the correct parameters
 */

const { AptosClient, AptosAccount } = require('aptos');

const NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';
const ADMIN_PRIVATE_KEY = '0xfc3ffc5da0d9b2c817e86c8babf350dbdef2aa66cd63920d59367a78e8006b0f';

async function initVaultProperly() {
  try {
    console.log('🔧 Initializing HyperPerp Vault Properly...');
    
    const client = new AptosClient(NODE_URL);
    const adminAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('Admin address:', adminAccount.address().toString());
    console.log('Contract address:', CONTRACT_ADDRESS);
    
    // Check if vault is already initialized
    console.log('\n1️⃣ Checking if vault is already initialized...');
    const contractResources = await client.getAccountResources(CONTRACT_ADDRESS);
    const vaultConfig = contractResources.find(r => r.type.includes('vault::Config'));
    
    if (vaultConfig) {
      console.log('✅ Vault already initialized');
      console.log('   Config:', vaultConfig.data);
    } else {
      console.log('❌ Vault not initialized, initializing now...');
      
      // Initialize vault
      const payload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::vault::init`,
        type_arguments: ["0x1::aptos_coin::AptosCoin"],
        arguments: [1000000] // min_deposit: 1 APT in smallest units
      };
      
      console.log('📝 Creating vault initialization transaction...');
      console.log('Function:', payload.function);
      console.log('Arguments:', payload.arguments);
      
      const rawTxn = await client.generateTransaction(adminAccount.address(), payload);
      const bcsTxn = AptosClient.generateBCSTransaction(adminAccount, rawTxn);
      const response = await client.submitTransaction(bcsTxn);
      
      console.log('⏳ Waiting for vault initialization...');
      await client.waitForTransaction(response.hash);
      
      console.log('✅ Vault initialized successfully!');
      console.log('   Transaction hash:', response.hash);
    }
    
    // Check vault resources after initialization
    console.log('\n2️⃣ Checking vault resources...');
    const updatedContractResources = await client.getAccountResources(CONTRACT_ADDRESS);
    const vaultResources = updatedContractResources.filter(r => r.type.includes('vault'));
    
    console.log('Vault resources found:', vaultResources.length);
    vaultResources.forEach((resource, index) => {
      console.log(`   ${index + 1}. ${resource.type}`);
    });
    
    // Now try to deposit
    console.log('\n3️⃣ Attempting deposit after vault initialization...');
    const depositAmount = 1000000; // 1 APT in smallest units
    console.log(`Depositing ${depositAmount / 100_000_000} APT...`);
    
    const depositPayload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::vault::deposit`,
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: [depositAmount.toString(), CONTRACT_ADDRESS]
    };
    
    try {
      const depositTxn = await client.generateTransaction(adminAccount.address(), depositPayload);
      const depositBcsTxn = AptosClient.generateBCSTransaction(adminAccount, depositTxn);
      const depositResponse = await client.submitTransaction(depositBcsTxn);
      
      console.log('⏳ Waiting for deposit confirmation...');
      await client.waitForTransaction(depositResponse.hash);
      
      console.log('✅ Deposit successful!');
      console.log('   Transaction hash:', depositResponse.hash);
      
      // Check updated collateral
      console.log('\n4️⃣ Checking updated collateral...');
      const userResources = await client.getAccountResources(adminAccount.address().toString());
      const hyperperpAccount = userResources.find(r => r.type.includes('hyperperp::account::Account'));
      
      if (hyperperpAccount) {
        console.log('✅ Updated HyperPerp account:');
        console.log('   Collateral:', hyperperpAccount.data.collateral);
        console.log('   Previous collateral: 0');
        console.log('   New collateral:', hyperperpAccount.data.collateral);
      }
      
    } catch (error) {
      console.log('❌ Deposit failed:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

initVaultProperly();
