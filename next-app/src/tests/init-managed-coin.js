#!/usr/bin/env node

/**
 * Initialize Managed Coin
 * Initialize the managed coin for the HyperPerp system
 */

const { AptosClient, AptosAccount } = require('aptos');

const NODE_URL = 'https://fullnode.testnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0xa8e8b873967f6377dbf95b4d7905cff68270899f133408e6b8a13667a6b70336';
const ADMIN_PRIVATE_KEY = '0xc919a81b08fd79a13936d4c8cde5aef42c79b4bf4b9493c7d9915758bf07ddfb';

async function initManagedCoin() {
  try {
    console.log('🪙 Initializing Managed Coin...');
    
    const client = new AptosClient(NODE_URL);
    const adminAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('Admin address:', adminAccount.address().toString());
    console.log('Contract address:', CONTRACT_ADDRESS);
    
    // Check if managed coin is already initialized
    console.log('\n1️⃣ Checking if managed coin is already initialized...');
    const resources = await client.getAccountResources(CONTRACT_ADDRESS);
    const managedCoinInfo = resources.find(r => r.type.includes('managed_coin::TestCoin'));

    if (managedCoinInfo) {
      console.log('✅ Test coin already initialized');
      console.log('   Name:', managedCoinInfo.data.name);
      console.log('   Symbol:', managedCoinInfo.data.symbol);
      console.log('   Decimals:', managedCoinInfo.data.decimals);
      console.log('   Total Supply:', managedCoinInfo.data.total_supply);
      return;
    }
    
    // Initialize managed coin
    console.log('\n2️⃣ Initializing managed coin...');
    const payload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::managed_coin::initialize`,
      type_arguments: [],
      arguments: [
        "HyperPerp Test Coin", // name
        "HTC", // symbol
        6 // decimals - as number, not string
      ]
    };
    
    console.log('📝 Creating managed coin initialization transaction...');
    console.log('Function:', payload.function);
    console.log('Arguments:', payload.arguments);
    
    const rawTxn = await client.generateTransaction(adminAccount.address(), payload);
    const bcsTxn = AptosClient.generateBCSTransaction(adminAccount, rawTxn);
    const response = await client.submitTransaction(bcsTxn);
    
    console.log('⏳ Waiting for transaction confirmation...');
    await client.waitForTransaction(response.hash);
    
    console.log('✅ Managed coin initialized successfully!');
    console.log('   Transaction hash:', response.hash);
    
    // Verify initialization
    console.log('\n3️⃣ Verifying managed coin initialization...');
    const updatedResources = await client.getAccountResources(CONTRACT_ADDRESS);
    const newManagedCoinInfo = updatedResources.find(r => r.type.includes('managed_coin::ManagedCoinInfo'));
    
    if (newManagedCoinInfo) {
      console.log('✅ Managed coin info verified:');
      console.log('   Name:', newManagedCoinInfo.data.name);
      console.log('   Symbol:', newManagedCoinInfo.data.symbol);
      console.log('   Decimals:', newManagedCoinInfo.data.decimals);
      console.log('   Total Supply:', newManagedCoinInfo.data.total_supply);
    } else {
      console.log('❌ Managed coin info not found after initialization');
    }
    
    // Test minting some coins
    console.log('\n4️⃣ Testing coin minting...');
    const mintPayload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::managed_coin::mint`,
      type_arguments: [],
      arguments: [
        adminAccount.address().toString(), // to
        1000000000 // amount (1000 coins with 6 decimals) - as number, not string
      ]
    };
    
    const mintTxn = await client.generateTransaction(adminAccount.address(), mintPayload);
    const mintBcsTxn = AptosClient.generateBCSTransaction(adminAccount, mintTxn);
    const mintResponse = await client.submitTransaction(mintBcsTxn);
    
    console.log('⏳ Waiting for mint transaction confirmation...');
    await client.waitForTransaction(mintResponse.hash);
    
    console.log('✅ Coins minted successfully!');
    console.log('   Transaction hash:', mintResponse.hash);
    
    // Check balance
    console.log('\n5️⃣ Checking admin balance...');
    const finalResources = await client.getAccountResources(adminAccount.address().toString());
    const coinStore = finalResources.find(r => r.type.includes('managed_coin::TestCoin'));
    
    if (coinStore) {
      const balance = parseInt(coinStore.data.coin.value);
      const balanceInCoins = balance / 1_000_000; // 6 decimals
      console.log('✅ Admin balance:', balanceInCoins, 'HTC');
    } else {
      console.log('❌ Coin store not found for admin');
    }
    
    console.log('\n🎯 Summary:');
    console.log('✅ Managed coin initialized successfully');
    console.log('✅ Test coins minted to admin account');
    console.log('✅ Frontend can now register and deposit');
    
    console.log('\n💡 Next Steps:');
    console.log('1. Update frontend CONTRACT_ADDRESS to:', CONTRACT_ADDRESS);
    console.log('2. Users can register for the coin through the frontend');
    console.log('3. Users can deposit test coins to the vault');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

initManagedCoin();
