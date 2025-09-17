module hyperperp::risk {
    use hyperperp::market_registry as m;
    use hyperperp::constants;

    public fun imr_bps(_market_id: u64): u64 { /* TODO: fetch from registry */ 5_000 } // 50%
    public fun mmr_bps(_market_id: u64): u64 { /* TODO */ 4_000 }

    /// Naive margin check: required = abs(size) * px / leverage
    public fun check_maintenance(collateral: u64, pos_size: u128, px: u64): bool {
        let notional = pos_size; // TODO: implement proper signed integer abs()
        let req = ((notional * (px as u128)) / (constants::bps_scale() as u128));
        (collateral as u128) >= req
    }
}