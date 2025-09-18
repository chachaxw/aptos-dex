module hyperperp::events {
    use std::event;

    /// Global event handles stored under hyperperp resource account
    struct EventStore has key {
        deposit_events: event::EventHandle<DepositEvent>,
        withdraw_events: event::EventHandle<WithdrawEvent>,
        fill_events: event::EventHandle<FillEvent>,
        funding_events: event::EventHandle<FundingEvent>,
        liquidation_events: event::EventHandle<LiquidationEvent>,
        position_update_events: event::EventHandle<PositionUpdateEvent>,
        position_close_events: event::EventHandle<PositionCloseEvent>,
    }

    /// Deposit event
    public struct DepositEvent has copy, drop, store {
        user: address, amount: u64
    }

    /// Withdraw event
    public struct WithdrawEvent has copy, drop, store {
        user: address, amount: u64
    }

    /// Fill event
    public struct FillEvent has copy, drop, store {
        taker: address, maker: address, market_id: u64, size: u128, price_x: u64, fee_bps: u64
    }

    /// Funding event
    public struct FundingEvent has copy, drop, store {
        market_id: u64, rate: u64
    }

    /// Liquidation event
    public struct LiquidationEvent has copy, drop, store {
        user: address, market_id: u64, size_closed: u128, penalty: u64
    }

    /// Position update event
    public struct PositionUpdateEvent has copy, drop, store {
        user: address, market_id: u64, size: u128, is_long: bool, price: u64
    }

    /// Position close event
    public struct PositionCloseEvent has copy, drop, store {
        user: address, market_id: u64, size_closed: u128, close_price: u64, pnl: u128, is_profit: bool
    }

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
    
    public fun new_position_update_event(user: address, market_id: u64, size: u128, is_long: bool, price: u64): PositionUpdateEvent {
        PositionUpdateEvent { user, market_id, size, is_long, price }
    }
    
    public fun new_position_close_event(user: address, market_id: u64, size_closed: u128, close_price: u64, pnl: u128, is_profit: bool): PositionCloseEvent {
        PositionCloseEvent { user, market_id, size_closed, close_price, pnl, is_profit }
    }

    public fun new_funding_event(market_id: u64, rate: u64): FundingEvent {
        FundingEvent { market_id, rate }
    }

    public entry fun init_events(admin: &signer) {
        use aptos_framework::account;
        
        move_to(admin, EventStore {
            deposit_events: account::new_event_handle<DepositEvent>(admin),
            withdraw_events: account::new_event_handle<WithdrawEvent>(admin),
            fill_events: account::new_event_handle<FillEvent>(admin),
            funding_events: account::new_event_handle<FundingEvent>(admin),
            liquidation_events: account::new_event_handle<LiquidationEvent>(admin),
            position_update_events: account::new_event_handle<PositionUpdateEvent>(admin),
            position_close_events: account::new_event_handle<PositionCloseEvent>(admin),
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

    public fun emit_position_update(addr: address, e: PositionUpdateEvent) acquires EventStore {
        let store = borrow_global_mut<EventStore>(addr);
        event::emit_event(&mut store.position_update_events, e)
    }

    public fun emit_position_close(addr: address, e: PositionCloseEvent) acquires EventStore {
        let store = borrow_global_mut<EventStore>(addr);
        event::emit_event(&mut store.position_close_events, e)
    }
}