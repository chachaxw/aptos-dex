module hyperperp::vault_coin {
    use std::signer;
    use std::table;
    use hyperperp::errors;
    use hyperperp::account;
    use hyperperp::events;
    use aptos_framework::coin;
    
    struct UsdcLedger has key { 
        balances: table::Table<address, u128> 
    }

    public entry fun init_ledger(admin: &signer) {
        if (exists<UsdcLedger>(signer::address_of(admin))) errors::abort_already_initialized();
        move_to(admin, UsdcLedger { balances: table::new<address, u128>() });
    }

    public fun balance_of(admin_addr: address, user: address): u128 acquires UsdcLedger {
        let l = borrow_global<UsdcLedger>(admin_addr);
        if (l.balances.contains::<address, u128>(user)) { 
            *l.balances.borrow::<address, u128>(user) 
        } else { 
            0u128 
        }
    }

    public fun credit(admin: &signer, user: address, delta: u128) acquires UsdcLedger {
        let l = borrow_global_mut<UsdcLedger>(signer::address_of(admin));
        let cur = if (l.balances.contains::<address, u128>(user)) { 
            *l.balances.borrow_mut::<address, u128>(user) 
        } else { 
            0u128 
        };
        if (l.balances.contains::<address, u128>(user)) { 
            *l.balances.borrow_mut::<address, u128>(user) = cur + delta 
        } else { 
            l.balances.add::<address, u128>(user, cur + delta) 
        };
    }

    public fun debit(admin: &signer, user: address, delta: u128) acquires UsdcLedger {
        let l = borrow_global_mut<UsdcLedger>(signer::address_of(admin));
        let cur = if (l.balances.contains::<address, u128>(user)) { 
            *l.balances.borrow_mut::<address, u128>(user) 
        } else { 
            0u128 
        };
        assert!(cur >= delta, errors::e_insufficient_margin());
        if (l.balances.contains::<address, u128>(user)) { 
            *l.balances.borrow_mut::<address, u128>(user) = cur - delta 
        } else { 
            l.balances.add::<address, u128>(user, 0u128) 
        };
    }

    public fun transfer_internal(admin: &signer, from: address, to: address, amount: u128) acquires UsdcLedger {
        debit(admin, from, amount);
        credit(admin, to, amount);
    }

    public entry fun deposit<CoinType>(user: &signer, admin_addr: address, amount: u128) acquires UsdcLedger {
        // Transfer coins from user to admin
        let coins = coin::withdraw<CoinType>(user, (amount as u64));
        coin::deposit<CoinType>(admin_addr, coins);
        
        // Update ledger
        let l = borrow_global_mut<UsdcLedger>(admin_addr);
        let u = signer::address_of(user);
        let cur = if (l.balances.contains::<address, u128>(u)) { 
            *l.balances.borrow_mut::<address, u128>(u) 
        } else { 
            0u128 
        };
        if (l.balances.contains::<address, u128>(u)) { 
            *l.balances.borrow_mut::<address, u128>(u) = cur + amount 
        } else { 
            l.balances.add::<address, u128>(u, cur + amount) 
        };
        
        // Update user collateral
        account::add_collateral(u, (amount as u64));
        events::emit_deposit(admin_addr, events::new_deposit_event(u, (amount as u64)));
    }

    public entry fun withdraw_for<CoinType>(admin: &signer, to: address, amount: u128) acquires UsdcLedger {
        // Update ledger
        debit(admin, to, amount);
        
        // Transfer coins from admin to user
        let coins = coin::withdraw<CoinType>(admin, (amount as u64));
        coin::deposit<CoinType>(to, coins);
        
        events::emit_withdraw(signer::address_of(admin), events::new_withdraw_event(to, (amount as u64)));
    }
}
