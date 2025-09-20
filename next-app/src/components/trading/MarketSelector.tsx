"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Market {
  symbol: string;
  name: string;
  icon: string;
}

interface MarketSelectorProps {
  selectedMarket: number;
  onMarketChange: (marketId: number) => void;
  markets: Record<number, Market>;
  className?: string;
}

export function MarketSelector({
  selectedMarket,
  onMarketChange,
  markets,
  className,
}: MarketSelectorProps) {
  // Mock market data (would come from API/WebSocket in production)
  const marketData = {
    1: { price: 117000.5, change: 2.45, volume: 1234567.89 },
    2: { price: 4574, change: 3.45, volume: 987654.32 },
    3: { price: 245.45, change: 5.67, volume: 456789.12 },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {Object.entries(markets).map(([id, market]) => {
        const marketId = parseInt(id);
        const isSelected = selectedMarket === marketId;
        const data = marketData[marketId as keyof typeof marketData];
        const isPositive = data.change >= 0;

        return (
          <Button
            key={marketId}
            variant={isSelected ? "default" : "outline"}
            onClick={() => onMarketChange(marketId)}
            className={cn(
              "h-auto p-4 flex flex-col items-start space-y-2",
              isSelected && "ring-2 ring-blue-100"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="text-left">
                <div className="font-medium text-sm">{market.symbol}</div>
                <div
                  className={cn(
                    "text-xs text-gray-500",
                    isSelected && "text-white"
                  )}
                >
                  {market.name}
                </div>
              </div>
              <div className="text-left">
                <div className="font-mono font-semibold">
                  ${data.price.toLocaleString()}
                </div>
                <div
                  className={cn(
                    "text-xs text-gray-500",
                    isSelected && "text-white"
                  )}
                >
                  Vol: ${(data.volume / 1000).toFixed(0)}K
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 text-green-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                )}
                <span
                  className={cn(
                    "text-lg font-medium",
                    isPositive ? "text-green-600" : "text-red-600"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {data.change.toFixed(2)}%
                </span>
              </div>
            </div>
          </Button>
        );
      })}
    </div>
  );
}
