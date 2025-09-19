'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AptosClient } from 'aptos';
import { useToast } from '@/components/ui/use-toast';

const NODE_URL = process.env.NEXT_PUBLIC_APTOS_NODE_URL || 'https://fullnode.testnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x';

const client = new AptosClient(NODE_URL);

export function useHyperPerpAccount() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAccountStatus = useCallback(async () => {
    if (!account?.address) {
      setIsInitialized(null);
      return;
    }

    try {
      const resources = await client.getAccountResources(account.address.toString());
      
      // Check for HyperPerp account resource
      const hyperperpAccount = resources.find(r => 
        r.type.includes('hyperperp::account::Account') || 
        r.type.includes(`${CONTRACT_ADDRESS}::account::Account`)
      );

      console.log('🔍 HyperPerp account resource:', hyperperpAccount);
      
      setIsInitialized(!!hyperperpAccount);
      setError(null);
      
      if (hyperperpAccount) {
        console.log('✅ HyperPerp account already initialized');
        console.log('   Collateral:', hyperperpAccount.data.collateral);
      }
      
    } catch (err: any) {
      console.error('Failed to check account status:', err);
      setError(err.message);
      setIsInitialized(false);
    }
  }, [account?.address]);

  const initializeAccount = useCallback(async () => {
    if (!account?.address || !signAndSubmitTransaction) {
      setError('Wallet not connected');
      return false;
    }

    setIsInitializing(true);
    setError(null);

    try {
      console.log('🔧 Initializing HyperPerp Account...');
      
      // Check if already initialized
      await checkAccountStatus();
      if (isInitialized) {
        console.log('Account already initialized');
        return true;
      }

      // Initialize account
      const payload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::account::open` as `${string}::${string}::${string}`,
        typeArguments: [],
        functionArguments: [],
      };

      console.log('📝 Creating account initialization transaction...');
      console.log('Function:', payload.function);
      
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: payload,
      });

      console.log('⏳ Waiting for transaction confirmation...');

      await client.waitForTransaction(response.hash);

      console.log('✅ Account initialized successfully!');
      console.log('   Transaction hash:', response.hash);
      
      setIsInitialized(true);

      toast({
        title: "Account Initialized",
        description: "Your HyperPerp trading account is ready!",
      });

      return true;

    } catch (err: any) {
      console.error('❌ Error initializing account:', err);
      setError(err.message || 'Failed to initialize account');
      
      toast({
        title: "Initialization Failed",
        description: err.message || "Failed to initialize your trading account",
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [account?.address, signAndSubmitTransaction, checkAccountStatus, isInitialized, toast]);

  // Check account status when wallet connects
  useEffect(() => {
    if (connected && account?.address) {
      checkAccountStatus();
    } else {
      setIsInitialized(null);
      setError(null);
    }
  }, [connected, account?.address, checkAccountStatus]);

  return {
    isInitialized,
    isInitializing,
    error,
    initializeAccount,
    checkAccountStatus,
  };
}
