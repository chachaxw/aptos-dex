module hyperperp::account {
    use std::signer;
    use std::table; 
    use hyperperp::errors;

    public struct Account has key {
        owner: address,
        collateral: u64,
        unsettled_pnl: u128, // TODO: implement proper signed integer handling
        last_funding_ts: u64,
        positions: table::Table<u64, address>, // index to Position key resource address (owner scoped)
    }

    public fun open(user: &signer) {
        let addr = signer::address_of(user);
        if (exists<Account>(addr)) errors::abort_already_initialized();
        move_to(user, Account { owner: addr, collateral: 0, unsettled_pnl: 0, last_funding_ts: 0, positions: table::new<u64, address>() });
    }

    public fun add_collateral(addr: address, amount: u64) acquires Account {
        let a = borrow_global_mut<Account>(addr);
        a.collateral += amount;
    }

    public fun sub_collateral(addr: address, amount: u64) acquires Account {
        let a = borrow_global_mut<Account>(addr);
        assert!(a.collateral >= amount, errors::e_insufficient_collateral());
        a.collateral -= amount;
    }

    // Public getter functions
    public fun get_collateral(addr: address): u64 acquires Account { borrow_global<Account>(addr).collateral }
}