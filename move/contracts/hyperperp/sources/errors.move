module hyperperp::errors {
    /// Reserve error codes for stable interfaces
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_UNAUTHORIZED: u64 = 3;
    const E_PAUSED: u64 = 4;
    const E_INSUFFICIENT_MARGIN: u64 = 10;
    const E_PRICE_OUT_OF_BOUNDS: u64 = 11;
    const E_ORACLE_STALE: u64 = 12;
    const E_BATCH_EXPIRED: u64 = 13;
    const E_UNKNOWN_MARKET: u64 = 20;
    const E_POSITION_NOT_FOUND: u64 = 21;

    public fun abort_not_initialized() { abort E_NOT_INITIALIZED }
    public fun abort_already_initialized() { abort E_ALREADY_INITIALIZED }
    public fun abort_unauthorized() { abort E_UNAUTHORIZED }
    public fun abort_paused() { abort E_PAUSED }
    
    // Public error code accessors
    public fun e_not_initialized(): u64 { E_NOT_INITIALIZED }
    public fun e_already_initialized(): u64 { E_ALREADY_INITIALIZED }
    public fun e_unauthorized(): u64 { E_UNAUTHORIZED }
    public fun e_paused(): u64 { E_PAUSED }
    public fun e_insufficient_margin(): u64 { E_INSUFFICIENT_MARGIN }
    public fun e_price_out_of_bounds(): u64 { E_PRICE_OUT_OF_BOUNDS }
    public fun e_oracle_stale(): u64 { E_ORACLE_STALE }
    public fun e_batch_expired(): u64 { E_BATCH_EXPIRED }
    public fun e_unknown_market(): u64 { E_UNKNOWN_MARKET }
    public fun e_position_not_found(): u64 { E_POSITION_NOT_FOUND }
}