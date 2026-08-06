import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem";
import { ArcSignerError } from "../src/payments/arc-signer.js";
import { CircleDcwSigner } from "../src/payments/circle-dcw.signer.js";

const WALLET_ID = "639d59fa-9175-5a9f-aa8b-77fde8af1ba4";
const ADDRESS = "0x64e0a7eaedf276923d915cd8c336d1f1663b3d5a" as const;

/** Typed data shaped exactly as `BatchEvmScheme` produces it — note: no EIP712Domain. */
const typedData = {
  domain: {
    name: "GatewayWallet",
    version: "1",
    chainId: 5042002,
    verifyingContract: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const
  },
  types: {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  },
  primaryType: "TransferWithAuthorization" as const,
  message: {
    from: ADDRESS,
    to: "0x1111111111111111111111111111111111111111",
    value: "10000",
    validAfter: "0",
    validBefore: "2000000000",
    nonce: `0x${"11".repeat(32)}`
  }
};

const VALID_SIGNATURE = `0x${"ab".repeat(65)}`;

describe("CircleDcwSigner", () => {
  it("injects EIP712Domain, which Circle requires but viem-shaped callers omit", async () => {
    const circle = {
      signTypedData: vi.fn().mockResolvedValue({ data: { signature: VALID_SIGNATURE } })
    };
    const signer = new CircleDcwSigner(ADDRESS, WALLET_ID, circle);

    await signer.signTypedData(typedData);

    const sent = JSON.parse(circle.signTypedData.mock.calls[0]![0].data);
    expect(sent.types.EIP712Domain).toEqual([
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" }
    ]);
    // The caller's own types must survive alongside it.
    expect(sent.types.TransferWithAuthorization).toHaveLength(6);
    expect(sent.primaryType).toBe("TransferWithAuthorization");
  });

  it("does not mutate the caller's typed data", async () => {
    const circle = {
      signTypedData: vi.fn().mockResolvedValue({ data: { signature: VALID_SIGNATURE } })
    };
    await new CircleDcwSigner(ADDRESS, WALLET_ID, circle).signTypedData(typedData);

    expect(typedData.types).not.toHaveProperty("EIP712Domain");
  });

  it("serialises bigint uint256 fields, which BatchEvmScheme supplies natively", async () => {
    const circle = {
      signTypedData: vi.fn().mockResolvedValue({ data: { signature: VALID_SIGNATURE } })
    };
    const signer = new CircleDcwSigner(ADDRESS, WALLET_ID, circle);

    // JSON.stringify throws outright on bigint; without a replacer this never
    // reaches Circle and the payment silently fails to sign.
    await signer.signTypedData({
      ...typedData,
      message: { ...typedData.message, value: 10_000n, validAfter: 0n, validBefore: 2_000_000_000n }
    } as never);

    const sent = JSON.parse(circle.signTypedData.mock.calls[0]![0].data);
    expect(sent.message.value).toBe("10000");
    expect(sent.message.validAfter).toBe("0");
    expect(sent.message.validBefore).toBe("2000000000");
  });

  it("targets the wallet it was constructed with", async () => {
    const circle = {
      signTypedData: vi.fn().mockResolvedValue({ data: { signature: VALID_SIGNATURE } })
    };
    await new CircleDcwSigner(ADDRESS, WALLET_ID, circle).signTypedData(typedData);

    expect(circle.signTypedData.mock.calls[0]![0].walletId).toBe(WALLET_ID);
  });

  it("rejects an EIP-1271 blob from a smart-contract account", async () => {
    const circle = {
      signTypedData: vi.fn().mockResolvedValue({ data: { signature: `0x${"cd".repeat(200)}` } })
    };
    const signer = new CircleDcwSigner(ADDRESS, WALLET_ID, circle);

    await expect(signer.signTypedData(typedData)).rejects.toThrow(ArcSignerError);
    await expect(signer.signTypedData(typedData)).rejects.toThrow(/must be an EOA|65-byte ECDSA/);
  });

  it("surfaces a Circle refusal as an ArcSignerError", async () => {
    const circle = {
      signTypedData: vi.fn().mockRejectedValue(new Error("entity secret is invalid"))
    };
    const signer = new CircleDcwSigner(ADDRESS, WALLET_ID, circle);

    await expect(signer.signTypedData(typedData)).rejects.toThrow(ArcSignerError);
  });

  it("fails loudly when Circle returns no signature", async () => {
    const circle = { signTypedData: vi.fn().mockResolvedValue({ data: {} }) };
    const signer = new CircleDcwSigner(ADDRESS, WALLET_ID, circle);

    await expect(signer.signTypedData(typedData)).rejects.toThrow(/no signature/);
  });

  it("produces a signature that recovers to the wallet address", async () => {
    // Stands in for Circle with a real key, proving the payload the signer forwards
    // is a valid EIP-712 message and not merely well-shaped.
    const account = privateKeyToAccount(`0x${"7".repeat(64)}`);
    const circle = {
      signTypedData: async ({ data }: { data: string }) => {
        const parsed = JSON.parse(data);
        // viem infers the domain type and rejects an explicit EIP712Domain entry.
        const types = { ...parsed.types };
        delete types.EIP712Domain;
        return { data: { signature: await account.signTypedData({ ...parsed, types }) } };
      }
    };

    const signer = new CircleDcwSigner(account.address, WALLET_ID, circle);
    const signature = await signer.signTypedData({ ...typedData, message: { ...typedData.message, from: account.address } });

    const recovered = await recoverTypedDataAddress({
      ...typedData,
      message: { ...typedData.message, from: account.address },
      signature
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });
});
