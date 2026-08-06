import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AgentFundingService } from "../src/agent-wallet/agent-funding.service.js";
import type { AgentWalletConfig } from "../src/config.js";
import type { GatewayFunding } from "../src/agent-wallet/gateway-balance.reader.js";
import type { ContractExecutionRequest } from "../src/agent-wallet/circle-ucw.client.js";

const GATEWAY = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
const USDC = "0x3600000000000000000000000000000000000000";
const AGENT_ADDRESS = "0x177c3a98507dcf7b916efb80f89a695b96f3443c";
const OWNER_ADDRESS = "0xa09e0f2350020aab72e8c71abfb7ebb69dde9ec9";

const config = {
  GATEWAY_WALLET_ADDRESS: GATEWAY,
  USDC_ADDRESS: USDC,
  CIRCLE_WALLETS_API_URL: "https://api.circle.com",
  CIRCLE_API_KEY: "TEST_API_KEY:x:y"
} as unknown as AgentWalletConfig;

function build(funding: Partial<GatewayFunding> = {}) {
  const balances: GatewayFunding = {
    availableMicros: 0n,
    ownerUsdcMicros: 20_000_000n,
    ownerAllowanceMicros: 0n,
    ...funding
  };

  let count = 0;
  const createChallenge: (request: ContractExecutionRequest) => Promise<string> = async () =>
    `challenge-${++count}`;
  const ucw = { createContractExecutionChallenge: vi.fn(createChallenge) };

  const wallets = {
    findByUserId: vi.fn(async () => ({
      userId: "user-1",
      id: "owner-wallet-id",
      address: OWNER_ADDRESS,
      blockchain: "ARC-TESTNET" as const,
      accountType: "EOA" as const,
      state: "LIVE"
    }))
  };

  const service = new AgentFundingService(
    config,
    {
      ensureForUser: vi.fn(async () => ({
        userId: "user-1",
        id: "agent-wallet-id",
        address: AGENT_ADDRESS,
        blockchain: "ARC-TESTNET" as const,
        accountType: "EOA" as const,
        state: "LIVE"
      }))
    } as never,
    wallets as never,
    ucw as never,
    { read: vi.fn(async () => balances) } as never
  );

  return { service, ucw, wallets };
}

describe("createApproveChallenge", () => {
  it("approves on the USDC token, spender = Gateway", async () => {
    const { service, ucw } = build();

    const { challenge } = await service.createApproveChallenge("user-1", "token", "2");

    expect(challenge?.step).toBe("approve");
    const sent = ucw.createContractExecutionChallenge.mock.calls[0]![0];
    // The bug this guards: sending `approve` to the Gateway leaves the allowance at
    // zero and the later depositFor reverts with "transfer amount exceeds allowance".
    expect(sent.contractAddress).toBe(USDC);
    expect(sent.contractAddress).not.toBe(GATEWAY);
    expect(sent.abiFunctionSignature).toBe("approve(address,uint256)");
    expect(sent.abiParameters).toEqual([GATEWAY, "2000000"]);
  });

  it("skips the prompt when the allowance already covers the amount", async () => {
    const { service, ucw } = build({ ownerAllowanceMicros: 5_000_000n });

    const { challenge } = await service.createApproveChallenge("user-1", "token", "2");

    expect(challenge).toBeNull();
    expect(ucw.createContractExecutionChallenge).not.toHaveBeenCalled();
  });

  it("still approves when the allowance is short by one micro", async () => {
    const { service } = build({ ownerAllowanceMicros: 1_999_999n });

    const { challenge } = await service.createApproveChallenge("user-1", "token", "2");

    expect(challenge?.step).toBe("approve");
  });

  it("refuses to fund more than the owner holds", async () => {
    const { service, ucw } = build({ ownerUsdcMicros: 500_000n });

    await expect(service.createApproveChallenge("user-1", "token", "2")).rejects.toThrow(
      BadRequestException
    );
    expect(ucw.createContractExecutionChallenge).not.toHaveBeenCalled();
  });

  it("rejects malformed, zero, and oversized amounts before contacting Circle", async () => {
    for (const amount of ["0", "-1", "abc", "", "0.0000001", "21"]) {
      const { service, ucw } = build();
      await expect(
        service.createApproveChallenge("user-1", "token", amount),
        `expected "${amount}" to be rejected`
      ).rejects.toThrow(BadRequestException);
      expect(ucw.createContractExecutionChallenge).not.toHaveBeenCalled();
    }
  });
});

describe("createDepositChallenge", () => {
  it("deposits on the Gateway, crediting the agent address", async () => {
    const { service, ucw } = build({ ownerAllowanceMicros: 2_000_000n });

    const { challenge, agentAddress } = await service.createDepositChallenge("user-1", "token", "2");

    expect(challenge.step).toBe("deposit");
    expect(agentAddress).toBe(AGENT_ADDRESS);
    const sent = ucw.createContractExecutionChallenge.mock.calls[0]![0];
    expect(sent.contractAddress).toBe(GATEWAY);
    expect(sent.abiFunctionSignature).toBe("depositFor(address,address,uint256)");
    expect(sent.abiParameters).toEqual([USDC, AGENT_ADDRESS, "2000000"]);
  });

  it("credits the agent, never the owner", async () => {
    const { service, ucw } = build({ ownerAllowanceMicros: 2_000_000n });

    await service.createDepositChallenge("user-1", "token", "2");

    const sent = ucw.createContractExecutionChallenge.mock.calls[0]![0];
    expect(sent.abiParameters[1]).toBe(AGENT_ADDRESS);
    expect(sent.abiParameters[1]).not.toBe(OWNER_ADDRESS);
  });

  it("refuses until the approval is visible on-chain", async () => {
    // Circle reporting the approve challenge COMPLETE does not mean it is mined.
    const { service, ucw } = build({ ownerAllowanceMicros: 0n });

    await expect(service.createDepositChallenge("user-1", "token", "2")).rejects.toThrow(
      ConflictException
    );
    expect(ucw.createContractExecutionChallenge).not.toHaveBeenCalled();
  });

  it("refuses when the allowance is short of the requested amount", async () => {
    const { service } = build({ ownerAllowanceMicros: 1_999_999n });

    await expect(service.createDepositChallenge("user-1", "token", "2")).rejects.toThrow(
      ConflictException
    );
  });
});

describe("status", () => {
  it("reports live on-chain balances and allowance at full precision", async () => {
    const { service } = build({
      availableMicros: 2_000_000n,
      ownerUsdcMicros: 18_000_000n,
      ownerAllowanceMicros: 2_000_000n
    });

    await expect(service.status("user-1")).resolves.toMatchObject({
      address: AGENT_ADDRESS,
      ownerAddress: OWNER_ADDRESS,
      gatewayBalance: "$2.000000",
      ownerBalance: "$18.000000",
      allowance: "$2.000000"
    });
  });

  it("fails when the account has no Arc wallet", async () => {
    const { service, wallets } = build();
    wallets.findByUserId.mockResolvedValue(null as never);

    await expect(service.status("user-1")).rejects.toThrow(NotFoundException);
  });
});
