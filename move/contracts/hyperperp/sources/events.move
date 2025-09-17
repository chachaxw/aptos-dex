module hyperperp::events {
    use std::event;
    use std::signer;
    use std::vector;

    /// Global event handles stored under hyperperp resource account
    struct EventStore has key {
        deposit_events: event::EventHandle<DepositEvent>,
        withdraw_events: event::EventHandle<WithdrawEvent>,
        fill_events: event::EventHandle<FillEvent>,
        funding_events: event::EventHandle<FundingEvent>,
        liquidation_events: event::EventHandle<LiquidationEvent>,
    }

    public struct DepositEvent has copy, drop, store { user: address, amount: u64 }
    public struct WithdrawEvent has copy, drop, store { user: address, amount: u64 }
    public struct FillEvent has copy, drop, store {
        taker: address, maker: address, market_id: u64, size: u128, price_x: u64, fee_bps: u64
    }
    public struct FundingEvent has copy, drop, store { market_id: u64, delta: u128 }
    public struct LiquidationEvent has copy, drop, store { user: address, market_id: u64, size_closed: u128, penalty: u64 }

    // Public constructor functions
    public fun new_deposit_event(user: address, amount: u64): DepositEvent {
        DepositEvent { user, amount }
    }
    
    public fun new_withdraw_event(user: address, amount: u64): WithdrawEvent {
        WithdrawEvent { user, amount }
    }
    
    public fun new_fill_event(taker: address, maker: address, market_id: u64, size: u128, price_x: u64, fee_bps: u64): FillEvent {
        FillEvent { taker, maker, market_id, size, price_x, fee_bps }
    }
    
    public fun new_liquidation_event(user: address, market_id: u64, size_closed: u128, penalty: u64): LiquidationEvent {
        LiquidationEvent { user, market_id, size_closed, penalty }
    }

    public fun init_events(admin: &signer) {
        use aptos_framework::account;
        
        move_to(admin, EventStore {
            deposit_events: account::new_event_handle<DepositEvent>(admin),
            withdraw_events: account::new_event_handle<WithdrawEvent>(admin),
            fill_events: account::new_event_handle<FillEvent>(admin),
            funding_events: account::new_event_handle<FundingEvent>(admin),
            liquidation_events: account::new_event_handle<LiquidationEvent>(admin),
        });
    }

    public fun emit_deposit(addr: address, e: DepositEvent) acquires EventStore {
        let store = borrow_global_mut<EventStore>(addr);
        event::emit_event(&mut store.deposit_events, e)
    }

    public fun emit_withdraw(addr: address, e: WithdrawEvent) acquires EventStore {
        let store = borrow_global_mut<EventStore>(addr);
        event::emit_event(&mut store.withdraw_events, e)
    }

    public fun emit_fill(addr: address, e: FillEvent) acquires EventStore {
        let store = borrow_global_mut<EventStore>(addr);
        event::emit_event(&mut store.fill_events, e)    
    }

    public fun emit_funding(addr: address, e: FundingEvent) acquires EventStore {
        let store = borrow_global_mut<EventStore>(addr);
        event::emit_event(&mut store.funding_events, e)
    }

    public fun emit_liq(addr: address, e: LiquidationEvent) acquires EventStore {
        let store = borrow_global_mut<EventStore>(addr);
        event::emit_event(&mut store.liquidation_events, e)
    }
}