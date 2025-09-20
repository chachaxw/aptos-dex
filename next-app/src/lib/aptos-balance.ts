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
      `${process.env.NEXT_PUBLIC_APTOS_NODE_URL}/accounts/${address}/balance/0x29b0681a76b20595201859a5d2b269ae9d1fe98251198cefa513c95267003c0c::mint_test_coin::Coin`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.status}`);
    }

    const data = await response.json();

    console.log('Data:', data);

    if (data) {
      const balanceInCoins = data / 1_000_000; // 6 decimals
      console.log('✅ Balance:', balanceInCoins, 'USDC');
      return balanceInCoins // Convert from octas to USDC
    } else {
      console.log('❌ Balance not found for user');
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
