#!/usr/bin/env node

/**
 * Register APT Coins
 * Register the account for APT coins and fund it
 */

const { AptosClient, AptosAccount, TxnBuilderTypes, BCS } = require('aptos');

const NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';
const ADMIN_PRIVATE_KEY = '0xfc3ffc5da0d9b2c817e86c8babf350dbdef2aa66cd63920d59367a78e8006b0f';

async function registerAptCoins() {
  try {
    console.log('🔧 Registering APT coins for account...');
    
    // Create client and account
    const client = new AptosClient(NODE_URL);
    const userAccount = new AptosAccount(Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex'));
    
    console.log('User address:', userAccount.address().toString());
    
    // Register for APT coins
    const payload = {
      type: "entry_function_payload",
      function: "0x1::managed_coin::register",
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: []
    };
    
    console.log('📝 Registering for APT coins...');
    
    const rawTxn = await client.generateTransaction(userAccount.address(), payload);
    const bcsTxn = AptosClient.generateBCSTransaction(userAccount, rawTxn);
    const response = await client.submitTransaction(bcsTxn);
    
    console.log('⏳ Waiting for registration...');
    await client.waitForTransaction(response.hash);
    
    console.log('✅ APT coins registered!');
    console.log('   Transaction hash:', response.hash);
    
    // Now fund the account
    console.log('\n💰 Funding account with APT...');
    
    // Use the Aptos CLI to fund the account
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
    
    // Check balance
    console.log('\n🔍 Checking account balance...');
    const resources = await client.getAccountResources(userAccount.address().toString());
    const aptCoinStore = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    
    if (aptCoinStore) {
      const balance = parseInt(aptCoinStore.data.coin.value);
      const balanceInAPT = balance / 100_000_000;
      console.log('✅ APT Balance:', balanceInAPT, 'APT');
    } else {
      console.log('❌ No APT balance found');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

registerAptCoins();
