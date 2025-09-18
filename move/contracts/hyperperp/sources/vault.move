module hyperperp::vault {
    use std::signer;
    use aptos_framework::coin;

    use hyperperp::events;
    use hyperperp::errors;
    use hyperperp::gov;
    use hyperperp::account;
    use hyperperp::constants;

    /// ------------------------------------------------------------------
    /// CONFIG & STORAGE
    /// ------------------------------------------------------------------
    struct Config<phantom T> has key {
        admin: address,
        vault_addr: address,
        min_deposit: u64,
    }

    struct Collateral<phantom T> has key {
        treasury: coin::Coin<T>
    }

    /// ------------------------------------------------------------------
    /// INIT
    /// ------------------------------------------------------------------
    public entry fun init<T>(
        cfg_owner: &signer,
        vault_owner: &signer,
        min_deposit: u64
    ) {
        let cfg_addr = signer::address_of(cfg_owner);
        let v_addr   = signer::address_of(vault_owner);
        if (exists<Config<T>>(cfg_addr)) errors::abort_already_initialized();
        if (exists<Collateral<T>>(v_addr)) errors::abort_already_initialized();

        move_to(cfg_owner, Config<T> { admin: cfg_addr, vault_addr: v_addr, min_deposit });
        move_to(vault_owner, Collateral<T> { treasury: coin::zero<T>() });
    }

    public entry fun set_vault_addr<T>(admin: &signer, cfg_addr: address, new_vault_addr: address) acquires Config {
        assert!(gov::is_admin(admin), errors::e_unauthorized());
        let cfg = borrow_global_mut<Config<T>>(cfg_addr);
        assert!(cfg.admin == signer::address_of(admin), errors::e_unauthorized());
        cfg.vault_addr = new_vault_addr;
    }

    /// ------------------------------------------------------------------
    /// READ-ONLY VIEWS
    /// ------------------------------------------------------------------
    public fun get_vault_addr<T>(cfg_addr: address): address acquires Config { borrow_global<Config<T>>(cfg_addr).vault_addr }

    public fun total_assets<T>(cfg_addr: address): u64 acquires Config, Collateral {
        coin::value<T>(&borrow_global<Collateral<T>>(get_vault_addr<T>(cfg_addr)).treasury)
    }

    public fun min_deposit<T>(cfg_addr: address): u64 acquires Config { borrow_global<Config<T>>(cfg_addr).min_deposit }

    /// ------------------------------------------------------------------
    /// DEPOSIT / WITHDRAW
    /// ------------------------------------------------------------------
    public entry fun deposit<T>(user: &signer, amount: u64, cfg_addr: address) acquires Config, Collateral {
        assert!(!gov::is_paused(cfg_addr, constants::pause_deposit()), errors::e_paused());
        assert!(amount >= min_deposit<T>(cfg_addr), errors::e_amount_too_small());

        let u_addr = signer::address_of(user);
        let c = coin::withdraw<T>(user, amount);
        let v_addr = get_vault_addr<T>(cfg_addr);
        let v = borrow_global_mut<Collateral<T>>(v_addr);
        coin::merge(&mut v.treasury, c);

        account::add_collateral(u_addr, amount);
        events::emit_deposit(cfg_addr, events::new_deposit_event(u_addr, amount));
    }

    /// Whitelisted withdraw. Now gated by `gov::is_withdrawer`.
    public entry fun withdraw_to<T>(caller: &signer, recipient: address, amount: u64, cfg_addr: address) acquires Config, Collateral {
        assert!(!gov::is_paused(cfg_addr, constants::pause_withdraw()), errors::e_paused());
        assert!(gov::is_withdrawer(caller, cfg_addr) || gov::is_admin(caller), errors::e_unauthorized());

        account::sub_collateral(recipient, amount);
        let v_addr = get_vault_addr<T>(cfg_addr);
        let v = borrow_global_mut<Collateral<T>>(v_addr);
        let out = coin::extract<T>(&mut v.treasury, amount);
        coin::deposit<T>(recipient, out);

        events::emit_withdraw(cfg_addr, events::new_withdraw_event(recipient, amount));
    }

    /// Admin sweep: still only for admin and only allowed in paused state.
    public entry fun admin_sweep<T>(admin: &signer, amount: u64, cfg_addr: address) acquires Config, Collateral {
        assert!(gov::is_admin(admin), errors::e_unauthorized());
        assert!(gov::is_paused(cfg_addr, constants::pause_withdraw()), errors::e_paused_required());

        let to = signer::address_of(admin);
        let v_addr = get_vault_addr<T>(cfg_addr);
        let v = borrow_global_mut<Collateral<T>>(v_addr);
        let out = coin::extract<T>(&mut v.treasury, amount);
        coin::deposit<T>(to, out);
        events::emit_withdraw(cfg_addr, events::new_withdraw_event(to, amount));
    }

    public entry fun legacy_admin_withdraw<T>(admin: &signer, amount: u64, cfg_addr: address) acquires Config, Collateral {
        admin_sweep<T>(admin, amount, cfg_addr)
    }
}
