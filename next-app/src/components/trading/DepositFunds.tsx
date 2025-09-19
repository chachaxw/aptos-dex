'use client';

import React, { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useDeposit } from '@/lib/aptos-deposit';

interface DepositFundsProps {
  onDepositSuccess?: (amount: number, txHash: string) => void;
  className?: string;
}

export function DepositFunds({ onDepositSuccess, className }: DepositFundsProps) {
  const { connected, account } = useWallet();
  const { deposit, isConnected } = useDeposit();
  const { toast } = useToast();
  
  const [amount, setAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [lastDeposit, setLastDeposit] = useState<{ amount: number; txHash: string } | null>(null);

  const handleDeposit = async () => {
    if (!isConnected || !account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deposit funds",
        variant: "destructive",
      });
      return;
    }

    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount",
        variant: "destructive",
      });
      return;
    }

    // Convert to smallest units (1 APT = 100,000,000 smallest units)
    const amountInSmallestUnits = Math.floor(depositAmount * 100_000_000);
    
    // Minimum deposit check (1 APT)
    if (amountInSmallestUnits < 100_000_000) {
      toast({
        title: "Amount Too Small",
        description: "Minimum deposit is 1 APT",
        variant: "destructive",
      });
      return;
    }

    setIsDepositing(true);

    try {
      const result = await deposit(amountInSmallestUnits);
      
      setLastDeposit({
        amount: depositAmount,
        txHash: result.transaction_hash
      });

      toast({
        title: "Deposit Successful!",
        description: `Deposited ${depositAmount} APT to your trading account`,
      });

      // Notify parent component
      onDepositSuccess?.(depositAmount, result.transaction_hash);

      // Reset form
      setAmount('');

    } catch (error: any) {
      console.error('Deposit failed:', error);
      toast({
        title: "Deposit Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDepositing(false);
    }
  };

  const handleMaxDeposit = () => {
    // For demo purposes, set to 10 APT
    // In a real app, you'd check the user's actual APT balance
    setAmount('10');
  };

  if (!connected) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Deposit Funds</span>
          </CardTitle>
          <CardDescription>
            Deposit APT to your trading account to place orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to deposit funds
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <span>Deposit Funds</span>
        </CardTitle>
        <CardDescription>
          Deposit APT to your trading account to place orders
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {lastDeposit && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="font-medium">Last Deposit: {lastDeposit.amount} APT</div>
              <div className="text-xs font-mono">
                TX: {lastDeposit.txHash.slice(0, 8)}...{lastDeposit.txHash.slice(-8)}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="deposit-amount">Amount (APT)</Label>
          <div className="flex space-x-2">
            <Input
              id="deposit-amount"
              type="number"
              placeholder="1.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="0.1"
              disabled={isDepositing}
            />
            <Button
              variant="outline"
              onClick={handleMaxDeposit}
              disabled={isDepositing}
            >
              Max
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Minimum deposit: 1 APT
          </p>
        </div>

        <Button
          onClick={handleDeposit}
          disabled={isDepositing || !amount || parseFloat(amount) < 1}
          className="w-full"
        >
          {isDepositing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Depositing...
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4 mr-2" />
              Deposit APT
            </>
          )}
        </Button>

        <div className="text-xs text-gray-500 space-y-1">
          <div>Account: {account?.address?.toString().slice(0, 8)}...{account?.address?.toString().slice(-8)}</div>
          <div>Network: Devnet</div>
        </div>
      </CardContent>
    </Card>
  );
}
