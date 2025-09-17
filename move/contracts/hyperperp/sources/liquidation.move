module hyperperp::liquidation {
    use hyperperp::positions as pos;
    use hyperperp::account as acct;
    use hyperperp::risk;
    use hyperperp::events;
    use hyperperp::errors;

    public fun liquidate(_caller: &signer, victim: address, market_id: u64, px: u64, events_addr: address) {
        // MVP liquidation: close entire position at px if under MMR
        if (!pos::exists_at(victim, market_id)) errors::abort_not_initialized();
        let p = pos::borrow_mut(victim, market_id);
        let size = pos::get_size(&p); 
        if (size == 0) return;
        let collateral = acct::get_collateral(victim);
        let ok = risk::check_maintenance(collateral, size, px);
        if (ok) return; // healthy
        // close to flat - MVP stub (can't actually modify position without proper storage)
        events::emit_liq(events_addr, events::new_liquidation_event(victim, market_id, size, 0));
    }
}
