// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { OrdivaRegistry } from "../src/OrdivaRegistry.sol";

interface Vm {
    function expectRevert(bytes4 selector) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract OrdivaRegistryTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    OrdivaRegistry private registry;

    address private constant OWNER = address(0xA11CE);
    address private constant AGENT = address(0xA63E7);
    address private constant STRANGER = address(0xBAD);

    bytes32 private constant RUN_ID = keccak256("run-1");
    bytes32 private constant POLICY_HASH = keccak256("policy-1");
    bytes32 private constant OUTREACH_ID = keccak256("outreach-1");
    bytes32 private constant CONTENT_HASH = keccak256("approved email body");

    function setUp() public {
        registry = new OrdivaRegistry();
        VM.prank(AGENT);
        registry.registerRun(RUN_ID, OWNER, AGENT, 2_000_000, POLICY_HASH);
    }

    function testRegistersRunCommitment() public view {
        (
            address owner,
            address agent,
            uint96 budgetMicros,
            uint96 totalSpentMicros,
            uint32 purchaseCount,
            bytes32 policyHash,
            bytes32 purchaseRoot,
            bytes32 resultHash,
            OrdivaRegistry.RunStatus status
        ) = registry.runs(RUN_ID);

        require(owner == OWNER, "wrong owner");
        require(agent == AGENT, "wrong agent");
        require(budgetMicros == 2_000_000, "wrong budget");
        require(totalSpentMicros == 0 && purchaseCount == 0, "unexpected spend");
        require(policyHash == POLICY_HASH, "wrong policy");
        require(purchaseRoot == bytes32(0) && resultHash == bytes32(0), "unexpected proof");
        require(status == OrdivaRegistry.RunStatus.Active, "wrong status");
    }

    function testRejectsDuplicateRun() public {
        VM.prank(OWNER);
        VM.expectRevert(OrdivaRegistry.RunAlreadyExists.selector);
        registry.registerRun(RUN_ID, OWNER, AGENT, 2_000_000, POLICY_HASH);
    }

    function testRejectsRegistrationByUnrelatedCaller() public {
        bytes32 otherRun = keccak256("run-2");
        VM.prank(STRANGER);
        VM.expectRevert(OrdivaRegistry.Unauthorized.selector);
        registry.registerRun(otherRun, OWNER, AGENT, 2_000_000, POLICY_HASH);
    }

    function testApprovesExactOutreachHashAndRevokesIt() public {
        uint64 expiresAt = uint64(block.timestamp + 1 days);
        VM.prank(OWNER);
        registry.approveOutreach(RUN_ID, OUTREACH_ID, CONTENT_HASH, expiresAt);

        require(registry.isOutreachApproved(RUN_ID, OUTREACH_ID, CONTENT_HASH), "not approved");
        require(
            !registry.isOutreachApproved(RUN_ID, OUTREACH_ID, keccak256("edited body")),
            "edited content approved"
        );

        VM.prank(OWNER);
        registry.revokeOutreach(RUN_ID, OUTREACH_ID);
        require(!registry.isOutreachApproved(RUN_ID, OUTREACH_ID, CONTENT_HASH), "not revoked");
    }

    function testApprovalExpires() public {
        uint64 expiresAt = uint64(block.timestamp + 1 hours);
        VM.prank(OWNER);
        registry.approveOutreach(RUN_ID, OUTREACH_ID, CONTENT_HASH, expiresAt);
        VM.warp(expiresAt + 1);
        require(!registry.isOutreachApproved(RUN_ID, OUTREACH_ID, CONTENT_HASH), "not expired");
    }

    function testOnlyOwnerApprovesOutreach() public {
        VM.prank(STRANGER);
        VM.expectRevert(OrdivaRegistry.Unauthorized.selector);
        registry.approveOutreach(
            RUN_ID, OUTREACH_ID, CONTENT_HASH, uint64(block.timestamp + 1 days)
        );
    }

    function testAgentAnchorsMonotonicLedgerWithinBudget() public {
        bytes32 firstRoot = keccak256("root-1");
        VM.prank(AGENT);
        registry.anchorLedger(RUN_ID, firstRoot, 67_500, 9);

        (,,, uint96 spent, uint32 count,, bytes32 root,,) = registry.runs(RUN_ID);
        require(spent == 67_500 && count == 9 && root == firstRoot, "ledger not anchored");

        VM.prank(AGENT);
        VM.expectRevert(OrdivaRegistry.InvalidCommitment.selector);
        registry.anchorLedger(RUN_ID, keccak256("over-budget"), 2_000_001, 10);
    }

    function testClosingRunPreventsNewApproval() public {
        VM.prank(AGENT);
        registry.closeRun(RUN_ID, keccak256("result"), OrdivaRegistry.RunStatus.Completed);

        VM.prank(OWNER);
        VM.expectRevert(OrdivaRegistry.RunClosedAlready.selector);
        registry.approveOutreach(
            RUN_ID, OUTREACH_ID, CONTENT_HASH, uint64(block.timestamp + 1 days)
        );
    }
}
