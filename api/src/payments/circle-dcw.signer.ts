import type { Address } from "viem";
import { assertEcdsaSignature, ArcSignerError, type ArcPaymentSigner, type TypedDataRequest } from "./arc-signer.js";

/** The subset of Circle's SDK this signer needs, kept narrow so tests can fake it. */
export interface CircleTypedDataSigner {
  signTypedData(params: {
    walletId: string;
    data: string;
  }): Promise<{ data?: { signature?: string } }>;
}

/**
 * EIP-712 domain field list.
 *
 * Circle's `signTypedData` requires `EIP712Domain` to be present in `types`, but
 * viem-derived callers — including Circle's own `BatchEvmScheme` — omit it by
 * convention because viem infers it. Forwarding the payload unchanged makes Circle
 * reject the request, so the signer re-inserts the entry it expects.
 */
const EIP712_DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" }
] as const;

/**
 * JSON replacer that renders `bigint` as a decimal string.
 *
 * EIP-3009 amounts and timestamps arrive as `bigint` from `BatchEvmScheme`, and
 * `JSON.stringify` throws on them outright. Circle expects uint256 fields as
 * strings anyway, so this is the correct wire form rather than a workaround.
 *
 * @param _key - Property name (unused).
 * @param value - Property value.
 */
function bigintToString(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/**
 * Signs Arc x402 payment authorisations with a Circle developer-controlled wallet.
 *
 * The wallet must be an **EOA**: EIP-3009 `TransferWithAuthorization` is verified by
 * `ecrecover`, which a smart-contract account cannot satisfy.
 */
export class CircleDcwSigner implements ArcPaymentSigner {
  constructor(
    readonly address: Address,
    private readonly walletId: string,
    private readonly circle: CircleTypedDataSigner
  ) {}

  /**
   * Produce an ECDSA signature over EIP-712 typed data.
   *
   * @param params - Domain, types, primary type, and message to sign.
   * @throws ArcSignerError when Circle refuses or returns a non-ECDSA signature.
   */
  signTypedData = async (params: TypedDataRequest) => {
    const payload = {
      ...params,
      types: { EIP712Domain: EIP712_DOMAIN_TYPE, ...params.types }
    };

    let data: string;
    try {
      data = JSON.stringify(payload, bigintToString);
    } catch (error) {
      throw new ArcSignerError("Could not serialise the payment authorisation.", error);
    }

    let signature: string | undefined;
    try {
      const response = await this.circle.signTypedData({ walletId: this.walletId, data });
      signature = response.data?.signature;
    } catch (error) {
      throw new ArcSignerError(
        `Circle refused to sign the payment authorisation for wallet ${this.walletId}.`,
        error
      );
    }

    if (!signature) {
      throw new ArcSignerError(`Circle returned no signature for wallet ${this.walletId}.`);
    }

    return assertEcdsaSignature(signature, "Circle developer-controlled wallet");
  };
}
