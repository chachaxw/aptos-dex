#!/usr/bin/env bash
set -euo pipefail

# Profiles and addresses
PUBLISHER_PROFILE="${PUBLISHER_PROFILE:-hyperperp_publisher}"
ADMIN_ADDR="${ADMIN_ADDR:-0x517206cb6757cc0723667a05afb9c05675341cd79570ba7cfb72f63241d55a2e}"
ALICE_PROFILE="${ALICE_PROFILE:-alice}"
ALICE_ADDR="${ALICE_ADDR:-0xa9d9d029dd3a5dbdce6fc45e03e01e11d3915dc690ca0949129ba62779c54ce3}"
BOB_PROFILE="${BOB_PROFILE:-bob}"
BOB_ADDR="${BOB_ADDR:-0xd79dfa69496af2bcf413f4b26657fe95f6cd3192242c77e0e88433b205b3c713}"
USDC_META="${USDC_META:-0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832}"

function view_usdc() {
  local addr="$1"
  curl -s https://fullnode.testnet.aptoslabs.com/v1/view \
    -H 'Content-Type: application/json' \
    --data "{\"function\":\"0x1::primary_fungible_store::balance\",\"type_arguments\":[\"0x1::fungible_asset::Metadata\"],\"arguments\":[\"$addr\",\"$USDC_META\"]}"
}

echo "[1/6] Init modules (idempotent)"
aptos move run --profile "$PUBLISHER_PROFILE" --function-id "$ADMIN_ADDR::config::init" --args address:"$USDC_META" --assume-yes >/dev/null || true
aptos move run --profile "$PUBLISHER_PROFILE" --function-id "$ADMIN_ADDR::gov::init_admins_single" --args address:"$ADMIN_ADDR" --assume-yes >/dev/null || true
aptos move run --profile "$PUBLISHER_PROFILE" --function-id "$ADMIN_ADDR::events::init_events" --assume-yes >/dev/null || true
aptos move run --profile "$PUBLISHER_PROFILE" --function-id "$ADMIN_ADDR::vault_fa::init_ledger" --assume-yes >/dev/null || true
aptos move run --profile "$PUBLISHER_PROFILE" --function-id "$ADMIN_ADDR::oracle_adapter::init" --args u64:60 --assume-yes >/dev/null || true

echo "[2/6] Ensure accounts"
aptos move run --profile "$ALICE_PROFILE" --function-id "$ADMIN_ADDR::account::open" --assume-yes >/dev/null || true
aptos move run --profile "$BOB_PROFILE"   --function-id "$ADMIN_ADDR::account::open" --assume-yes >/dev/null || true

echo "[3/6] Snapshot pre"
ALICE_PRE=$(view_usdc "$ALICE_ADDR" | jq -r '.[0]')
BOB_PRE=$(view_usdc "$BOB_ADDR" | jq -r '.[0]')
echo "alice_pre=$ALICE_PRE  bob_pre=$BOB_PRE"

echo "[4/6] Deposit 3 USDC from alice to vault"
TX_DEP=$(aptos move run --profile "$ALICE_PROFILE" --function-id "$ADMIN_ADDR::vault_fa::deposit" --args address:"$ADMIN_ADDR" u128:3000000 --assume-yes | jq -r '.Result.transaction_hash // empty')
echo "tx_deposit=$TX_DEP"

echo "[5/6] Price feed + match batch + withdraw to maker(bob)"
TS=$(date +%s)
TX_PX=$(aptos move run --profile "$PUBLISHER_PROFILE" --function-id "$ADMIN_ADDR::oracle_adapter::push_price" --args u64:1 u64:30000000 u64:10 u64:$TS --assume-yes | jq -r '.Result.transaction_hash // empty')
TS2=$(date +%s)
TX_BATCH=$(aptos move run --profile "$PUBLISHER_PROFILE" --function-id "$ADMIN_ADDR::perp_engine::apply_batch_simple" --args address:"$ALICE_ADDR" address:"$BOB_ADDR" u64:1 u128:1 u64:3000000 u64:10 u64:$TS2 u64:$TS2 u64:2900000 u64:3100000 u64:$((TS2+600)) address:"$ADMIN_ADDR" --assume-yes | jq -r '.Result.transaction_hash // empty')
TX_WD=$(aptos move run --profile "$PUBLISHER_PROFILE" --function-id "$ADMIN_ADDR::vault_fa::withdraw_for" --args address:"$BOB_ADDR" u128:3000000 --assume-yes | jq -r '.Result.transaction_hash // empty')
echo "tx_push_price=$TX_PX"
echo "tx_apply_batch=$TX_BATCH"
echo "tx_withdraw=$TX_WD"

echo "[6/6] Snapshot post"
ALICE_POST=$(view_usdc "$ALICE_ADDR" | jq -r '.[0]')
BOB_POST=$(view_usdc "$BOB_ADDR" | jq -r '.[0]')
echo "alice_post=$ALICE_POST  bob_post=$BOB_POST"

DELTA_ALICE=$((ALICE_POST-ALICE_PRE))
DELTA_BOB=$((BOB_POST-BOB_PRE))
echo "delta_alice=$DELTA_ALICE  delta_bob=$DELTA_BOB"

echo "--- SUMMARY ---"
printf "tx_deposit=%s\n" "$TX_DEP"
printf "tx_push_price=%s\n" "$TX_PX"
printf "tx_apply_batch=%s\n" "$TX_BATCH"
printf "tx_withdraw=%s\n" "$TX_WD"
printf "alice: %s -> %s (delta %s)\n" "$ALICE_PRE" "$ALICE_POST" "$DELTA_ALICE"
printf "bob  : %s -> %s (delta %s)\n" "$BOB_PRE" "$BOB_POST" "$DELTA_BOB"


