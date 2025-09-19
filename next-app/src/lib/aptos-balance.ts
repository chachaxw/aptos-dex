export interface AptosBalance {
  apt: number;
  usd: number;
  lastUpdated: Date;
}

/**
 * Fetch APT balance from Aptos blockchain
 */
export async function fetchAptBalance(address: string): Promise<number> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APTOS_NODE_URL}/accounts/${address}/resources`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.status}`);
    }

    const data = await response.json();
    const coinStore = data?.find((r: any) => r.type.includes(`${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}::account::Account`));
    
    console.log('Data:', data);
    console.log('Coin store:', coinStore);

    if (coinStore) {
      const balance = parseInt(coinStore.data.collateral);
      const balanceInCoins = balance / 1_000_000; // 6 decimals
      console.log('✅ Admin balance:', balanceInCoins, 'USDC');
      return balanceInCoins // Convert from octas to USDC
    } else {
      console.log('❌ Coin store not found for user');
    }

    return 0;
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
export function formatCurrency(amount: number, currency: 'USDC' | 'APT' = 'USDC'): string {
  if (currency === 'APT') {
    return `${amount.toFixed(4)} APT`;
  }

  if (currency === 'USDC') {
    return `${amount.toFixed(2)} USDC`;
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
