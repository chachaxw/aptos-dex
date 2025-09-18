// ═══════════════════════════════════════════════════════════════════
// HyperPerp Unit Tests - Individual Module Testing
// ═══════════════════════════════════════════════════════════════════

/// Tests for governance module
module hyperperp::gov_tests {
    use std::signer;
    use hyperperp::gov;

    #[test(admin = @admin)]
    public fun test_init_admins(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        
        assert!(gov::is_admin(admin), 1);
        assert!(!gov::is_paused(admin_addr, 1), 2);
    }

    #[test(admin = @admin)]
    public fun test_pause_functionality(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        
        // Test setting pause
        gov::set_pause(admin, 1, true);
        assert!(gov::is_paused(admin_addr, 1), 1);
        
        // Test unsetting pause
        gov::set_pause(admin, 1, false);
        assert!(!gov::is_paused(admin_addr, 1), 2);
    }

    #[test(admin = @admin, user = @user1)]
    #[expected_failure] // Will fail with MISSING_DATA when checking admin status
    public fun test_non_admin_cannot_pause(admin: &signer, user: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        
        // This should fail - user is not admin (will fail on is_admin check)
        gov::set_pause(user, 1, true);
    }
}

/// Tests for account management
module hyperperp::account_tests {
    use std::signer;
    use hyperperp::account as acct;

    #[test(user = @user1)]
    public fun test_open_account(user: &signer) {
        acct::open(user);
        
        let user_addr = signer::address_of(user);
        let balance = acct::get_collateral(user_addr);
        assert!(balance == 0, 1);
    }

    #[test(user = @user1)]
    public fun test_collateral_management(user: &signer) {
        acct::open(user);
        let user_addr = signer::address_of(user);
        
        // Add collateral
        acct::add_collateral(user_addr, 1000);
        assert!(acct::get_collateral(user_addr) == 1000, 1);
        
        // Subtract collateral
        acct::sub_collateral(user_addr, 300);
        assert!(acct::get_collateral(user_addr) == 700, 2);
    }

    #[test(user = @user1)]
    #[expected_failure] // Should abort on insufficient funds
    public fun test_insufficient_collateral(user: &signer) {
        acct::open(user);
        let user_addr = signer::address_of(user);
        
        // Try to subtract more than available
        acct::sub_collateral(user_addr, 100);
    }
}

/// Tests for oracle adapter
module hyperperp::oracle_tests {
    use std::signer;
    use hyperperp::oracle_adapter as oracle;
    use hyperperp::gov;

    #[test(admin = @admin)]
    public fun test_oracle_init(admin: &signer) {
        gov::init_admins(admin, vector<address>[signer::address_of(admin)]);
        oracle::init(admin, 60); // 60 second staleness
        
        // If we get here without aborting, init worked
    }

    #[test(admin = @admin)]
    public fun test_price_operations(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        oracle::init(admin, 60);
        
        // Push price
        oracle::push_price(admin, 1, 3000000000000, 10000000, 1704067200);
        
        // Read price (same timestamp should work)
        let _price = oracle::read_price(admin_addr, 1, 1704067200);
        // Price successfully read (oracle Price struct details are internal)
    }

    #[test(admin = @admin)]
    #[expected_failure] // Should fail due to stale price
    public fun test_stale_price(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        gov::init_admins(admin, vector<address>[admin_addr]);
        oracle::init(admin, 60); // 60 second staleness
        
        oracle::push_price(admin, 1, 3000000000000, 10000000, 1704067200);
        
        // Try to read with timestamp way in the future (stale)
        oracle::read_price(admin_addr, 1, 1704067200 + 120); // 2 minutes later
    }
}

/// Tests for positions module
module hyperperp::position_tests {
    use hyperperp::positions as pos;

    #[test]
    public fun test_position_operations() {
        let owner = @user1;
        let market_id = 1;
        
        // Ensure position
        pos::ensure(owner, market_id);
        
        // Check existence
        assert!(pos::exists_at(owner, market_id), 1);
        
        // Borrow position
        let position = pos::borrow_mut(owner, market_id);
        assert!(pos::get_size(&position) == 0, 2);
    }
}

/// Tests for risk management
module hyperperp::risk_tests {
    use hyperperp::risk;

    #[test]
    public fun test_risk_parameters() {
        let market_id = 1;
        
        let imr = risk::imr_bps(market_id);
        let mmr = risk::mmr_bps(market_id);
        
        assert!(imr > 0, 1);
        assert!(mmr > 0, 2);
        assert!(imr > mmr, 3); // IMR should be higher than MMR
    }

    #[test]  
    public fun test_maintenance_checks() {
        // Test healthy position
        assert!(risk::check_maintenance(1000, 1, 30000), 1);
        
        // Test unhealthy position (high leverage)
        assert!(!risk::check_maintenance(100, 100, 30000), 2);
        
        // Test zero position
        assert!(risk::check_maintenance(1000, 0, 30000), 3);
    }
}

/// Tests for events system
module hyperperp::events_tests {
    use std::signer;
    use hyperperp::events;

    #[test(admin = @admin)]
    public fun test_events_init(admin: &signer) {
        events::init_events(admin);
        // If no abort, initialization worked
    }

