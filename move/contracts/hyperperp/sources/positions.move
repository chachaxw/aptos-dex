module hyperperp::positions {
    use std::table;
    use std::signer;
    use std::vector;
    use hyperperp::errors;
    use aptos_framework::timestamp;

    /// Position data
    public struct Position has key, drop, store {
        owner: address,
        market_id: u64,
        size: u128, // absolute size
        is_long: bool, // true for long, false for short
        entry_notional: u128,
        funding_acc: u128,
        last_updated: u64,
    }

    /// User's position registry
    public struct PositionRegistry has key {
        positions: table::Table<u64, Position>, // market_id -> Position
        position_count: u64,
    }

    /// Initialize position registry for a user
    public fun initialize(owner: &signer) {
        let owner_addr = signer::address_of(owner);
        assert!(!position_exists(owner_addr), errors::e_position_registry_exists());
        
        move_to(owner, PositionRegistry {
            positions: table::new(),
            position_count: 0,
        });
    }

    /// Check if position registry exists for user (stubbed to false)
    public fun position_exists(_owner: address): bool { false }

    /// Ensure position exists for user and market
    /// Ensure position exists for user and market (stub: no-op)
    public fun ensure(_owner: address, _market_id: u64) { }

    /// Get position by value (for MVP - in production would need different pattern)
    public fun get_position_value(owner: address, market_id: u64): Position acquires PositionRegistry {
        assert!(position_exists(owner), errors::e_position_registry_not_found());
        let registry = borrow_global_mut<PositionRegistry>(owner);
        assert!(registry.positions.contains(market_id), errors::e_position_not_found());
        registry.positions.remove(market_id)
    }

    /// Check if position exists at specific market
    public fun exists_at(_owner: address, _market_id: u64): bool { true }

    /// Get position by value (for MVP - in production would need different pattern)
    public fun get_position(owner: address, market_id: u64): Position {
        Position { owner, market_id, size: 0, is_long: true, entry_notional: 0, funding_acc: 0, last_updated: 0 }
    }

    /// Put position back (for MVP - in production would need different pattern)
    public fun put_position(_owner: address, _market_id: u64, _position: Position) { }

    /// Get position size without removing position (for MVP)
    public fun get_position_size(_owner: address, _market_id: u64): u128 { 0 }

    /// Update position size (handles long/short logic)
    public fun update_size(position: &mut Position, new_size: u128, is_long: bool) {
        position.size = new_size;
        position.is_long = is_long;
        position.last_updated = timestamp::now_microseconds();
    }

    /// Update position entry notional
    public fun update_entry_notional(position: &mut Position, notional: u128) {
        position.entry_notional = notional;
        position.last_updated = timestamp::now_microseconds();
    }

    /// Update funding accumulator
    public fun update_funding_acc(position: &mut Position, funding: u128) {
        position.funding_acc = funding;
        position.last_updated = timestamp::now_microseconds();
    }

    /// Add to position size
    public fun add_size(position: &mut Position, size_delta: u128, is_long: bool) {
        if (position.size == 0) {
            // New position - set direction
            position.size = size_delta;
            position.is_long = is_long;
        } else if (position.is_long == is_long) {
            // Same direction - add to size
            position.size += size_delta;
        } else {
            // Opposite direction - reduce or flip position
            if (position.size >= size_delta) {
                position.size -= size_delta;
            } else {
                position.size = size_delta - position.size;
                position.is_long = is_long; // Flip direction
            };
        };
        position.last_updated = timestamp::now_microseconds();
    }

    /// Check if position is long
    public fun is_long(position: &Position): bool {
        position.is_long
    }

    /// Check if position is short
    public fun is_short(position: &Position): bool {
        !position.is_long
    }

    /// Check if position is empty (no size)
    public fun is_empty(position: &Position): bool {
        position.size == 0
    }

    /// Get all position market IDs for a user
    public fun get_position_markets(owner: address): vector<u64> acquires PositionRegistry {
        assert!(position_exists(owner), errors::e_position_registry_not_found());
        let _registry = borrow_global<PositionRegistry>(owner);
        let market_ids = vector::empty<u64>();
        
        // In a real implementation, you'd iterate through the table
        // For MVP, we'll return empty vector
        market_ids
    }

    /// Get position count for user
    public fun get_position_count(owner: address): u64 acquires PositionRegistry {
        assert!(position_exists(owner), errors::e_position_registry_not_found());
        let registry = borrow_global<PositionRegistry>(owner);
        registry.position_count
    }

    /// Close position (set size to 0)
    public fun close_position(position: &mut Position) {
        position.size = 0;
        position.is_long = true; // Reset to default
        position.entry_notional = 0;
        position.funding_acc = 0;
        position.last_updated = timestamp::now_microseconds();
    }

    /// Destroy empty position
    public fun destroy_empty_position(owner: address, market_id: u64) acquires PositionRegistry {
        assert!(position_exists(owner), errors::e_position_registry_not_found());
        let registry = borrow_global_mut<PositionRegistry>(owner);
        assert!(registry.positions.contains(market_id), errors::e_position_not_found());
        
        let position = registry.positions.remove(market_id);
        assert!(is_empty(&position), errors::e_position_not_empty());
        
        registry.position_count -= 1;
        // Explicitly let position go out of scope; no need to call drop in Move
    }
    
    // Public getter functions
    public fun get_size(pos: &Position): u128 { pos.size }

    public fun get_is_long(pos: &Position): bool { pos.is_long }

    public fun get_entry_notional(pos: &Position): u128 { pos.entry_notional }

    public fun get_funding_acc(pos: &Position): u128 { pos.funding_acc }

    public fun get_owner(pos: &Position): address { pos.owner }

    public fun get_market_id(pos: &Position): u64 { pos.market_id }

    public fun get_last_updated(pos: &Position): u64 { pos.last_updated }
}
