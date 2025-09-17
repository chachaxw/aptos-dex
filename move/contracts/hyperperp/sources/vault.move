module hyperperp::vault {
    use std::signer;
    use aptos_framework::coin;
    use aptos_framework::coin::Coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use hyperperp::events;
    use hyperperp::errors;
    use hyperperp::gov;
    use hyperperp::constants;
    use hyperperp::account as acct;

    /// Collateral coin type. Using AptosCoin for testing/demo purposes
    /// In production, replace with actual USDC coin type: 0x{USDC_ADDRESS}::coin::USDC
    struct Collateral has key { treasury: Coin<AptosCoin> }

    public fun init_treasury(admin: &signer) {
        if (exists<Collateral>(signer::address_of(admin))) errors::abort_already_initialized();
        let zero = coin::zero<AptosCoin>();
        move_to(admin, Collateral { treasury: zero });
    }

    /// User balance is purely accounted in `account` module; vault only holds pooled coins.
    public fun deposit(user: &signer, amount: u64, events_addr: address) acquires Collateral {
        assert!(!gov::is_paused(events_addr, constants::pause_deposit()), errors::e_paused());
        let c = coin::withdraw<AptosCoin>(user, amount);
        let v = borrow_global_mut<Collateral>(events_addr);
        coin::merge(&mut v.treasury, c);
        acct::add_collateral(signer::address_of(user), amount);
        events::emit_deposit(events_addr, events::new_deposit_event(signer::address_of(user), amount));
    }

    public fun withdraw(admin: &signer, amount: u64, events_addr: address) acquires Collateral {
        assert!(gov::is_admin(admin), errors::e_unauthorized());
        assert!(!gov::is_paused(events_addr, constants::pause_withdraw()), errors::e_paused());

        let addr = signer::address_of(admin);
        acct::sub_collateral(addr, amount);
        let v = borrow_global_mut<Collateral>(events_addr);
        let out = coin::extract(&mut v.treasury, amount);
        coin::deposit(addr, out);
        events::emit_withdraw(events_addr, events::new_withdraw_event(addr, amount));
    }
}