    #[test(admin = @admin)]
    public fun test_event_creation(admin: &signer) {
        events::init_events(admin);
        let admin_addr = signer::address_of(admin);
        
        // Test event constructors
        let deposit_event = events::new_deposit_event(@user1, 1000);
        let withdraw_event = events::new_withdraw_event(@user1, 500);
        let fill_event = events::new_fill_event(@user1, @user2, 1, 10, 30000, 10);
        let liq_event = events::new_liquidation_event(@user1, 1, 10, 100);
        
        // Test emission (would emit events in real scenario)
        events::emit_deposit(admin_addr, deposit_event);
        events::emit_withdraw(admin_addr, withdraw_event);
        events::emit_fill(admin_addr, fill_event);
        events::emit_liq(admin_addr, liq_event);
    }
}

/// Tests for constants module  
module hyperperp::constants_tests {
    use hyperperp::constants;

    #[test]
    public fun test_constants_access() {
        // Test all constant accessors
        assert!(constants::px_scale() == 100000000, 1); // 1e8
        assert!(constants::bps_scale() == 10000, 2); // 1e4
        assert!(constants::pause_deposit() > 0, 3);
        assert!(constants::pause_withdraw() > 0, 4);
        // Basic constants verified (trade/liquidate pause flags not implemented yet)
    }
}

/// Tests for error handling
module hyperperp::error_tests {
    use hyperperp::errors;

    #[test]
    public fun test_error_accessors() {
        // Test all error code accessors
        assert!(errors::e_not_initialized() == 1, 1);
        assert!(errors::e_already_initialized() == 2, 2);
        assert!(errors::e_unauthorized() == 3, 3);
        assert!(errors::e_paused() == 4, 4);
        // Error codes verified (insufficient_collateral not yet implemented)
    }

    #[test]
    #[expected_failure(abort_code = 1)]
    public fun test_abort_functions() {
        errors::abort_not_initialized();
    }
}

/// Tests for vault operations (simplified)
module hyperperp::vault_tests {
    use std::signer;
    use hyperperp::vault;
    use hyperperp::gov;

    #[test_only]
    use aptos_framework::aptos_coin::AptosCoin;

    #[test(admin = @admin)]
    public fun test_vault_init(admin: &signer) {
        gov::init_admins(admin, vector<address>[signer::address_of(admin)]);
        vault::init<AptosCoin>(admin, admin, 1000000000000000000);
        // If no abort, initialization worked
    }

    // Note: Full vault testing requires coin setup which is complex in unit tests
    // Integration tests handle this better
}

/// Tests for liquidation logic
module hyperperp::liquidation_tests {
    use std::signer;
    use hyperperp::liquidation as liq;
    use hyperperp::positions as pos;
    use hyperperp::account as acct;
    use hyperperp::events;

    #[test(admin = @admin, user = @user1)]
    public fun test_liquidation_flow(admin: &signer, user: &signer) {
        let user_addr = signer::address_of(user);
        let admin_addr = signer::address_of(admin);
        
        // Setup
        events::init_events(admin);
        acct::open(user);
        pos::ensure(user_addr, 1);
        
        // Test liquidation (MVP version just emits event)
        liq::liquidate(admin, user_addr, 1, 32000, admin_addr);
        
        // In MVP, liquidation just checks and emits event
        // Real implementation would modify positions
    }
}

/// Tests for perp engine (batch processing)
module hyperperp::engine_tests {
    use std::signer;
    use hyperperp::perp_engine as engine;
    use hyperperp::events;
    use hyperperp::positions as pos;

    #[test(admin = @admin)]  
    public fun test_batch_construction(admin: &signer) {
        events::init_events(admin);
        let admin_addr = signer::address_of(admin);
        
        // Test batch fill construction
        let fill = engine::new_batch_fill(@user1, @user2, 1, 10, 30000, 10, 1704067200);
        
        // Test settlement batch construction
        let batch = engine::new_settlement_batch(
            vector<engine::BatchFill>[fill], 
            1704067200, 
            29000, 
            31000, 
            1704067500
        );
        
        // Ensure positions exist
        pos::ensure(@user1, 1);
        pos::ensure(@user2, 1);
        
        // Apply batch
        engine::apply_batch(admin, batch, admin_addr);
    }

    #[test(admin = @admin)]
    #[expected_failure] // Should fail on expired batch
    public fun test_expired_batch(admin: &signer) {
        events::init_events(admin);
        let admin_addr = signer::address_of(admin);
        
        let fill = engine::new_batch_fill(@user1, @user2, 1, 10, 30000, 10, 1704067200);
        let batch = engine::new_settlement_batch(
            vector<engine::BatchFill>[fill],
            1704067500, // future oracle timestamp
            29000,
            31000, 
            1704067200 // past expiry
        );
        
        pos::ensure(@user1, 1);
        pos::ensure(@user2, 1);
        
        engine::apply_batch(admin, batch, admin_addr);
    }

    #[test(admin = @admin)]
    #[expected_failure] // Should fail on price out of bounds
    public fun test_price_bounds(admin: &signer) {
        events::init_events(admin);
        let admin_addr = signer::address_of(admin);
        
        let fill = engine::new_batch_fill(@user1, @user2, 1, 10, 35000, 10, 1704067200); // Price too high
        let batch = engine::new_settlement_batch(
            vector<engine::BatchFill>[fill],
            1704067200,
            29000,  // min
            31000,  // max - fill price 35000 is outside bounds
            1704067500
        );
        
        pos::ensure(@user1, 1);
        pos::ensure(@user2, 1);
        
        engine::apply_batch(admin, batch, admin_addr);
    }
}
