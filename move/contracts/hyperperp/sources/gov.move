module hyperperp::gov {
    use std::signer;
    use hyperperp::errors;

    /// Simple multisig-like admin set
    struct Admins has key { members: vector<address>, paused: u64 }

    public fun init_admins(creator: &signer, members: vector<address>) {
        if (exists<Admins>(signer::address_of(creator))) errors::abort_already_initialized();
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
        while (i < n) { if (cfg.members[i] == who) return true; i += 1 };
        false
    }
}