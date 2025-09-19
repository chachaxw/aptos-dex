#!/usr/bin/env node

/**
 * Check User Balance
 * Check if the user account has APT balance
 */

const API_BASE_URL = 'https://fullnode.testnet.aptoslabs.com/v1';

async function checkUserBalance() {
  try {
    const userAddress = "0x517206cb6757cc0723667a05afb9c05675341cd79570ba7cfb72f63241d55a2e";
    
    console.log('🔍 Checking user balance...');
    console.log('User address:', userAddress);
    
    const response = await fetch(`${API_BASE_URL}/accounts/${userAddress}/resources`);
    
    if (!response.ok) {
      console.log('❌ Failed to fetch resources:', response.status);
      return;
    }
    
    const resources = await response.json();
    console.log('📊 Account resources:');
    
    // Look for APT coin store
    const aptCoinStore = resources.find(
      r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
    );
    
    if (aptCoinStore) {
      const balance = aptCoinStore.data.coin.value;
      const balanceInAPT = parseInt(balance) / 100_000_000; // Convert from smallest units
      console.log('💰 APT Balance:', balanceInAPT, 'APT');
      console.log('   Raw balance:', balance, 'smallest units');
    } else {
      console.log('❌ No APT balance found');
    }
    
    // Look for HyperPerp account
    const hyperperpAccount = resources.find(
      r => r.type.includes('hyperperp::account::Account')
    );
    
    if (hyperperpAccount) {
      console.log('✅ HyperPerp account found');
      console.log('   Collateral:', hyperperpAccount.data.collateral);
    } else {
      console.log('❌ No HyperPerp account found');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

checkUserBalance();
