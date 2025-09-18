'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  className 
}: MarketSelectorProps) {
  // Mock market data (would come from API/WebSocket in production)
  const marketData = {
    1: { price: 43250.50, change: 2.45, volume: 1234567.89 },
    2: { price: 2650.75, change: -1.23, volume: 987654.32 },
    3: { price: 98.45, change: 5.67, volume: 456789.12 },
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
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
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{market.icon}</span>
                    <div className="text-left">
                      <div className="font-medium text-sm">{market.symbol}</div>
                      <div className={cn("text-xs text-gray-500", isSelected && "text-white")}>{market.name}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between w-full">
                  <div className="text-left">
                    <div className="font-mono font-semibold">
                      ${data.price.toLocaleString()}
                    </div>
                    <div className={cn("text-xs text-gray-500", isSelected && "text-white")}>
                      Vol: ${(data.volume / 1000).toFixed(0)}K
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 text-green-600" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-600" />
                    )}
                    <span className={cn(
                      "text-sm font-medium",
                      isPositive ? "text-green-600" : "text-red-600"
                    )}>
                      {isPositive ? '+' : ''}{data.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
