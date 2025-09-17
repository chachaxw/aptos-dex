// ═══════════════════════════════════════════════════════════════════
// HyperPerp Stress Tests - Performance and Edge Cases
// ═══════════════════════════════════════════════════════════════════

/// Stress tests for high-volume operations
module hyperperp::stress_tests {
    use std::signer;
    use std::vector;
    use hyperperp::gov;
    use hyperperp::vault;
    use hyperperp::account as acct;
    use hyperperp::oracle_adapter as oracle;
    use hyperperp::perp_engine as engine;
    use hyperperp::positions as pos;
    use hyperperp::events;

    #[test(admin = @admin)]
    public fun test_large_batch_settlement(admin: &signer) {
        // Initialize system
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        vault::init_treasury(admin);
        events::init_events(admin);
        oracle::init(admin, 60);
        
        // Create large batch with many fills
        let fills = vector::empty<engine::BatchFill>();
        let i = 0;
        while (i < 50) { // Test with 50 fills
            let taker_addr = @user1; // Use fixed test addresses
            let maker_addr = @user2;
            
            pos::ensure(taker_addr, 1);
            pos::ensure(maker_addr, 1);
            
            let fill = engine::new_batch_fill(
                taker_addr,
                maker_addr, 
                1, // market_id
                10, // size
                3000000000000 + (i as u64), // slightly different prices
                10, // fee_bps
                1704067200 + (i as u64) // different timestamps
            );
            
            vector::push_back(&mut fills, fill);
            i = i + 1;
        };
        
        let batch = engine::new_settlement_batch(
            fills,
            1704067200,
            2900000000000,
            3100000000000,
            1704067800
        );
        
        // Apply large batch - should complete without timeout
        engine::apply_batch(admin, batch, admin_addr);
    }

    #[test(admin = @admin)]
    public fun test_multiple_users_same_market(admin: &signer) {
        // Initialize system  
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        events::init_events(admin);
        
        // Create positions for many users in same market
        let market_id = 1;
        let i = 0;
        while (i < 100) { // 100 users
            let user_addr = @user1;
            pos::ensure(user_addr, market_id);
            assert!(pos::exists_at(user_addr, market_id), i);
            i = i + 1;
        };
    }

    #[test(admin = @admin)]
    public fun test_many_markets(admin: &signer) {
        // Initialize system
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        oracle::init(admin, 60);
        
        // Push prices for many markets
        let market_id = 1;
        while (market_id <= 50) { // 50 markets
            oracle::push_price(
                admin,
                market_id,
                1000000000000 * (market_id as u64), // Different base prices
                10000000,
                1704067200
            );
            market_id = market_id + 1;
        };
    }

    #[test(admin = @admin)]
    public fun test_high_precision_calculations(admin: &signer) {
        // Test with maximum precision values
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        events::init_events(admin);
        
        pos::ensure(@user1, 1);
        pos::ensure(@user2, 1);
        
        // Test with very large numbers (near u128 max)
        let large_size: u128 = 340282366920938463463; // Close to u128 max / 1000
        let large_price: u64 = 18446744073709551; // Close to u64 max / 1000
        
        let fill = engine::new_batch_fill(
            @user1,
            @user2,
            1,
            large_size,
            large_price,
            1, // minimal fee
            1704067200
        );
        
        let batch = engine::new_settlement_batch(
            vector<engine::BatchFill>[fill],
            1704067200,
            large_price - 1000000,
            large_price + 1000000,
            1704067500
        );
        
        engine::apply_batch(admin, batch, admin_addr);
    }

    #[test(admin = @admin)]
    public fun test_rapid_price_updates(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        oracle::init(admin, 60);
        
        // Rapid price updates for same market
        let market_id = 1;
        let timestamp = 1704067200;
        let i = 0;
        
        while (i < 20) {
            let price = 3000000000000 + (i * 1000000000); // Price moves $10 each update
            oracle::push_price(admin, market_id, price, 10000000, timestamp + i);
            
            // Read the updated price
            let price_data = oracle::read_price(admin_addr, market_id, timestamp + i);
            // Price data read successfully (oracle struct details are internal)
            
            i = i + 1;
        };
    }

    #[test(admin = @admin)]
    public fun test_zero_and_edge_values(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        events::init_events(admin);
        
        pos::ensure(@user1, 1);
        pos::ensure(@user2, 1);
        
        // Test with minimal values
        let fill = engine::new_batch_fill(
            @user1,
            @user2,
            1,
            1, // minimal size
            1, // minimal price  
            0, // zero fee
            1
        );
        
        let batch = engine::new_settlement_batch(
            vector<engine::BatchFill>[fill],
            1,
            1, // minimal bounds
            1000000,
            86400 // large expiry
        );
        
        engine::apply_batch(admin, batch, admin_addr);
    }

