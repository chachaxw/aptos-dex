const APTOS_COIN = "0x29b0681a76b20595201859a5d2b269ae9d1fe98251198cefa513c95267003c0c::mint_test_coin::Coin";

export interface AptosBalance {
  apt: number;
  usd: number;
  lastUpdated: Date;
}

export interface AccountResources {
  coin: {
    value: string;
  };
}

/**
 * Fetch APT balance from Aptos blockchain
 */
export async function fetchAptBalance(address: string): Promise<number> {
  try {
    const response = await fetch(
      `https://fullnode.testnet.aptoslabs.com/v1/accounts/${address}/balance/${APTOS_COIN}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.status}`);
    }

    const data = await response.json();
    const octas = parseInt(data);
    return octas / 1e6; // Convert from octas to APT
  } catch (error) {
    console.error('Error fetching APT balance:', error);
    throw error;
  }
}

/**
 * Fetch USD price for APT (mock implementation)
 * In a real app, you would use a price API like CoinGecko or CoinMarketCap
 */
export async function fetchAptUsdPrice(): Promise<number> {
  try {
    // Mock price - in production, use a real price API
    const mockPrice = 8.50; // $8.50 per APT
    return mockPrice;
  } catch (error) {
    console.error('Error fetching APT price:', error);
    return 8.50; // Fallback price
  }
}

/**
 * Get complete balance information
 */
export async function getAccountBalance(address: string): Promise<AptosBalance> {
  const [aptBalance, usdPrice] = await Promise.all([
    fetchAptBalance(address),
    fetchAptUsdPrice()
  ]);

  return {
    apt: aptBalance,
    usd: aptBalance * usdPrice,
    lastUpdated: new Date()
  };
}

/**
 * Format currency values
 */
export function formatCurrency(amount: number, currency: 'USD' | 'APT' | 'USDC' = 'USD'): string {
  if (currency === 'APT') {
    return `${amount.toFixed(4)} APT`;
  }

  if (currency === 'USDC') {
    return `${amount.toFixed(6)} USDC`;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format percentage values
 */
export function formatPercentage(percentage: number): string {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(2)}%`;
}
