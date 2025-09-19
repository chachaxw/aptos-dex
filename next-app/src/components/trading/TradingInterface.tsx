"use client";

import React, { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, Wallet, BarChart3, Clock } from "lucide-react";

import { CreateOrder } from "./CreateOrder";
import { OrderBook } from "./OrderBook";
import { UserOrders } from "./UserOrders";
import { TradingChart } from "./TradingChart";
import { MarketSelector } from "./MarketSelector";
import { PositionPanel } from "./PositionPanel";
import AccountBalance from "./AccountBalance";
import { DepositFunds } from "./DepositFunds";

import { OrderResponse } from "@/lib/matching-engine-client";
import { useToast } from "@/components/ui/use-toast";

const MARKETS = {
  1: { symbol: "BTC-USDC", name: "Bitcoin", icon: "₿" },
  2: { symbol: "ETH-USDC", name: "Ethereum", icon: "E" },
  3: { symbol: "SOL-USDC", name: "Solana", icon: "◎" },
};

export function TradingInterface() {
  const { account, connected } = useWallet();
  const { toast } = useToast();

  // Trading state
  const [selectedMarket, setSelectedMarket] = useState<number>(1);
  const [orderFormData, setOrderFormData] = useState({
    side: "Buy" as "Buy" | "Sell",
    price: "",
  });
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  const handleOrderSubmitted = (response: OrderResponse) => {
    console.log("Order submitted:", response);
    setLastActivity(new Date());

    // Show success notification with trade details
    if (response.trades.length > 0) {
      const totalFilled = response.trades.reduce(
        (sum, trade) => sum + parseFloat(trade.size),
        0
      );
      const avgPrice =
        response.trades.reduce(
          (sum, trade) =>
            sum + parseFloat(trade.price) * parseFloat(trade.size),
          0
        ) /
        response.trades.reduce((sum, trade) => sum + parseFloat(trade.size), 0);

      toast({
        title: "Order Executed",
        description: `Filled ${totalFilled.toFixed(3)} ${
          MARKETS[selectedMarket as keyof typeof MARKETS].symbol.split("-")[0]
        } @ $${avgPrice.toFixed(2)}`,
      });
    }
  };

  const handlePriceClick = (price: string, side: "Buy" | "Sell") => {
    setOrderFormData({ side, price });
  };

  const handleDepositSuccess = (amount: number, txHash: string) => {
    toast({
      title: "Deposit Successful!",
      description: `Deposited ${amount} APT to your trading account`,
    });

    // Update last activity
    setLastActivity(new Date());
  };

  const market = MARKETS[selectedMarket as keyof typeof MARKETS];

  return (
    <div className="mx-auto p-4 space-y-2">
      {/* Market Selector */}
      <MarketSelector
        selectedMarket={selectedMarket}
        onMarketChange={setSelectedMarket}
        markets={MARKETS}
      />

      {/* Alerts */}
      {!connected && (
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription>
            Connect your wallet to start trading on HyperPerp
          </AlertDescription>
        </Alert>
      )}

      {/* Main Trading Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Left Column: Chart and Market Data */}
        <div className="lg:col-span-2 space-y-2">
          <TradingChart marketId={selectedMarket} />
          <PositionPanel marketId={selectedMarket} />
        </div>

        {/* Middle Column: Order Book */}
        <div className="space-y-2">
          <OrderBook
            marketId={selectedMarket}
            onPriceClick={handlePriceClick}
            className="h-full"
          />
        </div>

        {/* Right Column: Order Entry and Management */}
        <div className="space-y-2">
          <AccountBalance />
          <CreateOrder
            marketId={selectedMarket}
            defaultSide={orderFormData.side}
            defaultPrice={orderFormData.price}
            onOrderSubmitted={handleOrderSubmitted}
          />
          <DepositFunds onDepositSuccess={handleDepositSuccess} />
        </div>
      </div>

      <UserOrders
        marketId={selectedMarket}
        userAddress={account?.address?.toString()}
      />

      {/* Footer Status */}
      <div className="flex items-center justify-between text-xs text-gray-500 py-4 border-t">
        <div className="flex items-center space-x-4">
          <span>Last Activity: {lastActivity.toLocaleTimeString()}</span>
          <span>Market: {market.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Powered by HyperPerp</span>
          <Badge variant="outline" className="text-xs">
            v1.0.0
          </Badge>
        </div>
      </div>
    </div>
  );
}