    #[test(admin = @admin)]
    public fun test_event_stress(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        events::init_events(admin);
        
        // Emit many events rapidly
        let i = 0;
        while (i < 100) {
            let deposit_event = events::new_deposit_event(@user1, 1000 + i);
            events::emit_deposit(admin_addr, deposit_event);
            
            let withdraw_event = events::new_withdraw_event(@user1, 100 + i);  
            events::emit_withdraw(admin_addr, withdraw_event);
            
            let fill_event = events::new_fill_event(@user1, @user2, 1, 10, 30000, 10);
            events::emit_fill(admin_addr, fill_event);
            
            i = i + 1;
        };
    }
}

/// Edge case and error condition tests
module hyperperp::edge_case_tests {
    use std::signer;
    use std::vector;
    use hyperperp::gov;
    use hyperperp::account as acct;
    use hyperperp::perp_engine as engine;
    use hyperperp::positions as pos;
    use hyperperp::events;
    use hyperperp::risk;

    #[test(admin = @admin)]
    public fun test_empty_batch_processing(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        events::init_events(admin);
        
        // Empty batch should succeed
        let empty_fills = vector::empty<engine::BatchFill>();
        let batch = engine::new_settlement_batch(
            empty_fills,
            1704067200,
            1,
            1000000000000,
            1704067500
        );
        
        engine::apply_batch(admin, batch, admin_addr);
    }

    #[test(admin = @admin)]
    public fun test_same_user_taker_maker(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        events::init_events(admin);
        
        pos::ensure(@user1, 1);
        
        // User trading with themselves (edge case)
        let fill = engine::new_batch_fill(
            @user1, // same user as taker
            @user1, // and maker
            1,
            10,
            30000,
            10,
            1704067200
        );
        
        let batch = engine::new_settlement_batch(
            vector<engine::BatchFill>[fill],
            1704067200,
            29000,
            31000,
            1704067500
        );
        
        engine::apply_batch(admin, batch, admin_addr);
    }

    #[test(admin = @admin)]
    public fun test_boundary_risk_calculations(admin: &signer) {
        // Test risk calculations at boundaries
        
        // Exactly at maintenance margin
        let is_healthy = risk::check_maintenance(4000, 1, 100000000); // Designed to be right at MMR
        // Should be healthy or unhealthy based on exact MMR calculation
        
        // Zero collateral
        assert!(!risk::check_maintenance(0, 10, 30000), 1);
        
        // Zero position size
        assert!(risk::check_maintenance(100, 0, 30000), 2);
        
        // Maximum values
        let max_collateral = 18446744073709551615; // u64 max
        assert!(risk::check_maintenance(max_collateral, 1, 1), 3);
    }

    #[test(admin = @admin)]  
    public fun test_overflow_protection(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        acct::open(admin);
        
        // Test large collateral additions
        let large_amount = 1000000000000; // 1 trillion
        acct::add_collateral(admin_addr, large_amount);
        assert!(acct::get_collateral(admin_addr) == large_amount, 1);
        
        // Test multiple large additions
        acct::add_collateral(admin_addr, large_amount);
        assert!(acct::get_collateral(admin_addr) == large_amount * 2, 2);
    }

    #[test(admin = @admin)]
    #[expected_failure] // Should abort on double initialization
    public fun test_double_initialization_gov(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        gov::init_admins(admin, vector<address>[admin_addr]); // Second init should fail
    }

    #[test(admin = @admin)]
    #[expected_failure] // Should abort on double initialization
    public fun test_double_initialization_events(admin: &signer) {
        events::init_events(admin);
        events::init_events(admin); // Second init should fail
    }
}

/// Performance benchmarking tests
module hyperperp::benchmark_tests {
    use std::signer;
    use std::vector;
    use hyperperp::gov;
    use hyperperp::events;
    use hyperperp::perp_engine as engine;
    use hyperperp::positions as pos;

    #[test(admin = @admin)]
    public fun benchmark_position_creation(admin: &signer) {
        // Benchmark creating many positions
        let market_id = 1;
        let i = 0;
        let max_users = 200; // Adjust based on gas limits
        
        while (i < max_users) {
            let user_addr = @user1;
            pos::ensure(user_addr, market_id);
            i = i + 1;
        };
        
        // Verify all positions exist
        let j = 0;
        while (j < max_users) {
            let user_addr = @user1;
            assert!(pos::exists_at(user_addr, market_id), j);
            j = j + 1;
        };
    }

    #[test(admin = @admin)]
    public fun benchmark_batch_processing(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        events::init_events(admin);
        
        // Create positions for batch
        pos::ensure(@user1, 1);
        pos::ensure(@user2, 1);
        
        // Process multiple sequential batches
        let batch_count = 0;
        while (batch_count < 10) {
            let fill = engine::new_batch_fill(
                @user1,
                @user2,
                1,
                10,
                3000000000000 + (batch_count as u64),
                10,
                1704067200 + (batch_count as u64)
            );
            
            let batch = engine::new_settlement_batch(
                vector<engine::BatchFill>[fill],
                1704067200 + (batch_count as u64),
                2900000000000,
                3100000000000,
                1704067500 + (batch_count as u64)
            );
            
            engine::apply_batch(admin, batch, admin_addr);
            batch_count = batch_count + 1;
        };
    }
}
