#!/bin/bash

# HyperPerp 快速部署脚本
# 简化版本，用于快速重新部署

set -e

PUBLISHER_PROFILE="hyperperp_publisher"
PUBLISHER_ADDR="0x517206cb6757cc0723667a05afb9c05675341cd79570ba7cfb72f63241d55a2e"
ADMIN_ADDR="0x517206cb6757cc0723667a05afb9c05675341cd79570ba7cfb72f63241d55a2e"

# 清理构建文件
echo "清理构建文件..."
sudo rm -rf build/ 2>/dev/null || true

# 编译合约
echo "编译合约..."
aptos move compile --dev

# 部署合约
echo "部署合约..."
OUTPUT=$(aptos move create-object-and-publish-package \
    --address-name hyperperp \
    --named-addresses hyperperp=$PUBLISHER_ADDR,admin=$ADMIN_ADDR \
    --profile $PUBLISHER_PROFILE \
    --skip-fetch-latest-git-deps \
    --assume-yes)

# 提取并保存合约地址
CONTRACT_ADDRESS=$(echo "$OUTPUT" | grep "Code was successfully deployed to object address" | awk '{print $NF}' | sed 's/\.$//')
echo "$CONTRACT_ADDRESS" > contract_address.txt

echo ""
echo "部署完成！"
echo "部署信息："
echo "   发布者: $PUBLISHER_PROFILE"
echo "   合约地址: $CONTRACT_ADDRESS"
echo "   管理员: $ADMIN_ADDR"
echo ""
