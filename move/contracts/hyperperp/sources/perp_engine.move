module hyperperp::perp_engine {
    use std::vector;
    use hyperperp::events;
    use hyperperp::errors;
    use hyperperp::constants;
    use hyperperp::account as acct;
    use hyperperp::positions as pos;
    use hyperperp::risk;
    use hyperperp::vault_coin as vfa;

    /// Fill and batch structs for perpetual trading
    public struct BatchFill has drop, store, copy { 
        taker: address, 
        maker: address, 
        market_id: u64, 
        size: u128, 
        price_x: u64, 
        fee_bps: u64, 
        ts: u64 
    }
    
    public struct SettlementBatch has drop, store, copy { 
        fills: vector<BatchFill>, 
        oracle_ts: u64, 
        min_px: u64, 
        max_px: u64, 
        expiry: u64 
    }

    /// Funding rate information
    public struct FundingRate has drop, store, copy {
        market_id: u64,
        rate: u64, // in basis points
        timestamp: u64,
        next_funding_time: u64,
    }

    /// Fee calculation result
    public struct FeeCalculation has drop, store, copy {
        taker_fee: u64,
        maker_fee: u64,
        protocol_fee: u64,
        total_fee: u64,
    }

    // Public constructor functions
    public fun new_batch_fill(taker: address, maker: address, market_id: u64, size: u128, price_x: u64, fee_bps: u64, ts: u64): BatchFill {
        BatchFill { taker, maker, market_id, size, price_x, fee_bps, ts }
    }
    
    public fun new_settlement_batch(fills: vector<BatchFill>, oracle_ts: u64, min_px: u64, max_px: u64, expiry: u64): SettlementBatch {
        SettlementBatch { fills, oracle_ts, min_px, max_px, expiry }
    }

    public fun new_funding_rate(market_id: u64, rate: u64, timestamp: u64, next_funding_time: u64): FundingRate {
        FundingRate { market_id, rate, timestamp, next_funding_time }
    }

    /// Apply a batch of fills to update positions and collect fees
    public fun apply_batch(admin: &signer, batch: SettlementBatch, events_addr: address) {
        let now = batch.oracle_ts; // in MVP we trust provided ts; later use block timestamp
        assert!(now <= batch.expiry, errors::e_batch_expired());

        let n = batch.fills.length();
        let i = 0;

        while (i < n) {
            let f = batch.fills[i];

            // Price bound check
            assert!(f.price_x >= batch.min_px && f.price_x <= batch.max_px, errors::e_price_out_of_bounds());

            // Ensure positions exist
            pos::ensure(f.taker, f.market_id);
            pos::ensure(f.maker, f.market_id);

            // Calculate fees
            let fee_calc = calculate_fees(f.size, f.price_x, f.fee_bps);

            // Update positions
            apply_fill(f.taker, f.market_id, f.size, f.price_x, true, events_addr);  // taker goes long
            apply_fill(f.maker, f.market_id, f.size, f.price_x, false, events_addr); // maker goes short

            // Quote settlement within pooled FA ledger (USDC)
            let quote_delta: u128 = (f.size * (f.price_x as u128)) / (constants::px_scale() as u128);
            vfa::transfer_internal(admin, f.taker, f.maker, quote_delta);

            // Collect fees to vault (placeholder)
            collect_fees(admin, f.taker, f.maker, fee_calc, events_addr);

            // Emit fill event
            events::emit_fill(events_addr, events::new_fill_event(f.taker, f.maker, f.market_id, f.size, f.price_x, f.fee_bps));
            
            i += 1;
        }
    }

    public entry fun apply_batch_simple(
        admin: &signer,
        taker: address,
        maker: address,
        market_id: u64,
        size: u128,
        price_x: u64,
        fee_bps: u64,
        ts: u64,
        oracle_ts: u64,
        min_px: u64,
        max_px: u64,
        expiry: u64,
        events_addr: address
    ) {
        let fill = new_batch_fill(taker, maker, market_id, size, price_x, fee_bps, ts);
        let fills = vector::empty<BatchFill>();
        vector::push_back(&mut fills, fill);
        let batch = new_settlement_batch(fills, oracle_ts, min_px, max_px, expiry);
        apply_batch(admin, batch, events_addr);
    }

    /// Apply a single fill to update a position
    fun apply_fill(owner: address, market_id: u64, size_delta: u128, px: u64, is_long: bool, events_addr: address) {
        // Get current position
        let position = pos::get_position(owner, market_id);
        
        // Calculate notional value
        let notional = (size_delta * (px as u128)) / (constants::px_scale() as u128);
        
        // Update position size
        if (is_long) {
            pos::add_size(&mut position, size_delta, true);
        } else {
            pos::add_size(&mut position, size_delta, false);
        };
        
        // Update entry notional
        let current_entry = pos::get_entry_notional(&position);
        pos::update_entry_notional(&mut position, current_entry + notional);
        
        // Put position back
        pos::put_position(owner, market_id, position);
        
        // Emit position update event
        events::emit_position_update(events_addr, events::new_position_update_event(owner, market_id, size_delta, is_long, px));
    }

    /// Calculate fees for a fill
    fun calculate_fees(size: u128, price_x: u64, fee_bps: u64): FeeCalculation {
        let notional = (size * (price_x as u128)) / (constants::px_scale() as u128);
        let fee_rate = (fee_bps as u128) * 10000 / (constants::bps_scale() as u128); // Convert bps to rate
        
        let taker_fee = (notional * fee_rate) / 1000000; // Apply fee rate
        let maker_fee = taker_fee / 2; // Maker gets half the fee as rebate
        let protocol_fee = taker_fee - maker_fee; // Protocol keeps the difference
        let total_fee = taker_fee;
        
        FeeCalculation {
            taker_fee: (taker_fee as u64),
            maker_fee: (maker_fee as u64),
            protocol_fee: (protocol_fee as u64),
            total_fee: (total_fee as u64),
        }
    }

    /// Collect fees and transfer to vault
    fun collect_fees(admin: &signer, taker: address, maker: address, fees: FeeCalculation, events_addr: address) {
        // In a real implementation, this would:
        // 1. Deduct fees from user accounts
        // 2. Transfer fees to protocol vault
        // 3. Handle maker rebates
        
        // For MVP, we'll just emit events
        // TODO: Implement actual fee collection with proper account management
        let _ = admin;
        let _ = taker;
        let _ = maker;
        let _ = fees;
        let _ = events_addr;
    }

    /// Calculate funding rate for a market
    public fun calculate_funding_rate(market_id: u64, current_price: u64, index_price: u64): u64 {
        // Simple funding rate calculation based on price difference
        // In production, this would use more sophisticated formulas
        
        if (current_price > index_price) {
            // Longs pay shorts when perpetual trades above index
            let premium = current_price - index_price;
            (premium * 10000) / index_price // Return in basis points
        } else {
            // Shorts pay longs when perpetual trades below index
            let discount = index_price - current_price;
            (discount * 10000) / index_price // Return in basis points
        }
    }

    /// Apply funding to all positions in a market
    public fun apply_funding(admin: &signer, market_id: u64, funding_rate: u64, events_addr: address) {
        // In a real implementation, this would:
        // 1. Iterate through all positions in the market
        // 2. Calculate funding payment based on position size and funding rate
        // 3. Update position funding accumulator
        // 4. Transfer funding payments between users
        
        // For MVP, we'll just emit a funding event
        events::emit_funding(events_addr, events::new_funding_event(market_id, funding_rate));
        
        let _ = admin;
    }

    /// Close a position completely
    public fun close_position(owner: address, market_id: u64, close_price: u64, events_addr: address) {
        let position = pos::get_position(owner, market_id);
        let size = pos::get_size(&position);
        
        if (size == 0) {
            // Position already closed
            return
        };
        
        // Calculate PnL (simplified)
        let entry_notional = pos::get_entry_notional(&position);
        let close_notional = (size * (close_price as u128)) / (constants::px_scale() as u128);
        
        let pnl = if (pos::is_long(&position)) {
            close_notional - entry_notional
        } else {
            entry_notional - close_notional
        };
        
        let is_profit = pnl > 0;
        
        // Close the position
        pos::close_position(&mut position);
        pos::put_position(owner, market_id, position);
        
        // Emit position close event
        events::emit_position_close(events_addr, events::new_position_close_event(
            owner, market_id, size, close_price, pnl, is_profit
        ));
    }

    /// Get position size for a user and market
    public fun get_position_size(owner: address, market_id: u64): u128 {
        pos::get_position_size(owner, market_id)
    }

    /// Check if a position exists
    public fun position_exists(owner: address, market_id: u64): bool {
        pos::exists_at(owner, market_id)
    }

    /// Get position information
    public fun get_position_info(owner: address, market_id: u64): (u128, u128, u128) {
        let position = pos::get_position(owner, market_id);
        let size = pos::get_size(&position);
        let entry_notional = pos::get_entry_notional(&position);
        let funding_acc = pos::get_funding_acc(&position);
        pos::put_position(owner, market_id, position);
        (size, entry_notional, funding_acc)
    }

    /// Risk check before allowing a trade
    public fun check_trade_risk(owner: address, market_id: u64, size: u128, price: u64): bool {
        // Get current position
        let position = pos::get_position(owner, market_id);
        let current_size = pos::get_size(&position);
        let is_current_long = pos::get_is_long(&position);
        pos::put_position(owner, market_id, position);
        
        // Calculate new position size based on trade direction
        // For simplicity, assume the new trade is long
        // In production, this would be determined by the order side
        let new_size = if (is_current_long) {
            current_size + size
        } else {
            // Handle short position logic
            if (current_size >= size) {
                current_size - size
            } else {
                size - current_size
            }
        };
        
        // Get user collateral
        let collateral = acct::get_collateral(owner);
        
        // Check maintenance margin requirement
        risk::check_maintenance(collateral, new_size, price)
    }
}
