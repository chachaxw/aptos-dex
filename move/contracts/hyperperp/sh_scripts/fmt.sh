#!/bin/sh

set -e

echo "##### Lint and format #####"

aptos move fmt

aptos move lint \
  --named-addresses hyperperp_addr=0xf088abc10dd7dbc83f95cd621fa85964a8f5d7efecf10272fb2cc6a909b8e647 # dummy address
