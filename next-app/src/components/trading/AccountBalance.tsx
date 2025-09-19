'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wallet,
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAccountBalance, formatCurrency, formatPercentage, AptosBalance } from '@/lib/aptos-balance';

interface AccountBalanceProps {
  className?: string;
}

interface BalanceData {
  apt: AptosBalance;
  total: number;
  available: number;
  locked: number;
  pnl: number;
  pnlPercentage: number;
  lastUpdated: Date;
}

export default function AccountBalance({ className }: AccountBalanceProps) {
  const { account, connected } = useWallet();
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = React.useCallback(async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch real APT balance from Aptos blockchain
      const aptBalance = await getAccountBalance(account.address.toString());

      // Mock additional balance data for demo purposes
      // In a real implementation, you would fetch this from your contract
      const mockBalance: BalanceData = {
        apt: aptBalance,
        total: aptBalance.usd,
        available: aptBalance.usd * 0.8, // 80% available
        locked: aptBalance.usd * 0.2, // 20% locked in positions
        pnl: aptBalance.usd * 0.05, // 5% PnL
        pnlPercentage: 5.0,
        lastUpdated: aptBalance.lastUpdated
      };

      setBalance(mockBalance);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    if (connected && account?.address) {
      fetchBalance();
    } else {
      setBalance(null);
      setError(null);
    }
  }, [connected, account?.address, fetchBalance]);


  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Wallet className="w-5 h-5" />
            <span>Account Balance</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchBalance}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-center space-x-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : balance ? (
          <>
            {/* Total Balance */}
            <div className="text-center">
              <div className="text-xl font-bold font-mono">
                {formatCurrency(balance.apt.apt, 'USDC')}
              </div>
              <div className="flex items-center justify-center space-x-2 mt-2">
                {balance.pnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  balance.pnl >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(balance.pnl)} ({formatPercentage(balance.pnlPercentage)})
                </span>
              </div>
            </div>

            {/* Balance Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Available</span>
                <span className="font-mono text-sm font-medium">
                  {formatCurrency(balance.available)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Locked in Positions</span>
                <span className="font-mono text-sm font-medium">
                  {formatCurrency(balance.locked)}
                </span>
              </div>

              {/* Usage Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Margin Usage</span>
                  <span className="text-sm font-medium text-green-600">
                    {((balance.locked / balance.total) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(balance.locked / balance.total) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Used: {formatCurrency(balance.locked)}</span>
                  <span>Available: {formatCurrency(balance.available)}</span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-gray-500">Status</span>
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </div>

            {/* Last Updated */}
            <div className="text-xs text-gray-500 text-center">
              Last updated: {balance.lastUpdated.toLocaleTimeString()}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p>Loading balance...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
