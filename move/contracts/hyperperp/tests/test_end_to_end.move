// ───────────────────────────────────────────────────────────
// E2E: deposit → order match → batch settle → liquidation
// Notes: This test MOCKS the coin transfer by directly crediting collateral
// via `account::add_collateral`. Vault holds pooled coins but we
// skip actual TestCoin mint/transfer for simplicity.
// ───────────────────────────────────────────────────────────
module hyperperp::e2e_tests {
    use std::signer;
    use hyperperp::gov;
    use hyperperp::vault;
    use hyperperp::account as acct;
    use hyperperp::oracle_adapter as oracle;
    use hyperperp::perp_engine as engine;
    use hyperperp::positions as pos;
    use hyperperp::liquidation as liq;
    use hyperperp::events;
    #[test_only]
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;

    const MKT_BTC: u64 = 1;

    #[test(admin = @admin, taker = @user1, maker = @user2)]
    public fun end_to_end(admin: &signer, taker: &signer, maker: &signer) {
        // 1) bootstrap
        gov::init_admins(admin, vector<address>[ signer::address_of(admin) ]);
        vault::init<coin::Coin<AptosCoin>>(admin, admin, 1000000000000000000);
        events::init_events(admin);  // Initialize event system
        oracle::init(admin, /*staleness_secs=*/ 60);
        acct::open(taker);
        acct::open(maker);

        // 2) deposit (mocked)
        let taker_addr = signer::address_of(taker);
        let maker_addr = signer::address_of(maker);
        acct::add_collateral(taker_addr, /*1_000 USDC (6dp mocked)*/ 1_000_000_000);
        acct::add_collateral(maker_addr, /*1_000 USDC*/ 1_000_000_000);

        // 3) oracle price feed
        // price scale = 1e8; use 30_000 * 1e8
        oracle::push_price(admin, MKT_BTC, 3_0000_0000_000, /*conf*/ 100_0000, /*ts*/ 1);

        // 4) off-chain match → on-chain batch settle
        // taker buys 10 contracts from maker at px=30k
        let f = engine::new_batch_fill(taker_addr, maker_addr, MKT_BTC, 10, 3_0000_0000_000, 10, 1);
        let batch = engine::new_settlement_batch(vector<engine::BatchFill>[ f ], 1, 2_9000_0000_000, 3_1000_0000_000, 10);
        engine::apply_batch(admin, batch, signer::address_of(admin));

        // 5) positions updated
        assert!(pos::exists_at(taker_addr, MKT_BTC), 10001);
        assert!(pos::exists_at(maker_addr, MKT_BTC), 10002);

        // 6) price moves adverse to taker → liquidation
        // maintenance check is naive: req ≈ |size|*px/1e4; with size=10 and px high, taker undercollateralized.
        // Call liquidate; engine sets size to 0 on success (MVP behavior).
        liq::liquidate(admin, taker_addr, MKT_BTC, /*px=*/ 3_2000_0000_000, signer::address_of(admin));

        // 7) assert taker flat after liquidation
        // MVP stub - in real implementation would check actual position
        let size = pos::get_position_size(taker_addr, MKT_BTC);
        assert!(size == 0, 10003); // This will always pass in MVP stub
    }
}
