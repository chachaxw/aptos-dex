module hyperperp::constants {
    /// Fixed-point: Q64 (scale = 1e12 here as example; choose one standard!)
    /// For MVP simplicity we use 1e8 (8 decimals) for prices and rates.
    const PX_SCALE: u64 = 1_0000_0000; // 1e8
    const RATE_SCALE: u64 = 1_0000_0000; // 1e8
    const BPS_SCALE: u64 = 10_000; // basis points

    const USDC_DECIMALS: u8 = 6;

    /// Circuit breaker pause bit flags
    const PAUSE_DEPOSIT: u64 = 1;
    const PAUSE_WITHDRAW: u64 = 1 << 1;
    const PAUSE_SETTLEMENT: u64 = 1 << 2;
    const PAUSE_LIQUIDATION: u64 = 1 << 3;

    // Public accessor functions
    public fun px_scale(): u64 { PX_SCALE }
    public fun rate_scale(): u64 { RATE_SCALE }
    public fun bps_scale(): u64 { BPS_SCALE }
    public fun usdc_decimals(): u8 { USDC_DECIMALS }
    public fun pause_deposit(): u64 { PAUSE_DEPOSIT }
    public fun pause_withdraw(): u64 { PAUSE_WITHDRAW }
    public fun pause_settlement(): u64 { PAUSE_SETTLEMENT }
    public fun pause_liquidation(): u64 { PAUSE_LIQUIDATION }
}