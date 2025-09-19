"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAccountBalance,
  formatCurrency,
  AptosBalance,
} from "@/lib/aptos-balance";

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
        lastUpdated: aptBalance.lastUpdated,
      };

      setBalance(mockBalance);
    } catch (err) {
      console.error("Error fetching balance:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
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
            <div className="text-base font-medium font-mono">
              {formatCurrency(balance.apt.apt, "USDC")}
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
