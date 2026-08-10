// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Ordiva run, outreach approval, and ledger commitment registry
/// @notice Stores hashes and economic commitments only. Commercial content remains offchain.
contract OrdivaRegistry {
    enum RunStatus {
        Active,
        Completed,
        PartiallyCompleted,
        Failed,
        BudgetExhausted
    }

    struct RunCommitment {
        address owner;
        address agent;
        uint96 budgetMicros;
        uint96 totalSpentMicros;
        uint32 purchaseCount;
        bytes32 policyHash;
        bytes32 purchaseRoot;
        bytes32 resultHash;
        RunStatus status;
    }

    struct OutreachApproval {
        bytes32 contentHash;
        uint64 expiresAt;
        bool revoked;
    }

    mapping(bytes32 => RunCommitment) public runs;
    mapping(bytes32 => mapping(bytes32 => OutreachApproval)) public outreachApprovals;

    event RunRegistered(
        bytes32 indexed runId,
        address indexed owner,
        address indexed agent,
        uint256 budgetMicros,
        bytes32 policyHash
    );
    event OutreachApproved(
        bytes32 indexed runId, bytes32 indexed outreachId, bytes32 contentHash, uint64 expiresAt
    );
    event OutreachRevoked(bytes32 indexed runId, bytes32 indexed outreachId);
    event LedgerAnchored(
        bytes32 indexed runId, bytes32 purchaseRoot, uint256 totalSpentMicros, uint32 purchaseCount
    );
    event RunClosed(bytes32 indexed runId, bytes32 resultHash, RunStatus status);

    error RunAlreadyExists();
    error RunNotFound();
    error Unauthorized();
    error InvalidCommitment();
    error RunClosedAlready();

    modifier onlyOwner(bytes32 runId) {
        _checkOwner(runId);
        _;
    }

    modifier onlyOperator(bytes32 runId) {
        _checkOperator(runId);
        _;
    }

    function _checkOwner(bytes32 runId) internal view {
        if (runs[runId].owner == address(0)) revert RunNotFound();
        if (msg.sender != runs[runId].owner) revert Unauthorized();
    }

    function _checkOperator(bytes32 runId) internal view {
        RunCommitment storage run = runs[runId];
        if (run.owner == address(0)) revert RunNotFound();
        if (msg.sender != run.owner && msg.sender != run.agent) revert Unauthorized();
    }

    function registerRun(
        bytes32 runId,
        address owner,
        address agent,
        uint96 budgetMicros,
        bytes32 policyHash
    ) external {
        if (runs[runId].owner != address(0)) revert RunAlreadyExists();
        if (
            runId == bytes32(0) || owner == address(0) || agent == address(0) || budgetMicros == 0
                || policyHash == bytes32(0)
        ) {
            revert InvalidCommitment();
        }
        if (msg.sender != owner && msg.sender != agent) revert Unauthorized();
        runs[runId] = RunCommitment({
            owner: owner,
            agent: agent,
            budgetMicros: budgetMicros,
            totalSpentMicros: 0,
            purchaseCount: 0,
            policyHash: policyHash,
            purchaseRoot: bytes32(0),
            resultHash: bytes32(0),
            status: RunStatus.Active
        });
        emit RunRegistered(runId, owner, agent, budgetMicros, policyHash);
    }

    function approveOutreach(
        bytes32 runId,
        bytes32 outreachId,
        bytes32 contentHash,
        uint64 expiresAt
    ) external onlyOwner(runId) {
        if (runs[runId].status != RunStatus.Active) revert RunClosedAlready();
        if (outreachId == bytes32(0) || contentHash == bytes32(0) || expiresAt <= block.timestamp) {
            revert InvalidCommitment();
        }
        outreachApprovals[runId][outreachId] =
            OutreachApproval({ contentHash: contentHash, expiresAt: expiresAt, revoked: false });
        emit OutreachApproved(runId, outreachId, contentHash, expiresAt);
    }

    function revokeOutreach(bytes32 runId, bytes32 outreachId) external onlyOwner(runId) {
        OutreachApproval storage approval = outreachApprovals[runId][outreachId];
        if (approval.contentHash == bytes32(0)) revert InvalidCommitment();
        approval.revoked = true;
        emit OutreachRevoked(runId, outreachId);
    }

    function isOutreachApproved(bytes32 runId, bytes32 outreachId, bytes32 contentHash)
        external
        view
        returns (bool)
    {
        OutreachApproval storage approval = outreachApprovals[runId][outreachId];
        return approval.contentHash == contentHash && !approval.revoked
            && approval.expiresAt >= block.timestamp;
    }

    function anchorLedger(
        bytes32 runId,
        bytes32 purchaseRoot,
        uint96 totalSpentMicros,
        uint32 purchaseCount
    ) external onlyOperator(runId) {
        RunCommitment storage run = runs[runId];
        if (
            purchaseRoot == bytes32(0) || totalSpentMicros < run.totalSpentMicros
                || totalSpentMicros > run.budgetMicros || purchaseCount < run.purchaseCount
        ) revert InvalidCommitment();
        run.purchaseRoot = purchaseRoot;
        run.totalSpentMicros = totalSpentMicros;
        run.purchaseCount = purchaseCount;
        emit LedgerAnchored(runId, purchaseRoot, totalSpentMicros, purchaseCount);
    }

    function closeRun(bytes32 runId, bytes32 resultHash, RunStatus status)
        external
        onlyOperator(runId)
    {
        RunCommitment storage run = runs[runId];
        if (run.status != RunStatus.Active) revert RunClosedAlready();
        if (resultHash == bytes32(0) || status == RunStatus.Active) revert InvalidCommitment();
        run.resultHash = resultHash;
        run.status = status;
        emit RunClosed(runId, resultHash, status);
    }
}
