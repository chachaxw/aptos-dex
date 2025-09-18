module hyperperp::vault_fa {
    use std::signer;
    use std::table;
    use hyperperp::errors;
    use hyperperp::config;
    use aptos_framework::primary_fungible_store as pfs;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object;

    struct UsdcLedger has key { balances: table::Table<address, u128> }

    public entry fun init_ledger(admin: &signer) {
        if (exists<UsdcLedger>(signer::address_of(admin))) errors::abort_already_initialized();
        move_to(admin, UsdcLedger { balances: table::new<address, u128>() });
    }

    public fun balance_of(admin_addr: address, user: address): u128 acquires UsdcLedger {
        let l = borrow_global<UsdcLedger>(admin_addr);
        if (table::contains<address, u128>(&l.balances, user)) { *table::borrow<address, u128>(&l.balances, user) } else { 0u128 }
    }

    public fun credit(admin: &signer, user: address, delta: u128) acquires UsdcLedger {
        let l = borrow_global_mut<UsdcLedger>(signer::address_of(admin));
        let cur = if (table::contains<address, u128>(&l.balances, user)) { *table::borrow_mut<address, u128>(&mut l.balances, user) } else { 0u128 };
        if (table::contains<address, u128>(&l.balances, user)) { *table::borrow_mut<address, u128>(&mut l.balances, user) = cur + delta } else { table::add<address, u128>(&mut l.balances, user, cur + delta) };
    }

    public fun debit(admin: &signer, user: address, delta: u128) acquires UsdcLedger {
        let l = borrow_global_mut<UsdcLedger>(signer::address_of(admin));
        let cur = if (table::contains<address, u128>(&l.balances, user)) { *table::borrow_mut<address, u128>(&mut l.balances, user) } else { 0u128 };
        assert!(cur >= delta, errors::e_insufficient_margin());
        if (table::contains<address, u128>(&l.balances, user)) { *table::borrow_mut<address, u128>(&mut l.balances, user) = cur - delta } else { table::add<address, u128>(&mut l.balances, user, 0u128) };
    }

    public fun transfer_internal(admin: &signer, from: address, to: address, amount: u128) acquires UsdcLedger {
        debit(admin, from, amount);
        credit(admin, to, amount);
    }

    public entry fun deposit(user: &signer, admin_addr: address, amount: u128) acquires UsdcLedger {
        let meta = config::usdc_meta(admin_addr);
        pfs::transfer(user, meta, admin_addr, (amount as u64));
        let l = borrow_global_mut<UsdcLedger>(admin_addr);
        let u = signer::address_of(user);
        let cur = if (table::contains<address, u128>(&l.balances, u)) { *table::borrow_mut<address, u128>(&mut l.balances, u) } else { 0u128 };
        if (table::contains<address, u128>(&l.balances, u)) { *table::borrow_mut<address, u128>(&mut l.balances, u) = cur + amount } else { table::add<address, u128>(&mut l.balances, u, cur + amount) };
    }

    public entry fun withdraw_for(admin: &signer, to: address, amount: u128) acquires UsdcLedger {
        let meta = config::usdc_meta(signer::address_of(admin));
        debit(admin, to, amount);
        pfs::transfer(admin, meta, to, (amount as u64));
    }
}


