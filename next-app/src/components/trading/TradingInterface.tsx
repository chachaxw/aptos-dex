"use client";

import React, { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Badge } from "@/components/ui/badge";

import { OrderBook } from "./OrderBook";
import { UserOrders } from "./UserOrders";
import { TradingChart } from "./TradingChart";
import { MarketSelector } from "./MarketSelector";
import AccountBalance from "./AccountBalance";
import { AccountInitialization } from "./AccountInitialization";

import { useToast } from "@/components/ui/use-toast";
import { useHyperPerpAccount } from "@/lib/useHyperPerpAccount";
import { OrderWithFreeze } from "./OrderWithFreeze";
import { CreateOrder } from "./CreateOrder";

const MARKETS = {
  1: { symbol: "BTC-USDC", name: "Bitcoin", icon: "₿" },
  2: { symbol: "ETH-USDC", name: "Ethereum", icon: "E" },
  3: { symbol: "SOL-USDC", name: "Solana", icon: "◎" },
};

export function TradingInterface() {
  const { account, connected } = useWallet();
  const { toast } = useToast();
  const { isInitialized } = useHyperPerpAccount();

  // Trading state
  const [selectedMarket, setSelectedMarket] = useState<number>(1);
  const [orderFormData, setOrderFormData] = useState({
    side: "Buy" as "Buy" | "Sell",
    price: "",
  });
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  const handleOrderSubmitted = (orderId: string, txHash: string) => {
    console.log("Order submitted:", orderId, txHash);
    setLastActivity(new Date());

    // Show success notification with trade details
    if (orderId) {
      toast({
        title: "Order Executed",
        description: `Order ${orderId} executed with tx hash ${txHash}`,
      });
    }
  };

  const handlePriceClick = (price: string, side: "Buy" | "Sell") => {
    setOrderFormData({ side, price });
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

      {/* Account Initialization Check */}
      {connected && account && isInitialized === false && (
        <div className="mb-4">
          <AccountInitialization />
        </div>
      )}

      {/* Main Trading Layout */}
      {connected && account && isInitialized !== false && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          {/* Left Column: Chart and Market Data */}
          <div className="lg:col-span-2 space-y-2">
            <TradingChart marketId={selectedMarket} className="h-full" />
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
              defaultSide={orderFormData.side}
              defaultPrice={orderFormData.price}
              marketId={selectedMarket}
              onOrderSubmitted={handleOrderSubmitted}
            />
          </div>
        </div>
      )}

      {connected && account && isInitialized !== false && (
        <UserOrders
          className="flex-1"
          marketId={selectedMarket}
          userAddress={account?.address?.toString()}
        />
      )}

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
