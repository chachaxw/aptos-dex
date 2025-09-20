"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  ArrowUp,
  ArrowDown,
  Zap,
} from "lucide-react";
import {
  MatchingEngineClient,
  OrderBook as OrderBookData,
  OrderBookLevel,
  Trade,
} from "@/lib/matching-engine-client";
import { cn } from "@/lib/utils";

interface OrderBookProps {
  marketId?: number;
  className?: string;
  onPriceClick?: (price: string, side: "Buy" | "Sell") => void;
}

const MARKETS = {
  1: { symbol: "BTC-USDC", decimals: 2 },
  2: { symbol: "ETH-USDC", decimals: 2 },
  3: { symbol: "SOL-USDC", decimals: 3 },
};

export function OrderBook({
  marketId = 1,
  onPriceClick,
  className,
}: OrderBookProps) {
  const [matchingEngine] = useState(() => new MatchingEngineClient());
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [spread, setSpread] = useState<{
    absolute: number;
    percentage: number;
  } | null>(null);
  const [midPrice, setMidPrice] = useState<number | null>(null);

  const market = MARKETS[marketId as keyof typeof MARKETS];

  // Calculate spread and mid price
  useEffect(() => {
    if (orderBook && orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      const bestBid = parseFloat(orderBook.bids[0].price);
      const bestAsk = parseFloat(orderBook.asks[0].price);
      const absoluteSpread = bestAsk - bestBid;
      const percentageSpread = (absoluteSpread / bestBid) * 100;
      const calculatedMidPrice = (bestBid + bestAsk) / 2;

      setSpread({ absolute: absoluteSpread, percentage: percentageSpread });
      setMidPrice(calculatedMidPrice);
    } else {
      setSpread(null);
      setMidPrice(null);
    }
  }, [orderBook]);

  const fetchOrderBook = useCallback(async () => {
    try {
      const data = await matchingEngine.getOrderBook(marketId);
      setOrderBook(data);
    } catch (error) {
      console.error("Failed to fetch order book:", error);
      // Set empty order book on error
      setOrderBook({
        market_id: marketId,
        bids: [],
        asks: [],
        last_updated: new Date().toISOString(),
      });
    }
  }, [matchingEngine, marketId]);

  const fetchRecentTrades = useCallback(async () => {
    try {
      const { trades } = await matchingEngine.getRecentTrades(marketId);
      setRecentTrades(trades);
    } catch (error) {
      console.error("Failed to fetch recent trades:", error);
      setRecentTrades([]);
    }
  }, [matchingEngine, marketId]);

  const refreshData = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchOrderBook(), fetchRecentTrades()]);
    setIsRefreshing(false);
  };

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchOrderBook(), fetchRecentTrades()]);
      setIsLoading(false);
    };

    loadData();
  }, [fetchOrderBook, fetchRecentTrades]);

  // Auto-refresh every 2 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrderBook, 2000);
    return () => clearInterval(interval);
  }, [fetchOrderBook]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = matchingEngine.connectWebSocket(
      (updatedOrderBook) => {
        if (updatedOrderBook.market_id === marketId) {
          setOrderBook(updatedOrderBook);
        }
      },
      (trade) => {
        if (trade.market_id === marketId) {
          setRecentTrades((prev) => [trade, ...prev.slice(0, 19)]);
        }
      }
    );

    return () => {
      ws?.close();
    };
  }, [matchingEngine, marketId]);

  const renderOrderBookLevel = (
    level: OrderBookLevel,
    side: "bid" | "ask",
    maxSize: number
  ) => {
    const sizePercentage = (parseFloat(level.size) / maxSize) * 100;
    const isBid = side === "bid";

    return (
      <div
        key={level.price}
        className={cn(
          "relative flex items-center justify-between px-2 py-1 text-xs cursor-pointer hover:bg-gray-50 transition-colors",
          isBid ? "hover:bg-green-50" : "hover:bg-red-50"
        )}
        onClick={() => onPriceClick?.(level.price, isBid ? "Buy" : "Sell")}
      >
        {/* Size bar background */}
        <div
          className={cn(
            "absolute inset-0 opacity-20",
            isBid ? "bg-green-500" : "bg-red-500"
          )}
          style={{ width: `${sizePercentage}%` }}
        />

        {/* Content */}
        <div className="relative z-10 w-full grid grid-cols-3">
          <span
            className={cn(
              "font-mono",
              isBid ? "text-green-600" : "text-red-600"
            )}
          >
            ${parseFloat(level.price).toFixed(market.decimals)}
          </span>
          <span className="font-mono text-gray-600 text-end">
            {parseFloat(level.size).toFixed(3)}
          </span>
          <span className="text-gray-400 text-end">{level.order_count}</span>
        </div>
      </div>
    );
  };

  const renderTradeItem = (trade: Trade, index: number) => {
    const isBuyerTaker = trade.side === "Buy";
    const timeAgo = new Date(trade.created_at).toLocaleTimeString();

    return (
      <div
        key={trade.id}
        className={cn(
          "flex items-center justify-between px-2 py-1 text-xs",
          index % 2 === 0 ? "bg-gray-50" : "bg-white"
        )}
      >
        <div className="flex items-center space-x-2">
          {isBuyerTaker ? (
            <ArrowUp className="w-3 h-3 text-green-500" />
          ) : (
            <ArrowDown className="w-3 h-3 text-red-500" />
          )}
          <span
            className={cn(
              "font-mono",
              isBuyerTaker ? "text-green-600" : "text-red-600"
            )}
          >
            ${parseFloat(trade.price).toFixed(market.decimals)}
          </span>
        </div>
        <span className="font-mono text-gray-600">
          {parseFloat(trade.size).toFixed(3)}
        </span>
        <span className="text-gray-400 text-xs">{timeAgo}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxBidSize = Math.max(
    ...(orderBook?.bids.map((b) => parseFloat(b.size)) || [0])
  );
  const maxAskSize = Math.max(
    ...(orderBook?.asks.map((a) => parseFloat(a.size)) || [0])
  );
  const maxSize = Math.max(maxBidSize, maxAskSize);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{market.symbol} Order Book</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("w-4 h-4", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="book" className="w-full px-2" onValueChange={() => refreshData()}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="book">Book</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="depth">Depth</TabsTrigger>
          </TabsList>

          <TabsContent value="book" className="mt-0">
            <div className="space-y-0">
              {/* Header */}
              <div className="grid grid-cols-3 items-center px-2 py-2 text-xs font-medium text-gray-500 border-b">
                <span>Price (USD)</span>
                <span className="text-end">Size</span>
                <span className="text-end">Orders</span>
              </div>

              {/* Asks (Sell Orders) */}
              <div className="space-y-0">
                {orderBook?.asks
                  .slice(0, 10)
                  .map((level) => renderOrderBookLevel(level, "ask", maxSize))}
              </div>

              {/* Spread Indicator */}
              {spread && (
                <div className="flex items-center justify-center py-2 bg-gray-100 border-y">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Spread</div>
                    <div className="font-mono text-sm font-medium">
                      ${spread.absolute.toFixed(market.decimals)} (
                      {spread.percentage.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              )}

              {/* Bids (Buy Orders) */}
              <div className="space-y-0">
                {orderBook?.bids
                  .slice(0, 10)
                  .map((level) => renderOrderBookLevel(level, "bid", maxSize))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trades" className="mt-0">
            <div className="space-y-0">
              {/* Header */}
              <div className="flex items-center justify-between px-2 py-2 text-xs font-medium text-gray-500 border-b">
                <span>Side</span>
                <span>Price (USD)</span>
                <span>Size</span>
                <span>Time</span>
              </div>

              {/* Recent Trades */}
              <div className="max-h-96 overflow-y-auto">
                {recentTrades.length > 0 ? (
                  recentTrades.map(renderTradeItem)
                ) : (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <div className="text-center">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No recent trades</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="depth" className="mt-0">
            <div className="p-4 space-y-4">
              {/* Depth Chart Visualization */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Market Depth</h4>

                {/* Asks Depth */}
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 flex items-center">
                    <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                    Asks (Sell Orders)
                  </div>
                  {orderBook?.asks.slice(0, 5).map((level, index) => {
                    const percentage = (parseFloat(level.size) / maxSize) * 100;
                    return (
                      <div key={level.price} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>
                            ${parseFloat(level.price).toFixed(market.decimals)}
                          </span>
                          <span>{parseFloat(level.size).toFixed(3)}</span>
                        </div>
                        <Progress
                          value={percentage}
                          className="h-1 bg-red-100"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Bids Depth */}
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                    Bids (Buy Orders)
                  </div>
                  {orderBook?.bids.slice(0, 5).map((level, index) => {
                    const percentage = (parseFloat(level.size) / maxSize) * 100;
                    return (
                      <div key={level.price} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>
                            ${parseFloat(level.price).toFixed(market.decimals)}
                          </span>
                          <span>{parseFloat(level.size).toFixed(3)}</span>
                        </div>
                        <Progress
                          value={percentage}
                          className="h-1 bg-green-100"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Market Stats */}
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-sm font-medium">Market Statistics</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Total Bids:</span>
                    <span className="ml-1 font-mono">
                      {orderBook?.bids
                        .reduce((sum, bid) => sum + parseFloat(bid.size), 0)
                        .toFixed(3) || "0"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Asks:</span>
                    <span className="ml-1 font-mono">
                      {orderBook?.asks
                        .reduce((sum, ask) => sum + parseFloat(ask.size), 0)
                        .toFixed(3) || "0"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bid Orders:</span>
                    <span className="ml-1 font-mono">
                      {orderBook?.bids.length || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Ask Orders:</span>
                    <span className="ml-1 font-mono">
                      {orderBook?.asks.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
