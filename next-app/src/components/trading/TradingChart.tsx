'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  LineChart,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TradingChartProps {
  marketId: number;
  className?: string;
}

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TIMEFRAMES = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1D' },
];

export function TradingChart({ marketId, className }: TradingChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mock chart data (would come from API in production)
  const generateMockData = useCallback((): CandleData[] => {
    const data: CandleData[] = [];
    let basePrice = marketId === 1 ? 117000 : marketId === 2 ? 4600 : 245;
    const now = Date.now();
    const interval = selectedTimeframe === '1m' ? 60000 : 
                    selectedTimeframe === '5m' ? 300000 :
                    selectedTimeframe === '15m' ? 900000 :
                    selectedTimeframe === '1h' ? 3600000 :
                    selectedTimeframe === '4h' ? 14400000 : 86400000;

    for (let i = 100; i >= 0; i--) {
      const timestamp = now - (i * interval);
      const volatility = basePrice * 0.02; // 2% volatility
      const change = (Math.random() - 0.5) * volatility;
      
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + (Math.random() * volatility * 0.5);
      const low = Math.min(open, close) - (Math.random() * volatility * 0.5);
      const volume = Math.random() * 1000000;

      data.push({ timestamp, open, high, low, close, volume });
      basePrice = close;
    }

    return data;
  }, [selectedTimeframe, marketId]);

  const [chartData, setChartData] = useState<CandleData[]>(() => generateMockData());

  useEffect(() => {
    setChartData(generateMockData());
  }, [selectedTimeframe, marketId, generateMockData]);

  const currentPrice = chartData[chartData.length - 1]?.close || 0;
  const previousPrice = chartData[chartData.length - 2]?.close || 0;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = (priceChange / previousPrice) * 100;
  const isPositive = priceChange >= 0;

  const renderCandlestickChart = () => {
    const maxPrice = Math.max(...chartData.map(d => d.high));
    const minPrice = Math.min(...chartData.map(d => d.low));
    const priceRange = maxPrice - minPrice;

    return (
      <div className="relative w-full h-64 bg-gray-50 rounded-lg overflow-hidden">
        <svg width="100%" height="100%" className="absolute inset-0">
          {chartData.map((candle, index) => {
            const x = (index / chartData.length) * 100;
            const isGreen = candle.close >= candle.open;
            
            const openY = ((maxPrice - candle.open) / priceRange) * 100;
            const closeY = ((maxPrice - candle.close) / priceRange) * 100;
            const highY = ((maxPrice - candle.high) / priceRange) * 100;
            const lowY = ((maxPrice - candle.low) / priceRange) * 100;

            return (
              <g key={index}>
                {/* Wick */}
                <line
                  x1={`${x}%`}
                  y1={`${highY}%`}
                  x2={`${x}%`}
                  y2={`${lowY}%`}
                  stroke={isGreen ? "#10b981" : "#ef4444"}
                  strokeWidth="1"
                />
                {/* Body */}
                <rect
                  x={`${x - 0.3}%`}
                  y={`${Math.min(openY, closeY)}%`}
                  width="0.6%"
                  height={`${Math.abs(closeY - openY)}%`}
                  fill={isGreen ? "#10b981" : "#ef4444"}
                />
              </g>
            );
          })}
        </svg>

        {/* Price Labels */}
        <div className="absolute right-2 top-2 bg-white/90 rounded px-2 py-1 text-xs">
          <div className="font-mono font-bold">${currentPrice.toFixed(2)}</div>
          <div className={cn("flex items-center space-x-1", isPositive ? "text-green-600" : "text-red-600")}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)</span>
          </div>
        </div>
      </div>
    );
  };

  const renderLineChart = () => {
    const maxPrice = Math.max(...chartData.map(d => d.close));
    const minPrice = Math.min(...chartData.map(d => d.close));
    const priceRange = maxPrice - minPrice;

    const pathData = chartData.map((candle, index) => {
      const x = (index / (chartData.length - 1)) * 100;
      const y = ((maxPrice - candle.close) / priceRange) * 100;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
      <div className="relative w-full h-64 bg-gray-50 rounded-lg overflow-hidden">
        <svg width="100%" height="100%" className="absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d={pathData}
            fill="none"
            stroke={isPositive ? "#10b981" : "#ef4444"}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`${pathData} L 100 100 L 0 100 Z`}
            fill={`url(#gradient-${isPositive ? 'green' : 'red'})`}
            opacity="0.1"
          />
          
          <defs>
            <linearGradient id="gradient-green" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-red" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Price Label */}
        <div className="absolute right-2 top-2 bg-white/90 rounded px-2 py-1 text-xs">
          <div className="font-mono font-bold">${currentPrice.toFixed(2)}</div>
          <div className={cn("flex items-center space-x-1", isPositive ? "text-green-600" : "text-red-600")}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={cn(className, isFullscreen && "fixed inset-4 z-50")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Price Chart</CardTitle>
          <div className="flex items-center space-x-2">
            {/* Chart Type Toggle */}
            <div className="flex items-center border rounded-lg">
              <Button
                variant={chartType === 'candlestick' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('candlestick')}
                className="h-8 px-3"
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === 'line' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('line')}
                className="h-8 px-3"
              >
                <LineChart className="w-4 h-4" />
              </Button>
            </div>

            {/* Fullscreen Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 px-3"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center space-x-1">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf.value}
              variant={selectedTimeframe === tf.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeframe(tf.value)}
              className="h-7 px-3 text-xs"
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Price Summary */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold font-mono">
                ${currentPrice.toFixed(2)}
              </div>
              <div className={cn(
                "flex items-center space-x-1 text-sm",
                isPositive ? "text-green-600" : "text-red-600"
              )}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{isPositive ? '+' : ''}{priceChange.toFixed(2)}</span>
                <span>({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)</span>
              </div>
            </div>
            
            <div className="text-right text-sm text-gray-600">
              <div>H: ${Math.max(...chartData.map(d => d.high)).toFixed(2)}</div>
              <div>L: ${Math.min(...chartData.map(d => d.low)).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartType === 'candlestick' ? renderCandlestickChart() : renderLineChart()}

        {/* Volume Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Volume</span>
            <span className="font-mono">
              {(chartData[chartData.length - 1]?.volume / 1000 || 0).toFixed(0)}K
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full"
              style={{ 
                width: `${Math.min((chartData[chartData.length - 1]?.volume || 0) / 2000000 * 100, 100)}%` 
              }}
            />
          </div>
        </div>

        {/* Chart Info */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
          <Badge variant="outline" className="text-xs">
            Real-time
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
