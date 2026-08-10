// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { OrdivaRegistry } from "../src/OrdivaRegistry.sol";

contract BroadcasterFinder {
    address public immutable BROADCASTER;

    constructor() {
        BROADCASTER = msg.sender;
    }
}

abstract contract DeploymentBase is Script {
    struct NetworkConfig {
        string networkName;
        bool configured;
    }

    uint256 internal constant ARC_TESTNET = 5_042_002;

    function getDeploymentConfig() internal view returns (NetworkConfig memory config) {
        if (block.chainid == ARC_TESTNET) {
            config = NetworkConfig({ networkName: "Arc Testnet", configured: true });
        } else {
            config =
                NetworkConfig({ networkName: "Local / unconfigured network", configured: false });
        }
    }

    function _resolveDeployer() internal returns (address deployer) {
        vm.startBroadcast();
        BroadcasterFinder finder = new BroadcasterFinder();
        deployer = finder.BROADCASTER();
        vm.stopBroadcast();
    }

    function _logSummary(address registry, address deployer, NetworkConfig memory config)
        internal
        pure
    {
        console2.log("\n=== Deployment Summary ===");
        console2.log("Network:", config.networkName);
        console2.log("\n--- Contract Addresses ---");
        console2.log("OrdivaRegistry:", registry);
        console2.log("\n--- Configuration ---");
        console2.log("Owner / Deployer:", deployer);
        console2.log("\n--- Copy into api/.env ---");
        console2.log("ARC_REGISTRY_ADDRESS=", registry);
        console2.log("\n=== Deployment Complete ===");
    }
}

/// @notice Deploy the Ordiva audit and outreach-approval registry.
/// @dev pnpm --filter @ordiva/contracts exec forge script
///      script/DeployOrdivaRegistry.s.sol:DeployOrdivaRegistry
///      --rpc-url "$ARC_RPC_URL" --account <keystore-account> --broadcast
contract DeployOrdivaRegistry is DeploymentBase {
    function setUp() public { }

    function run() external returns (OrdivaRegistry registry) {
        NetworkConfig memory config = getDeploymentConfig();

        console2.log("=== Ordiva Registry Deployment ===");
        console2.log("Network:", config.networkName);
        console2.log("Chain ID:", block.chainid);
        if (!config.configured) {
            console2.log("WARNING: deploying outside the configured Arc Testnet network.");
        }

        address deployer = _resolveDeployer();
        console2.log("Owner / Deployer:", deployer);

        vm.startBroadcast(deployer);
        console2.log("\nDeploying OrdivaRegistry...");
        registry = new OrdivaRegistry();
        console2.log("OrdivaRegistry deployed at:", address(registry));
        vm.stopBroadcast();

        _logSummary(address(registry), deployer, config);
    }
}
