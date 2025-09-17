module hyperperp::basic_tests {
    use std::signer;
    use hyperperp::gov;
    use hyperperp::vault;
    use hyperperp::account as acct;
    use hyperperp::perp_engine as engine;

    #[test(admin = @admin, user = @user1)]
    public fun init_and_open(admin: &signer, user: &signer) {
        gov::init_admins(admin, vector<address>[ signer::address_of(admin) ]);
        vault::init_treasury(admin);
        acct::open(user);
        // minimal compile test for apply_batch
        let b = engine::new_settlement_batch(vector<engine::BatchFill>[], 0, 1, 1_000_000_000, 10);
        engine::apply_batch(admin, b, signer::address_of(admin));
    }
}
