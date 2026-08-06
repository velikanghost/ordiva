import type { BatchEvmSigner } from "@circle-fin/x402-batching";
import type { Address, Hex } from "viem";

/**
 * The only signing capability Ordiva's buyer needs.
 *
 * Circle's batching SDK asks for exactly `{ address, signTypedData }` to produce an
 * EIP-3009 `TransferWithAuthorization` against the Gateway contract. Keeping that as
 * the seam means the custody decision — Circle developer-controlled wallet, or a
 * run-scoped local key — is a constructor argument rather than an architecture.
 */
export type ArcPaymentSigner = BatchEvmSigner;

export type TypedDataRequest = Parameters<ArcPaymentSigner["signTypedData"]>[0];

/**
 * Signing failed at the custody boundary.
 *
 * Raised instead of leaking provider-shaped errors, so callers can distinguish
 * "the wallet would not sign" from "the seller rejected the payment".
 */
export class ArcSignerError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "ArcSignerError";
  }
}

/**
 * Assert a signature is the 65-byte ECDSA shape Circle Gateway can recover.
 *
 * Smart-contract accounts return EIP-1271 blobs that satisfy neither `ecrecover`
 * nor Gateway's verifier. Failing here produces a legible error instead of an
 * opaque rejection from the facilitator several steps later.
 *
 * @param signature - Signature returned by the custody provider.
 * @param source - Human-readable signer name, used in the error message.
 */
export function assertEcdsaSignature(signature: string, source: string): Hex {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new ArcSignerError(
      `${source} returned a ${signature.length}-char signature; Arc x402 requires a 65-byte ECDSA signature. ` +
        "Confirm the wallet is an EOA — smart-contract accounts cannot sign EIP-3009 authorizations."
    );
  }
  return signature as Hex;
}

/**
 * Normalise an address to its checksum-insensitive comparison form.
 *
 * @param address - Any EVM address.
 */
export function normalizeAddress(address: string): Address {
  return address.toLowerCase() as Address;
}
