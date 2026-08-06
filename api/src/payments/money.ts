/**
 * USDC amounts are handled exclusively as integer micros (6 decimals).
 *
 * Floating point is never used for money in Ordiva: a budget gate that is off by
 * a rounding error is a budget gate that does not hold.
 */

const USDC_DECIMALS = 6;
const MICROS_PER_USDC = 1_000_000n;

/** Matches `$1.23`, `1.23`, `0`, `2` — at most 6 fractional digits. */
const USDC_PATTERN = /^\$?(0|[1-9]\d*)(?:\.(\d{1,6}))?$/;

/**
 * Parse a USDC amount string into integer micros.
 *
 * @param value - Amount such as `"$0.02"`, `"2"`, or `"1.500000"`.
 * @throws Error when the value is malformed or carries sub-micro precision.
 */
export function toMicros(value: string): bigint {
  const match = USDC_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(
      `Invalid USDC amount: "${value}". Expected up to ${USDC_DECIMALS} decimal places, e.g. "$0.01".`
    );
  }

  const [, whole = "0", fraction = ""] = match;
  return BigInt(whole) * MICROS_PER_USDC + BigInt(fraction.padEnd(USDC_DECIMALS, "0"));
}

/**
 * Render integer micros as a `$`-prefixed decimal string.
 *
 * @param micros - Amount in integer micros.
 */
export function formatUsdc(micros: bigint): string {
  if (micros < 0n) throw new Error(`USDC amounts cannot be negative: ${micros}`);

  const whole = micros / MICROS_PER_USDC;
  const fraction = (micros % MICROS_PER_USDC).toString().padStart(USDC_DECIMALS, "0");
  return `$${whole}.${fraction.slice(0, 2)}`;
}

/**
 * Render integer micros at full precision, for receipts and ledger rows where
 * sub-cent amounts must remain visible.
 *
 * @param micros - Amount in integer micros.
 */
export function formatUsdcExact(micros: bigint): string {
  if (micros < 0n) throw new Error(`USDC amounts cannot be negative: ${micros}`);

  const whole = micros / MICROS_PER_USDC;
  const fraction = (micros % MICROS_PER_USDC).toString().padStart(USDC_DECIMALS, "0");
  return `$${whole}.${fraction}`;
}
