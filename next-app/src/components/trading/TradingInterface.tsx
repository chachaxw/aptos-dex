'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Wallet, 
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle 
} from 'lucide-react';

import { CreateOrder } from './CreateOrder';
import { OrderBook } from './OrderBook';
import { UserOrders } from './UserOrders';
import { TradingChart } from './TradingChart';
import { MarketSelector } from './MarketSelector';
import { PositionPanel } from './PositionPanel';

import { MatchingEngineClient, OrderResponse } from '@/lib/matching-engine-client';
import { useToast } from '@/components/ui/use-toast';

const MARKETS = {
  1: { symbol: 'BTC-USD', name: 'Bitcoin', icon: '₿' },
  2: { symbol: 'ETH-USD', name: 'Ethereum', icon: 'E' },
  3: { symbol: 'SOL-USD', name: 'Solana', icon: '◎' },
};

export function TradingInterface() {
  const { account, connected } = useWallet();
  const { toast } = useToast();
  const [matchingEngine] = useState(() => new MatchingEngineClient());

  // Trading state
  const [selectedMarket, setSelectedMarket] = useState<number>(1);
  const [orderFormData, setOrderFormData] = useState({
    side: 'buy' as 'buy' | 'sell',
    price: '',
  });
  const [isEngineOnline, setIsEngineOnline] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  // Check matching engine status
  useEffect(() => {
    const checkEngineHealth = async () => {
      const healthy = await matchingEngine.isHealthy();
      setIsEngineOnline(healthy);
      if (healthy) {
        setLastActivity(new Date());
      }
    };

    checkEngineHealth();
    const interval = setInterval(checkEngineHealth, 5000);
    return () => clearInterval(interval);
  }, [matchingEngine]);

  const handleOrderSubmitted = (response: OrderResponse) => {
    console.log('Order submitted:', response);
    setLastActivity(new Date());
    
    // Show success notification with trade details
    if (response.trades.length > 0) {
      const totalFilled = response.trades.reduce((sum, trade) => sum + parseFloat(trade.size), 0);
      const avgPrice = response.trades.reduce((sum, trade) => sum + parseFloat(trade.price) * parseFloat(trade.size), 0) / 
                      response.trades.reduce((sum, trade) => sum + parseFloat(trade.size), 0);
      
      toast({
        title: "Order Executed",
        description: `Filled ${totalFilled.toFixed(3)} ${MARKETS[selectedMarket as keyof typeof MARKETS].symbol.split('-')[0]} @ $${avgPrice.toFixed(2)}`,
      });
    }
  };

  const handlePriceClick = (price: string, side: 'buy' | 'sell') => {
    setOrderFormData({ side, price });
  };

  const market = MARKETS[selectedMarket as keyof typeof MARKETS];

  return (
    <div className="mx-auto p-4 space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">HyperPerp Trading</h1>
          <Badge variant="outline" className="flex items-center space-x-1">
            <span className="text-2xl">{market.icon}</span>
            <span className="font-medium">{market.symbol}</span>
          </Badge>
        </div>

        <div className="flex items-center space-x-4">
          {/* Engine Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isEngineOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              Engine {isEngineOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

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

      {!isEngineOnline && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Matching engine is offline. Orders will queue until reconnected.
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
          <CreateOrder
            marketId={selectedMarket}
            defaultSide={orderFormData.side}
            defaultPrice={orderFormData.price}
            onOrderSubmitted={handleOrderSubmitted}
          />
          
          <UserOrders
            marketId={selectedMarket}
            userAddress={account?.address?.toString()}
          />
        </div>
      </div>

      {/* Bottom Section: Trading History and Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Trading History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Trading history will appear here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Market Statistics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">24h Volume:</span>
                <span className="ml-2 font-mono">$0</span>
              </div>
              <div>
                <span className="text-gray-500">24h Change:</span>
                <span className="ml-2 font-mono text-green-600">+0.00%</span>
              </div>
              <div>
                <span className="text-gray-500">Open Interest:</span>
                <span className="ml-2 font-mono">$0</span>
              </div>
              <div>
                <span className="text-gray-500">Funding Rate:</span>
                <span className="ml-2 font-mono">0.0100%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
