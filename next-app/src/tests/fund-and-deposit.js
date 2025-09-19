#!/usr/bin/env node

/**
 * Fund Account and Deposit to HyperPerp
 * Simple script to get APT tokens and deposit them
 */

const { AptosClient, AptosAccount } = require('aptos');

const NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';
const ADMIN_PRIVATE_KEY = '0xfc3ffc5da0d9b2c817e86c8babf350dbdef2aa66cd63920d59367a78e8006b0f';

async function fundAndDeposit() {
  try {
    console.log('💰 Funding Account and Depositing to HyperPerp...');
    
    const client = new AptosClient(NODE_URL);
    const userAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('User address:', userAccount.address().toString());
    
    // Step 1: Register for APT coins
    console.log('\n1️⃣ Registering for APT coins...');
    const registerPayload = {
      type: "entry_function_payload",
      function: "0x1::managed_coin::register",
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: []
    };
    
    const registerTxn = await client.generateTransaction(userAccount.address(), registerPayload);
    const registerBcsTxn = AptosClient.generateBCSTransaction(userAccount, registerTxn);
    const registerResponse = await client.submitTransaction(registerBcsTxn);
    
    console.log('⏳ Waiting for registration...');
    await client.waitForTransaction(registerResponse.hash);
    console.log('✅ APT coins registered!');
    
    // Step 2: Fund account using Aptos CLI
    console.log('\n2️⃣ Funding account with APT...');
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
    
    // Step 3: Wait a moment for the funding to be processed
    console.log('\n3️⃣ Waiting for funding to be processed...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Check APT balance
    console.log('\n4️⃣ Checking APT balance...');
    const resources = await client.getAccountResources(userAccount.address().toString());
    const aptCoinStore = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    
    if (!aptCoinStore) {
      console.log('❌ Still no APT coin store. Let me try a different approach...');
      
      // Try to create the coin store manually
      console.log('📝 Creating APT coin store...');
      const createCoinStorePayload = {
        type: "entry_function_payload",
        function: "0x1::aptos_coin::initialize",
        type_arguments: [],
        arguments: []
      };
      
      const createTxn = await client.generateTransaction(userAccount.address(), createCoinStorePayload);
      const createBcsTxn = AptosClient.generateBCSTransaction(userAccount, createTxn);
      const createResponse = await client.submitTransaction(createBcsTxn);
      
      console.log('⏳ Waiting for coin store creation...');
      await client.waitForTransaction(createResponse.hash);
      console.log('✅ APT coin store created!');
      
      // Fund again
      console.log('💰 Funding account again...');
      try {
        const { stdout } = await execAsync(
          `cd /Users/chacha/Develop/aptos-dex/move/contracts/hyperperp && aptos account fund-with-faucet --profile hyperperp-devnet --amount 100000000`
        );
        console.log('✅ Account funded:', stdout);
      } catch (error) {
        console.log('❌ Faucet funding failed:', error.message);
      }
    } else {
      const balance = parseInt(aptCoinStore.data.coin.value);
      const balanceInAPT = balance / 100_000_000;
      console.log('✅ APT Balance:', balanceInAPT, 'APT');
    }
    
    // Step 5: Final check and deposit
    console.log('\n5️⃣ Final check and deposit...');
    const finalResources = await client.getAccountResources(userAccount.address().toString());
    const finalAptCoinStore = finalResources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    
    if (finalAptCoinStore) {
      const balance = parseInt(finalAptCoinStore.data.coin.value);
      const balanceInAPT = balance / 100_000_000;
      console.log('✅ Final APT Balance:', balanceInAPT, 'APT');
      
      if (balance > 0) {
        // Now deposit to HyperPerp
        console.log('\n6️⃣ Depositing to HyperPerp vault...');
        const depositAmount = Math.min(balance, 5000000); // Deposit up to 5 APT
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
        
        // Check updated collateral
        console.log('\n7️⃣ Checking updated collateral...');
        const updatedResources = await client.getAccountResources(userAccount.address().toString());
        const hyperperpAccount = updatedResources.find(r => r.type.includes('hyperperp::account::Account'));
        
        if (hyperperpAccount) {
          console.log('✅ Updated HyperPerp account:');
          console.log('   Collateral:', hyperperpAccount.data.collateral);
          console.log('   Collateral added:', hyperperpAccount.data.collateral);
        }
        
      } else {
        console.log('❌ No APT balance to deposit');
      }
    } else {
      console.log('❌ Still no APT coin store found');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

fundAndDeposit();
