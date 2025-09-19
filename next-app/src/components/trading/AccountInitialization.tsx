'use client';

import React from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, UserPlus, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHyperPerpAccount } from '@/lib/useHyperPerpAccount';

interface AccountInitializationProps {
  className?: string;
}

export function AccountInitialization({ className }: AccountInitializationProps) {
  const { connected, account } = useWallet();
  const { isInitialized, isInitializing, error, initializeAccount } = useHyperPerpAccount();

  if (!connected || !account) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="text-center py-4 text-gray-500">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Connect your wallet to initialize your trading account</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isInitialized === null) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="text-center py-4">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-gray-600">Checking account status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <UserPlus className="w-5 h-5" />
          <span>Initialize Trading Account</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Before you can start trading, you need to initialize your HyperPerp account.</p>
          <p className="mt-1">This creates the necessary resources on the blockchain for your trading activities.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={initializeAccount}
          disabled={isInitializing}
          className="w-full"
        >
          {isInitializing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          {isInitializing ? 'Initializing...' : 'Initialize Account'}
        </Button>

        <div className="text-xs text-gray-500">
          <p>This will create a one-time transaction to set up your trading account.</p>
        </div>
      </CardContent>
    </Card>
  );
}
