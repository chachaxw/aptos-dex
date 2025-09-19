/**
 * Aptos Deposit Utilities
 * Handles user deposit transactions with proper wallet signing
 */

import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AptosClient, AptosAccount } from 'aptos';

const NODE_URL = process.env.NEXT_PUBLIC_APTOS_NODE_URL || 'https://fullnode.testnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x517206cb6757cc0723667a05afb9c05675341cd79570ba7cfb72f63241d55a2e';
const aptCoinStoreType = `0x1::coin::CoinStore<0x29b0681a76b20595201859a5d2b269ae9d1fe98251198cefa513c95267003c0c::mint_test_coin::Coin>`;

export interface DepositTransaction {
  transaction: string; // BCS-encoded transaction
  expiration_timestamp_secs: string;
}

export interface DepositRequest {
  user_address: string;
  amount: number; // in smallest units (e.g., 1000000 for 1 APT)
}

export interface DepositResponse {
  transaction_hash: string;
  amount: number;
  user_address: string;
}

/**
 * Generate a deposit transaction for the user to sign
 */
export async function generateDepositTransaction(
  userAddress: string,
  amount: number
): Promise<DepositTransaction> {
  const client = new AptosClient(NODE_URL);
  
  // Get user's sequence number
  const resources = await client.getAccountResources(userAddress);
  const accountResource = resources.find(r => r.type === '0x1::account::Account');
  if (!accountResource) {
    throw new Error('Account not found');
  }
  
  const sequenceNumber = parseInt((accountResource.data as any).sequence_number);
  
  // Get current timestamp
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 30; // 30 seconds from now
  
  // Create deposit transaction payload
  const payload = {
    type: "entry_function_payload",
    function: `${CONTRACT_ADDRESS}::vault_coin::deposit`,
    type_arguments: ["0x29b0681a76b20595201859a5d2b269ae9d1fe98251198cefa513c95267003c0c::mint_test_coin::Coin"],
    arguments: [amount.toString(), CONTRACT_ADDRESS]
  };
  
  // Generate raw transaction
  const rawTxn = await client.generateTransaction(userAddress, payload);
  
  // Convert to BCS
  const bcsTxn = AptosClient.generateBCSTransaction(
    new AptosAccount(),
    rawTxn
  );
  
  return {
    transaction: Buffer.from(bcsTxn).toString('base64'),
    expiration_timestamp_secs: expirationTimestamp.toString()
  };
}

/**
 * Submit a signed deposit transaction
 */
export async function submitDepositTransaction(
  signedTransaction: string
): Promise<DepositResponse> {
  const client = new AptosClient(NODE_URL);
  
  // Submit the signed transaction
  const response = await client.submitTransaction(Uint8Array.from(signedTransaction));
  
  // Wait for confirmation
  await client.waitForTransaction(response.hash);
  
  return {
    transaction_hash: response.hash,
    amount: 0, // Will be filled by the caller
    user_address: '' // Will be filled by the caller
  };
}

/**
 * Hook for deposit functionality
 */
export function useDeposit() {
  const { account, signAndSubmitTransaction, connected } = useWallet();
  
  const deposit = async (amount: number): Promise<DepositResponse> => {
    if (!connected || !account) {
      throw new Error('Wallet not connected');
    }
    
    if (!signAndSubmitTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    const client = new AptosClient(NODE_URL);
    
    // 1. Check if the user's account has registered for the test coin
    const resources = await client.getAccountResources(account.address.toString());
    const hasCoinStore = resources.some(r => r.type === aptCoinStoreType);

    console.log('Has coin store:', hasCoinStore, amount);

    // 2. Create deposit transaction payload
    const payload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::vault_coin::deposit` as `${string}::${string}::${string}`,
      typeArguments: ["0x29b0681a76b20595201859a5d2b269ae9d1fe98251198cefa513c95267003c0c::mint_test_coin::Coin"],
      functionArguments: [CONTRACT_ADDRESS, amount.toString()],
    };

    console.log('Deposit payload:', payload);

    // 3. Sign and submit transaction using wallet
    const response = await signAndSubmitTransaction({
      sender: account.address,
      data: payload,
    });

    // 4. Wait for confirmation
    await client.waitForTransaction(response.hash);
    
    return {
      transaction_hash: response.hash,
      amount: amount,
      user_address: account.address.toString()
    };
  };
  
  return {
    deposit,
    isConnected: connected,
    account
  };
}
