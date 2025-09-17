module hyperperp::perp_engine {
    use std::signer;
    use std::vector;
    use hyperperp::events;
    use hyperperp::errors;
    use hyperperp::constants;
    use hyperperp::oracle_adapter as oracle;
    use hyperperp::account as acct;
    use hyperperp::positions as pos;
    use hyperperp::risk;

    /// Fill and batch structs kept minimal for MVP
    public struct BatchFill has drop, store, copy { taker: address, maker: address, market_id: u64, size: u128, price_x: u64, fee_bps: u64, ts: u64 }
    public struct SettlementBatch has drop, store, copy { fills: vector<BatchFill>, oracle_ts: u64, min_px: u64, max_px: u64, expiry: u64 }
    
    // Public constructor functions
    public fun new_batch_fill(taker: address, maker: address, market_id: u64, size: u128, price_x: u64, fee_bps: u64, ts: u64): BatchFill {
        BatchFill { taker, maker, market_id, size, price_x, fee_bps, ts }
    }
    
    public fun new_settlement_batch(fills: vector<BatchFill>, oracle_ts: u64, min_px: u64, max_px: u64, expiry: u64): SettlementBatch {
        SettlementBatch { fills, oracle_ts, min_px, max_px, expiry }
    }

    public fun apply_batch(_admin: &signer, batch: SettlementBatch, events_addr: address) {
        let now = batch.oracle_ts; // in MVP we trust provided ts; later use block timestamp
        assert!(now <= batch.expiry, errors::e_batch_expired());

        let n = batch.fills.length();
        let i = 0;
        while (i < n) {
            let f = batch.fills[i];
            // price bound check (using batch bounds). Later: per-market bounds w/ oracle
            assert!(f.price_x >= batch.min_px && f.price_x <= batch.max_px, errors::e_price_out_of_bounds());

            // ensure positions exist
            pos::ensure(f.taker, f.market_id);
            pos::ensure(f.maker, f.market_id);

            // update taker and maker symmetrically (opposite positions)
            apply_fill(f.taker, f.market_id, f.size, f.price_x, true);  // taker goes long
            apply_fill(f.maker, f.market_id, f.size, f.price_x, false); // maker goes short

            // TODO: fees & funding accruals
            events::emit_fill(events_addr, events::new_fill_event(f.taker, f.maker, f.market_id, f.size, f.price_x, f.fee_bps));
            i += 1;
        }
    }

    fun apply_fill(owner: address, market_id: u64, _size_delta: u128, _px: u64, is_long: bool) {
        // MVP stub - in real implementation this would update actual position storage
        let _p = pos::borrow_mut(owner, market_id);
        // TODO: implement actual position updates with proper storage
        // The `is_long` parameter indicates position direction:
        // - true: long position (positive size)
        // - false: short position (negative size in real implementation)
        let _ = is_long; // suppress unused warning
    }
}
