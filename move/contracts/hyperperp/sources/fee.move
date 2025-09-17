module hyperperp::fee {
    use std::signer; use hyperperp::errors;

    struct Fees has key { maker_bps: u64, taker_bps: u64, insurance_bps: u64, accrued: u64 }

    public fun init(admin: &signer, maker_bps: u64, taker_bps: u64, insurance_bps: u64) {
        if (exists<Fees>(signer::address_of(admin))) errors::abort_already_initialized();
        move_to(admin, Fees { maker_bps, taker_bps, insurance_bps, accrued: 0 });
    }

    public fun params(addr: address): (u64, u64, u64) acquires Fees { let f = borrow_global<Fees>(addr); (f.maker_bps, f.taker_bps, f.insurance_bps) }
    public fun accrue(addr: address, amount: u64) acquires Fees { let f = borrow_global_mut<Fees>(addr); f.accrued = f.accrued + amount }
}
