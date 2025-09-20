/**
 * HyperPerp Matching Engine Client
 * Handles communication with the Rust matching engine API
 */

export interface Order {
  id: string;
  user_address: string;
  market_id: number;
  side: 'Buy' | 'Sell';
  order_type: 'Market' | 'Limit';
  size: string;
  price?: string;
  filled_size: string;
  status: 'Pending' | 'PartiallyFilled' | 'Filled' | 'Cancelled' | 'Expired';
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface Trade {
  id: string;
  market_id: number;
  taker_order_id: string;
  maker_order_id: string;
  taker_address: string;
  maker_address: string;
  size: string;
  price: string;
  side: 'Buy' | 'Sell';
  created_at: string;
}

export interface OrderResponse {
  order: Order;
  trades: Trade[];
}

export interface OrderBookLevel {
  price: string;
  size: string;
  order_count: number;
}

export interface OrderBook {
  market_id: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  last_updated: string;
}

export interface SubmitOrderRequest {
  user_address: string;
  market_id: number;
  side: 'Buy' | 'Sell';
  order_type: 'Market' | 'Limit';
  size: string;
  price?: string;
  expires_at?: string;
}

export interface DepositRequest {
  user_address: string;
  amount: number;
}

export interface DepositResponse {
  transaction_hash: string;
  amount: number;
  user_address: string;
}

export interface MarketData {
  market_id: number;
  last_price?: string;
  volume_24h: string;
  price_change_24h?: string;
  high_24h?: string;
  low_24h?: string;
}

export class MatchingEngineClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async submitOrder(order: SubmitOrderRequest): Promise<OrderResponse> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(order)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to submit order: ${response.status} ${error}`);
    }

    return response.json();
  }

  async depositFunds(deposit: DepositRequest): Promise<DepositResponse> {
    const response = await fetch(`${this.baseUrl}/deposit`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(deposit)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to deposit funds: ${response.status} ${error}`);
    }

    return response.json();
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      method: 'POST'
    });
    
    return response.ok;
  }

  async getOrderBook(marketId: number): Promise<OrderBook> {
    const response = await fetch(`${this.baseUrl}/orderbook/${marketId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get order book: ${response.status}`);
    }

    return response.json();
  }

  async getUserOrders(userAddress: string): Promise<{orders: Order[]}> {
    const response = await fetch(`${this.baseUrl}/orders/user/${userAddress}`);

    if (!response.ok) {
      return {orders: []}; // Return empty array if endpoint doesn't exist yet
    }

    return response.json();
  }

  async getRecentTrades(marketId: number, limit: number = 50): Promise<{ total: number, trades: Trade[] }> {
    const response = await fetch(`${this.baseUrl}/trades/${marketId}?limit=${limit}`);
    
    if (!response.ok) {
      return { total: 0, trades: [] }; // Return empty array if endpoint doesn't exist yet
    }

    return response.json();
  }

  async getMarketData(marketId: number): Promise<MarketData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/market/${marketId}`);
      
      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch {
      return null;
    }
  }

  // WebSocket connection for real-time updates
  connectWebSocket(
    onOrderBookUpdate?: (orderBook: OrderBook) => void,
    onTradeUpdate?: (trade: Trade) => void,
    onOrderUpdate?: (order: Order) => void
  ): WebSocket | null {
    try {
      const ws = new WebSocket(this.baseUrl.replace('http', 'ws') + '/ws');
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'orderbook_update':
            onOrderBookUpdate?.(data.data);
            break;
          case 'trade':
            onTradeUpdate?.(data.data);
            break;
          case 'order_update':
            onOrderUpdate?.(data.data);
            break;
        }
      };

      return ws;
    } catch {
      console.warn('WebSocket connection failed - falling back to polling');
      return null;
    }
  }
}
