module hyperperp::market_registry {
    use std::table;
    use std::option;
    use std::signer;
    use std::string;
    use hyperperp::errors; use hyperperp::gov;

    struct Market has store, drop, copy {
        symbol: vector<u8>,
        imr_bps: u64,
        mmr_bps: u64,
        lot_size: u64,
        tick_size: u64,
        max_leverage_x: u64,
    }

    struct Markets has key { by_id: table::Table<u64, Market>, next_id: u64 }

    public fun init(admin: &signer) {
        if (exists<Markets>(signer::address_of(admin))) errors::abort_already_initialized();
        move_to(admin, Markets { by_id: table::new<u64, Market>(), next_id: 1 });
    }

    public fun add_market(admin: &signer, symbol: vector<u8>, imr_bps: u64, mmr_bps: u64, lot: u64, tick: u64, max_leverage_x: u64): u64 acquires Markets {
        assert!(gov::is_admin(admin), errors::e_unauthorized());
        let m = Market { symbol, imr_bps, mmr_bps, lot_size: lot, tick_size: tick, max_leverage_x };
        let reg = borrow_global_mut<Markets>(signer::address_of(admin));
        let id = reg.next_id; reg.next_id = id + 1; table::add(&mut reg.by_id, id, m); id
    }

    public fun get(admin_addr: address, id: u64): Market acquires Markets { *table::borrow(&borrow_global<Markets>(admin_addr).by_id, id) }
}