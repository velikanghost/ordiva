/**
 * One-time Circle setup: create the wallet set that holds Ordiva's agent wallets.
 *
 * A wallet set is the container every developer-controlled wallet belongs to. Ordiva needs
 * exactly one; its id goes into `CIRCLE_WALLET_SET_ID`.
 *
 * Run with:  pnpm --filter @ordiva/api exec tsx scripts/create-wallet-set.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const ENV_PATH = resolve(process.cwd(), ".env");
const WALLET_SET_NAME = "Ordiva Agent Wallet Set";

function readEnvValue(key: string): string | undefined {
  if (!existsSync(ENV_PATH)) return undefined;
  const line = readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${key}=`));
  const value = line?.slice(key.length + 1).trim();
  return value ? value : undefined;
}

async function main(): Promise<void> {
  const apiKey = readEnvValue("CIRCLE_API_KEY");
  const entitySecret = readEnvValue("CIRCLE_ENTITY_SECRET");

  if (!apiKey) throw new Error("CIRCLE_API_KEY is required in api/.env");
  if (!entitySecret) {
    throw new Error("CIRCLE_ENTITY_SECRET is required in api/.env — run register-entity-secret first");
  }

  if (readEnvValue("CIRCLE_WALLET_SET_ID")) {
    throw new Error("CIRCLE_WALLET_SET_ID is already set in api/.env. Refusing to create a second set.");
  }

  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  console.log(`Creating wallet set "${WALLET_SET_NAME}"...`);
  const response = await client.createWalletSet({ name: WALLET_SET_NAME });

  const walletSet = response.data?.walletSet;
  if (!walletSet?.id) throw new Error("Circle returned no wallet set id");

  console.log("\n=== Wallet set created ===\n");
  console.log("Add this line to api/.env:\n");
  console.log(`CIRCLE_WALLET_SET_ID=${walletSet.id}\n`);
  console.log(`  name:    ${walletSet.name}`);
  console.log(`  custody: ${walletSet.custodyType}`);
}

main().catch((error: unknown) => {
  const detail =
    error && typeof error === "object" && "response" in error
      ? JSON.stringify((error as { response?: { data?: unknown } }).response?.data)
      : error instanceof Error
        ? error.message
        : String(error);
  console.error("\nFailed to create wallet set:", detail);
  process.exit(1);
});
