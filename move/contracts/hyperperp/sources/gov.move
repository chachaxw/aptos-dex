module hyperperp::gov {
    use std::signer;
    use std::vector;
    use hyperperp::errors;

    /// Simple multisig-like admin set
    struct Admins has key { members: vector<address>, paused: u64 }

    /// store in cfg_addr
    struct Withdrawers has key { members: vector<address> }

     /// 一次性初始化（必须由 cfg_addr 的 signer 调用）
    public entry fun init_withdrawers(cfg_owner: &signer) {
        let cfg_addr = signer::address_of(cfg_owner);
        if (exists<Withdrawers>(cfg_addr)) return;
        move_to(cfg_owner, Withdrawers { members: vector::empty<address>() });
    }

    public entry fun init_admins(creator: &signer, members: vector<address>) {
        if (exists<Admins>(signer::address_of(creator))) errors::abort_already_initialized();
        move_to(creator, Admins { members, paused: 0 });
    }

    public entry fun init_admins_single(creator: &signer, member: address) {
        if (exists<Admins>(signer::address_of(creator))) errors::abort_already_initialized();
        let members = vector::empty<address>();
        vector::push_back(&mut members, member);
        move_to(creator, Admins { members, paused: 0 });
    }

    public fun set_pause(admin: &signer, mask: u64, on: bool) acquires Admins {
        assert!(is_admin(admin), errors::e_unauthorized());
        let cfg = borrow_global_mut<Admins>(signer::address_of(admin));
        if (on) cfg.paused |= mask else cfg.paused &= (0xFFFFFFFFFFFFFFFF ^ mask);
    }

    public fun is_paused(addr: address, mask: u64): bool acquires Admins { (borrow_global<Admins>(addr)).paused & mask > 0 }

    public fun add_admin(admin: &signer, new_member: address) acquires Admins {
        assert!(is_admin(admin), errors::e_unauthorized());
        let cfg = borrow_global_mut<Admins>(signer::address_of(admin));
        cfg.members.push_back(new_member);
    }

    public fun is_admin(s: &signer): bool acquires Admins { contains_admin(signer::address_of(s)) }

    fun contains_admin(addr: address): bool acquires Admins {
        let cfg = borrow_global<Admins>(addr);
        let who = addr;
        let i = 0; let n = cfg.members.length();
        while (i < n) {
            if (cfg.members[i] == who) return true;
            i += 1;
        };
        false
    }

    public entry fun add_withdrawer(admin: &signer, cfg_addr: address, who: address) acquires Admins, Withdrawers {
        assert!(is_admin(admin), errors::e_unauthorized());
        let w = borrow_global_mut<Withdrawers>(cfg_addr);
        if (!w.members.contains(&who)) w.members.push_back(who);
    }

    public entry fun remove_withdrawer(admin: &signer, cfg_addr: address, who: address) acquires Admins, Withdrawers {
        assert!(is_admin(admin), errors::e_unauthorized());
        let w = borrow_global_mut<Withdrawers>(cfg_addr);
        let len = w.members.length();
        let i = 0;
        while (i < len) {
            if (w.members[i] == who) {
                w.members.swap_remove(i);
                break;
            };
            i += 1;
        }
    }

    /// If the caller is in the whitelist, return true
    public fun is_withdrawer(caller: &signer, cfg_addr: address): bool acquires Withdrawers {
        if (!exists<Withdrawers>(cfg_addr)) return false;
        let w = borrow_global<Withdrawers>(cfg_addr);
        let who = signer::address_of(caller);
        let len = w.members.length();
        let i = 0;
        while (i < len) {
            if (w.members[i] == who) return true;
            i += 1;
        };
        false
    }
}