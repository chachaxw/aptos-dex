module hyperperp::config {
    use std::signer;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object;
    use hyperperp::errors;

    struct Config has key { usdc_meta_addr: address }

    public entry fun init(admin: &signer, usdc_meta_addr: address) {
        let a = signer::address_of(admin);
        if (exists<Config>(a)) errors::abort_already_initialized();
        move_to(admin, Config { usdc_meta_addr });
    }

    public fun usdc_meta(admin_addr: address): object::Object<Metadata> acquires Config {
        let c = borrow_global<Config>(admin_addr);
        object::address_to_object<Metadata>(c.usdc_meta_addr)
    }
}


