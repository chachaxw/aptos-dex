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
        size: u128, // positive for long, negative for short (using u128 with sign logic)
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

    /// Check if position registry exists for user
    public fun position_exists(owner: address): bool {
        exists<PositionRegistry>(owner)
    }

    /// Ensure position exists for user and market
    public fun ensure(owner: address, market_id: u64) acquires PositionRegistry {
        if (!position_exists(owner)) {
            abort errors::e_position_registry_not_found()
        };
        
        let registry = borrow_global_mut<PositionRegistry>(owner);
        if (!registry.positions.contains(market_id)) {
            let position = Position {
                owner,
                market_id,
                size: 0,
                entry_notional: 0,
                funding_acc: 0,
                last_updated: timestamp::now_microseconds(),
            };
            registry.positions.add(market_id, position);
            registry.position_count += 1;
        };
    }

    /// Get position by value (for MVP - in production would need different pattern)
    public fun get_position_value(owner: address, market_id: u64): Position acquires PositionRegistry {
        assert!(position_exists(owner), errors::e_position_registry_not_found());
        let registry = borrow_global_mut<PositionRegistry>(owner);
        assert!(registry.positions.contains(market_id), errors::e_position_not_found());
        registry.positions.remove(market_id)
    }

    /// Check if position exists at specific market
    public fun exists_at(owner: address, market_id: u64): bool acquires PositionRegistry {
        if (!position_exists(owner)) {
            return false
        };
        let registry = borrow_global<PositionRegistry>(owner);
        registry.positions.contains(market_id)
    }

    /// Get position by value (for MVP - in production would need different pattern)
    public fun get_position(owner: address, market_id: u64): Position acquires PositionRegistry {
        assert!(position_exists(owner), errors::e_position_registry_not_found());
        let registry = borrow_global_mut<PositionRegistry>(owner);
        assert!(registry.positions.contains(market_id), errors::e_position_not_found());
        registry.positions.remove(market_id)
    }

    /// Put position back (for MVP - in production would need different pattern)
    public fun put_position(owner: address, market_id: u64, position: Position) acquires PositionRegistry {
        assert!(position_exists(owner), errors::e_position_registry_not_found());
        let registry = borrow_global_mut<PositionRegistry>(owner);
        registry.positions.add(market_id, position);
    }

    /// Get position size without removing position (for MVP)
    public fun get_position_size(owner: address, market_id: u64): u128 acquires PositionRegistry {
        let position = get_position(owner, market_id);
        let size = get_size(&position);
        put_position(owner, market_id, position);
        size
    }

    /// Update position size (handles long/short logic)
    public fun update_size(position: &mut Position, new_size: u128, is_long: bool) {
        if (is_long) {
            position.size = new_size;
        } else {
            // For short positions, we store the absolute value and use logic elsewhere
            position.size = new_size;
        };
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
        if (is_long) {
            position.size += size_delta;
        } else {
            // For short positions, subtract (but we store absolute values)
            if (position.size >= size_delta) {
                position.size -= size_delta;
            } else {
                position.size = size_delta - position.size;
            };
        };
        position.last_updated = timestamp::now_microseconds();
    }

    /// Check if position is long
    public fun is_long(position: &Position): bool {
        // In this simplified implementation, we assume positive size = long
        // In production, you'd have a separate field or use a different encoding
        true // TODO: implement proper long/short detection
    }

    /// Check if position is short
    public fun is_short(position: &Position): bool {
        !is_long(position)
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

    public fun get_entry_notional(pos: &Position): u128 { pos.entry_notional }

    public fun get_funding_acc(pos: &Position): u128 { pos.funding_acc }

    public fun get_owner(pos: &Position): address { pos.owner }

    public fun get_market_id(pos: &Position): u64 { pos.market_id }

    public fun get_last_updated(pos: &Position): u64 { pos.last_updated }
}
