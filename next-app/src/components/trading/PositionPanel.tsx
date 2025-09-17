'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  DollarSign,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PositionPanelProps {
  marketId: number;
  className?: string;
}

interface Position {
  market_id: number;
  size: number;
  entry_price: number;
  mark_price: number;
  unrealized_pnl: number;
  margin_used: number;
  margin_ratio: number;
  liquidation_price: number;
}

export function PositionPanel({ marketId, className }: PositionPanelProps) {
  // Mock position data (would come from contract queries in production)
  const [position, setPosition] = useState<Position | null>({
    market_id: marketId,
    size: 0.5, // Long 0.5 BTC
    entry_price: 42500.00,
    mark_price: 43250.50,
    unrealized_pnl: 375.25,
    margin_used: 2125.00,
    margin_ratio: 0.15, // 15% margin usage
    liquidation_price: 35000.00,
  });

  const [accountBalance, setAccountBalance] = useState({
    total_balance: 10000.00,
    available_balance: 7875.00,
    margin_used: 2125.00,
  });

  useEffect(() => {
    // In production, fetch position data from Move contracts
    // and account balance from wallet/contract queries
  }, [marketId]);

  if (!position || position.size === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Position</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No open position</p>
            <p className="text-xs mt-1">Open a position to start trading</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLong = position.size > 0;
  const positionValue = Math.abs(position.size) * position.mark_price;
  const pnlPercentage = (position.unrealized_pnl / (Math.abs(position.size) * position.entry_price)) * 100;
  const isProfit = position.unrealized_pnl >= 0;

  // Risk calculations
  const marginRatio = position.margin_ratio;
  const riskLevel = marginRatio < 0.5 ? 'safe' : marginRatio < 0.8 ? 'warning' : 'danger';
  const riskColor = riskLevel === 'safe' ? 'text-green-600' : 
                   riskLevel === 'warning' ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Position</CardTitle>
          <Badge 
            variant={isLong ? "default" : "secondary"}
            className={cn(
              "flex items-center space-x-1",
              isLong ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            )}
          >
            {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isLong ? 'LONG' : 'SHORT'}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Position Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Size</p>
            <p className="font-mono font-bold">
              {Math.abs(position.size).toFixed(3)} BTC
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Value</p>
            <p className="font-mono font-bold">
              ${positionValue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Price Information */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Entry Price</p>
            <p className="font-mono text-sm">
              ${position.entry_price.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Mark Price</p>
            <p className="font-mono text-sm">
              ${position.mark_price.toFixed(2)}
            </p>
          </div>
        </div>

        {/* PnL Display */}
        <div className="p-3 rounded-lg border-2" style={{
          borderColor: isProfit ? '#10b981' : '#ef4444',
          backgroundColor: isProfit ? '#f0fdf4' : '#fef2f2'
        }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Unrealized PnL</span>
            <div className="flex items-center space-x-1">
              {isProfit ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={cn(
                "font-mono font-bold",
                isProfit ? "text-green-600" : "text-red-600"
              )}>
                {isProfit ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex justify-between mt-1 text-xs">
            <span className="text-gray-600">Percentage</span>
            <span className={cn(
              "font-mono",
              isProfit ? "text-green-600" : "text-red-600"
            )}>
              {isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Risk Management */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Margin Usage</span>
            <span className={cn("text-sm font-mono", riskColor)}>
              {(marginRatio * 100).toFixed(1)}%
            </span>
          </div>
          
          <Progress 
            value={marginRatio * 100} 
            className={cn(
              "h-2",
              riskLevel === 'safe' ? "bg-green-100" :
              riskLevel === 'warning' ? "bg-yellow-100" : "bg-red-100"
            )}
          />
          
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Used: ${position.margin_used.toFixed(2)}</span>
            <span>Available: ${accountBalance.available_balance.toFixed(2)}</span>
          </div>
        </div>

        {/* Liquidation Warning */}
        {riskLevel !== 'safe' && (
          <div className={cn(
            "flex items-center space-x-2 p-2 rounded-lg",
            riskLevel === 'warning' ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
          )}>
            <AlertTriangle className={cn(
              "w-4 h-4",
              riskLevel === 'warning' ? "text-yellow-600" : "text-red-600"
            )} />
            <div className="text-xs">
              <p className={cn(
                "font-medium",
                riskLevel === 'warning' ? "text-yellow-800" : "text-red-800"
              )}>
                {riskLevel === 'warning' ? 'High Margin Usage' : 'Liquidation Risk'}
              </p>
              <p className="text-gray-600">
                Liquidation Price: ${position.liquidation_price.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Position Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="text-xs"
            onClick={() => {
              // Would trigger close position flow
              console.log('Close position');
            }}
          >
            Close Position
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="text-xs"
            onClick={() => {
              // Would trigger add margin flow
              console.log('Add margin');
            }}
          >
            Add Margin
          </Button>
        </div>

        {/* Account Summary */}
        <div className="pt-4 border-t space-y-2">
          <h4 className="text-sm font-medium flex items-center space-x-2">
            <DollarSign className="w-4 h-4" />
            <span>Account Balance</span>
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Total Balance:</span>
              <span className="ml-1 font-mono font-medium">
                ${accountBalance.total_balance.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Available:</span>
              <span className="ml-1 font-mono font-medium text-green-600">
                ${accountBalance.available_balance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
