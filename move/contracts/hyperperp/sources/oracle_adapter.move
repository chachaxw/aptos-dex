module hyperperp::oracle_adapter {
    use std::signer; use std::table; use hyperperp::errors;

    struct Price has store, drop, copy { px: u64, conf: u64, ts: u64 }
    struct Cache has key { by_market: table::Table<u64, Price>, staleness_secs: u64 }

    public fun init(admin: &signer, staleness_secs: u64) { move_to(admin, Cache { by_market: table::new<u64, Price>(), staleness_secs }) }

    /// MVP: admin feeds price; later: verify Pyth/Switchboard proofs
    public fun push_price(admin: &signer, market_id: u64, px: u64, conf: u64, ts: u64) acquires Cache {
        let c = borrow_global_mut<Cache>(signer::address_of(admin));
        table::upsert(&mut c.by_market, market_id, Price { px, conf, ts });
    }

    public fun read_price(cfg_addr: address, market_id: u64, now_ts: u64): Price acquires Cache {
        let c = borrow_global<Cache>(cfg_addr);
        let p = *table::borrow(&c.by_market, market_id);
        assert!(now_ts - p.ts <= c.staleness_secs, errors::e_oracle_stale());
        p
    }
}
