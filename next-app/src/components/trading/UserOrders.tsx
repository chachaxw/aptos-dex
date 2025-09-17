'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  X, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { MatchingEngineClient, Order } from '@/lib/matching-engine-client';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface UserOrdersProps {
  marketId: number;
  userAddress?: string;
  className?: string;
}

const ORDER_STATUS_CONFIG = {
  pending: { 
    icon: Clock, 
    color: 'text-yellow-600', 
    bg: 'bg-yellow-50', 
    label: 'Pending' 
  },
  partiallyfilled: { 
    icon: TrendingUp, 
    color: 'text-blue-600', 
    bg: 'bg-blue-50', 
    label: 'Partial' 
  },
  filled: { 
    icon: CheckCircle, 
    color: 'text-green-600', 
    bg: 'bg-green-50', 
    label: 'Filled' 
  },
  cancelled: { 
    icon: XCircle, 
    color: 'text-gray-600', 
    bg: 'bg-gray-50', 
    label: 'Cancelled' 
  },
  expired: { 
    icon: AlertCircle, 
    color: 'text-red-600', 
    bg: 'bg-red-50', 
    label: 'Expired' 
  },
};

export function UserOrders({ marketId, userAddress, className }: UserOrdersProps) {
  const { toast } = useToast();
  const [matchingEngine] = useState(() => new MatchingEngineClient());
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());

  const fetchOrders = async () => {
    if (!userAddress) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    try {
      const userOrders = await matchingEngine.getUserOrders(userAddress);
      const filteredOrders = userOrders.filter(order => order.market_id === marketId);
      setOrders(filteredOrders);
    } catch (error) {
      console.error('Failed to fetch user orders:', error);
      setOrders([]);
    }
    setIsLoading(false);
  };

  const refreshOrders = async () => {
    setIsRefreshing(true);
    await fetchOrders();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [userAddress, marketId]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!userAddress) return;
    
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [userAddress, marketId]);

  const handleCancelOrder = async (orderId: string) => {
    setCancellingOrders(prev => new Set(prev).add(orderId));

    try {
      const success = await matchingEngine.cancelOrder(orderId);
      
      if (success) {
        toast({
          title: "Order Cancelled",
          description: "Your order has been successfully cancelled",
        });

        // Update local state
        setOrders(prev => prev.map(order => 
          order.id === orderId 
            ? { ...order, status: 'cancelled' }
            : order
        ));
      } else {
        toast({
          title: "Cancellation Failed",
          description: "Order could not be cancelled (may already be filled)",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Cancellation Error",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setCancellingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const renderOrderRow = (order: Order) => {
    const statusConfig = ORDER_STATUS_CONFIG[order.status];
    const StatusIcon = statusConfig.icon;
    const fillPercentage = (parseFloat(order.filled_size) / parseFloat(order.size)) * 100;
    const isBuy = order.side === 'buy';
    const canCancel = ['pending', 'partiallyfilled'].includes(order.status);
    const isCancelling = cancellingOrders.has(order.id);

    return (
      <div
        key={order.id}
        className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 space-y-1">
          <div className="flex items-center space-x-2">
            {isBuy ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className={cn("text-sm font-medium", isBuy ? "text-green-600" : "text-red-600")}>
              {order.side.toUpperCase()}
            </span>
            <Badge variant="outline" className="text-xs">
              {order.order_type.toUpperCase()}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
            <div>
              <span>Size: </span>
              <span className="font-mono">{parseFloat(order.size).toFixed(3)}</span>
            </div>
            <div>
              <span>Price: </span>
              <span className="font-mono">
                {order.price ? `$${parseFloat(order.price).toFixed(2)}` : 'Market'}
              </span>
            </div>
            <div>
              <span>Filled: </span>
              <span className="font-mono">{fillPercentage.toFixed(1)}%</span>
            </div>
          </div>

          {/* Progress bar for partial fills */}
          {fillPercentage > 0 && fillPercentage < 100 && (
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={cn("h-1.5 rounded-full", isBuy ? "bg-green-500" : "bg-red-500")}
                style={{ width: `${fillPercentage}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Badge */}
          <Badge variant="outline" className={cn("text-xs", statusConfig.bg)}>
            <StatusIcon className={cn("w-3 h-3 mr-1", statusConfig.color)} />
            {statusConfig.label}
          </Badge>

          {/* Cancel Button */}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancelOrder(order.id)}
              disabled={isCancelling}
              className="text-xs px-2 py-1 h-auto"
            >
              {isCancelling ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const activeOrders = orders.filter(order => ['pending', 'partiallyfilled'].includes(order.status));
  const completedOrders = orders.filter(order => ['filled', 'cancelled', 'expired'].includes(order.status));

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Orders</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {orders.length} Total
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshOrders}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {!userAddress ? (
          <div className="text-center py-8 text-gray-500">
            {/* <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" /> */}
            <p>Connect wallet to view your orders</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-gray-400" />
            <p className="text-gray-500">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {/* <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" /> */}
            <p>No orders yet</p>
            <p className="text-xs mt-1">Your orders will appear here after submission</p>
          </div>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active" className="text-sm">
                Active ({activeOrders.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="text-sm">
                History ({completedOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
              <div className="max-h-80 overflow-y-auto">
                {activeOrders.length > 0 ? (
                  activeOrders.map(renderOrderRow)
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active orders</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="max-h-80 overflow-y-auto">
                {completedOrders.length > 0 ? (
                  completedOrders.map(renderOrderRow)
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No completed orders</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
