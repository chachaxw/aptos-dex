module hyperperp::managed_coin {
    use std::signer;
    use std::string::String;
    use aptos_framework::coin::{Self, FreezeCapability, MintCapability, BurnCapability};
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};

    /// Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 3;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_UNAUTHORIZED: u64 = 5;

    /// Events
    #[event]
    struct MintEvent has drop, store {
        amount: u64,
        to: address,
    }

    #[event]
    struct BurnEvent has drop, store {
        amount: u64,
        from: address,
    }

    #[event]
    struct RegisterEvent has drop, store {
        account: address,
    }

    /// Managed coin configuration
    struct ManagedCoinInfo has key {
        /// The name of the coin
        name: String,
        /// The symbol of the coin
        symbol: String,
        /// The number of decimals used to get its user representation
        decimals: u8,
        /// The total supply of the coin
        total_supply: u64,
        /// The address that can mint new coins
        mint_cap: MintCapability<Self::TestCoin>,
        /// The address that can burn coins
        burn_cap: BurnCapability<Self::TestCoin>,
        /// The address that can freeze accounts
        freeze_cap: FreezeCapability<Self::TestCoin>,
        /// Event handles
        mint_events: EventHandle<MintEvent>,
        burn_events: EventHandle<BurnEvent>,
        register_events: EventHandle<RegisterEvent>,
    }

    /// Initialize a new managed coin
    public entry fun initialize(
        account: &signer,
        name: String,
        symbol: String,
        decimals: u8,
    ) {
        let account_addr = signer::address_of(account);
        
        // Check if already initialized
        assert!(!exists<ManagedCoinInfo>(account_addr), E_ALREADY_INITIALIZED);

        // Create the coin info
        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<Self::TestCoin>(
            account,
            name,
            symbol,
            decimals,
            true, // monitor_supply
        );

        // Create event handles
        let mint_events = account::new_event_handle<MintEvent>(account);
        let burn_events = account::new_event_handle<BurnEvent>(account);
        let register_events = account::new_event_handle<RegisterEvent>(account);

        // Store the managed coin info
        move_to(account, ManagedCoinInfo {
            name,
            symbol,
            decimals,
            total_supply: 0,
            mint_cap,
            burn_cap,
            freeze_cap,
            mint_events,
            burn_events,
            register_events,
        });
    }

    /// Register an account to receive the managed coin
    public entry fun register(account: &signer) acquires ManagedCoinInfo {
        let account_addr = signer::address_of(account);
        
        // Check if managed coin is initialized
        assert!(exists<ManagedCoinInfo>(@hyperperp), E_NOT_INITIALIZED);
        
        // Register the account for the coin
        coin::register<Self::TestCoin>(account);
        
        // Emit registration event
        let _info = borrow_global<ManagedCoinInfo>(@hyperperp);
        event::emit(RegisterEvent {
            account: account_addr,
        });
    }

    /// Mint new coins to an account
    public entry fun mint(
        account: &signer,
        to: address,
        amount: u64,
    ) acquires ManagedCoinInfo {
        let account_addr = signer::address_of(account);
        
        // Check if managed coin is initialized
        assert!(exists<ManagedCoinInfo>(account_addr), E_NOT_INITIALIZED);
        
        // Only the admin can mint
        assert!(account_addr == @hyperperp, E_UNAUTHORIZED);
        
        // Validate amount
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        // Mint the coins
        let mint_cap = &borrow_global<ManagedCoinInfo>(account_addr).mint_cap;
        let minted_coins = coin::mint<Self::TestCoin>(amount, mint_cap);
        coin::deposit<Self::TestCoin>(to, minted_coins);
        
        // Update total supply
        let info = borrow_global_mut<ManagedCoinInfo>(account_addr);
        info.total_supply += amount;
        
        // Emit mint event
        event::emit(MintEvent {
            amount,
            to,
        });
    }

    /// Burn coins from an account
    public entry fun burn(
        account: &signer,
        from: &signer,
        amount: u64,
    ) acquires ManagedCoinInfo {
        let account_addr = signer::address_of(account);
        
        // Check if managed coin is initialized
        assert!(exists<ManagedCoinInfo>(account_addr), E_NOT_INITIALIZED);
        
        // Only the admin can burn
        assert!(account_addr == @hyperperp, E_UNAUTHORIZED);
        
        // Validate amount
        assert!(amount > 0, E_INVALID_AMOUNT);

        // Burn the coins
        let burn_cap = &borrow_global<ManagedCoinInfo>(account_addr).burn_cap;
        let coins_to_burn = coin::withdraw<Self::TestCoin>(from, amount);
        coin::burn<Self::TestCoin>(coins_to_burn, burn_cap);    
        
        // Update total supply
        let info = borrow_global_mut<ManagedCoinInfo>(account_addr);
        info.total_supply -= amount;
        
        // Emit burn event
        event::emit(BurnEvent {
            amount,
            from: signer::address_of(from),
        });
    }

    /// Get the total supply of the managed coin
    public fun total_supply(): u64 acquires ManagedCoinInfo {
        assert!(exists<ManagedCoinInfo>(@hyperperp), E_NOT_INITIALIZED);
        borrow_global<ManagedCoinInfo>(@hyperperp).total_supply
    }

    /// Get the balance of an account
    public fun balance_of(account: address): u64 {
        if (coin::is_account_registered<Self::TestCoin>(account)) {
            coin::balance<Self::TestCoin>(account)
        } else {
            0
        }
    }

    /// Check if an account is registered for the coin
    public fun is_registered(account: address): bool {
        coin::is_account_registered<Self::TestCoin>(account)
    }

    /// Get coin info
    public fun coin_info(): (String, String, u8, u64) acquires ManagedCoinInfo {
        assert!(exists<ManagedCoinInfo>(@hyperperp), E_NOT_INITIALIZED);
        let info = borrow_global<ManagedCoinInfo>(@hyperperp);
        (info.name, info.symbol, info.decimals, info.total_supply)
    }

    /// Transfer coins between accounts
    public entry fun transfer(
        from: &signer,
        to: address,
        amount: u64,
    ) {
        coin::transfer<Self::TestCoin>(from, to, amount);
    }

    /// Test coin type
    struct TestCoin has drop {}

    /// Initialize the test coin (called automatically by the framework)
    fun init_module(account: &signer) {
        // This is called when the module is published
    }
}