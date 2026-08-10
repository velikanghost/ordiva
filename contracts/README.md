# Ordiva Registry

`OrdivaRegistry` is a Foundry project providing the optional Arc audit layer for run policy commitments, exact-content outreach approvals, and Merkle roots of the offchain purchase ledger.

It deliberately does not custody the agent's spending balance or replace the agent EOA. Circle Gateway nanopayments continue to use the EOA and offchain EIP-3009 authorizations; the registry stores compact public proofs around that flow.

The deployment tooling uses `forge-std` v1.16.2 as a pinned git submodule. After cloning, initialize it with:

```bash
git submodule update --init --recursive
```

From the workspace root:

```bash
pnpm --filter @ordiva/contracts fmt
pnpm --filter @ordiva/contracts build
pnpm --filter @ordiva/contracts test
```

Deploy to Arc Testnet using a Foundry keystore account. The script resolves the actual broadcaster, logs the chain configuration, and prints the exact `api/.env` value after deployment:

```bash
pnpm --filter @ordiva/contracts exec forge script \
  script/DeployOrdivaRegistry.s.sol:DeployOrdivaRegistry \
  --rpc-url "$ARC_RPC_URL" \
  --account <foundry-keystore-account> \
  --broadcast
```

After deployment, set `ARC_REGISTRY_ADDRESS` in `api/.env`. Do not place a private key in the repository or shell history.

The API submits `registerRun`, `anchorLedger`, and `closeRun` through each user's
developer-controlled agent wallet. It persists Circle's transaction ID first,
then the confirmed Arc transaction hash. Deploy this contract version before
enabling `ARC_REGISTRY_ADDRESS`; older deployments use the previous `registerRun`
signature and are not runtime-compatible.
