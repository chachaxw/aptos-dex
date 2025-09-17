# Message board contract

This is a simple message board contract that allows users to post messages on-chain and read messages from the chain. For both `create` and `update` endpoints, contract emits Create event and Update event respectively, then indexer will parse these events and store the message in the database for frontend to query efficiently.

- `scripts` directory contains Move scripts that can batch multiple contract calls in 1 transaction.
- `tests` directory contains Move unit tests.
- `sources` directory contains the main contract code.
- `sh_scripts` directory contains shell scripts that can be used to test, publish, upgrade the contract, run Move scripts and generate TypeScript ABI. You can run them in this order:
  - `./sh_scripts/init.sh`: create a new wallet
  - `./sh_scripts/test.sh`: test the contract
  - `./sh_scripts/deploy.sh`: deploy the contract
  - `./sh_scripts/upgrade.sh`: upgrade the contract, you can only run this when you make compatible changes, changing existing structs and function signatures are considered incompatible changes. For incompatible changes, you need to deploy a new contract and migrate the data to new contract manually.
  - `./sh_scripts/get_abis.sh`: generate TypeScript ABI in the frontend directory and node scripts directory.
  - `./sh_scripts/run_create_2_messages_script.sh`: run Move script to create 2 messages in 1 transaction.
  - `./sh_scripts/run_update_message_script.sh`: run Move script to update a messages in 1 transaction.

# 核心模块
1. constants / errors / events / gov（多签与暂停）
2. vault（托管金库；MVP 先用 TestCoin，占位为 USDC）
3. market_registry（市场与参数）
4. account / positions（账户与头寸资源）
5. oracle_adapter（价格缓存；先由管理员喂价，后续可改 Pyth/Switchboard 证明）
6. risk（占位的保证金校验）
7. perp_engine（批量结算接口 apply_batch / 基础撮合填单逻辑）
8. liquidation（最简全平清算流程）
9. tests/（基础单测样例，确保能编译与跑通入口）
