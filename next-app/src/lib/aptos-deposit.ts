/**
 * Aptos Deposit Utilities
 * Handles user deposit transactions with proper wallet signing
 */

import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AptosClient, TxnBuilderTypes, BCS } from 'aptos';

const NODE_URL = process.env.NEXT_PUBLIC_APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x95b011ec2dfc71780ec8bf5d4b229dee8de07d26f1867f50fd32cf3028a22e50';

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
  const state = await client.getState();
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 30; // 30 seconds from now
  
  // Create deposit transaction payload
  const payload = {
    type: "entry_function_payload",
    function: `${CONTRACT_ADDRESS}::vault::deposit`,
    type_arguments: ["0x1::aptos_coin::AptosCoin"],
    arguments: [amount.toString(), CONTRACT_ADDRESS]
  };
  
  // Generate raw transaction
  const rawTxn = await client.generateTransaction(userAddress, payload);
  
  // Convert to BCS
  const bcsTxn = AptosClient.generateBCSTransaction(
    new TxnBuilderTypes.RawTransaction(
      new TxnBuilderTypes.AccountAddress(TxnBuilderTypes.hexToBytes(userAddress)),
      BigInt(sequenceNumber),
      new TxnBuilderTypes.TransactionPayloadEntryFunction(
        new TxnBuilderTypes.EntryFunction(
          new TxnBuilderTypes.ModuleId(
            new TxnBuilderTypes.AccountAddress(TxnBuilderTypes.hexToBytes(CONTRACT_ADDRESS)),
            new TxnBuilderTypes.Identifier("vault")
          ),
          new TxnBuilderTypes.Identifier("deposit"),
          [new TxnBuilderTypes.TypeTagStruct(new TxnBuilderTypes.StructTag(
            new TxnBuilderTypes.AccountAddress(TxnBuilderTypes.hexToBytes("0x1")),
            new TxnBuilderTypes.Identifier("aptos_coin"),
            new TxnBuilderTypes.Identifier("AptosCoin"),
            []
          ))],
          [BCS.bcsToBytes(amount), BCS.bcsToBytes(CONTRACT_ADDRESS)]
        )
      ),
      BigInt(100000), // max gas amount
      BigInt(100), // gas unit price
      BigInt(expirationTimestamp), // expiration timestamp
      new TxnBuilderTypes.ChainId(1) // devnet chain ID
    )
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
  const response = await client.submitTransaction(signedTransaction);
  
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
    
    // Create deposit transaction payload
    const payload = {
      type: "entry_function_payload",
      function: `${CONTRACT_ADDRESS}::vault::deposit`,
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: [amount.toString(), CONTRACT_ADDRESS]
    };

    console.log('Deposit payload:', payload);
    
    // Sign and submit transaction
    const response = await signAndSubmitTransaction(payload);
    
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
