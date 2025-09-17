module hyperperp::positions {
    use std::table;
    use std::signer;
    use hyperperp::errors;
    
    /// Position data
    public struct Position has key, drop {
        owner: address,
        market_id: u64,
        size: u128, // TODO: implement proper signed integer handling
        entry_notional: u128,
        funding_acc: u128,
    }

    /// User's position registry
    struct PositionRegistry has key {
        positions: table::Table<u64, Position>, // market_id -> Position
    }

    /// For MVP, we'll use a simplified approach where positions are created on-demand
    /// In production, this would require proper account management and resource creation patterns
    public fun ensure(_owner: address, _market_id: u64) {
        // MVP stub - in real implementation would create position resource
        // This requires the owner's signer which we don't have in this context
    }

    public fun borrow_mut(owner: address, market_id: u64): Position {
        // MVP stub - return default position since we can't actually store them without proper setup
        Position { owner, market_id, size: 0, entry_notional: 0, funding_acc: 0 }
    }

    public fun exists_at(_owner: address, _market_id: u64): bool {
        // MVP stub - return true for testing
        true
    }
    
    // Public getter functions
    public fun get_size(pos: &Position): u128 { pos.size }
}
