/**
 * One-time Circle setup: register an entity secret for Ordiva's Circle developer account.
 *
 * The entity secret authorises every developer-controlled wallet operation. Circle stores
 * only an RSA-encrypted ciphertext of it; the plaintext exists solely in `api/.env`, and the
 * recovery file — downloadable exactly once, here — is the only way back if that is lost.
 * Losing both permanently disables developer-controlled wallets for the account, with no
 * recovery path. Ordiva has already lost one account this way.
 *
 * Run with:  pnpm --filter @ordiva/api exec tsx scripts/register-entity-secret.ts
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

const RECOVERY_DIR = resolve(process.cwd(), "recovery");
const ENV_PATH = resolve(process.cwd(), ".env");

function readEnvValue(key: string): string | undefined {
  if (!existsSync(ENV_PATH)) return undefined;
  const line = readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${key}=`));
  const value = line?.slice(key.length + 1).trim();
  return value ? value : undefined;
}

async function main(): Promise<void> {
  const apiKey = readEnvValue("CIRCLE_API_KEY") ?? process.env.CIRCLE_API_KEY;
  if (!apiKey) throw new Error("CIRCLE_API_KEY is required in api/.env");

  if (readEnvValue("CIRCLE_ENTITY_SECRET")) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET is already set in api/.env. Refusing to register a second secret — " +
        "rotating requires the existing secret or its recovery file."
    );
  }

  const entitySecret = randomBytes(32).toString("hex");
  mkdirSync(RECOVERY_DIR, { recursive: true });

  console.log("Registering a new entity secret with Circle...");
  await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: RECOVERY_DIR
  });

  const written = readdirSync(RECOVERY_DIR).filter((name) => name.endsWith(".dat"));

  console.log("\n=== Registered successfully ===\n");
  console.log("Add this line to api/.env — it is stored nowhere else:\n");
  console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}\n`);
  console.log(`Recovery file: ${RECOVERY_DIR}/${written.at(-1) ?? "(none written!)"}`);
  console.log("\nBack up BOTH, outside this repo. Losing them bricks the account.");
}

main().catch((error: unknown) => {
  const detail =
    error && typeof error === "object" && "response" in error
      ? JSON.stringify((error as { response?: { data?: unknown } }).response?.data)
      : error instanceof Error
        ? error.message
        : String(error);
  console.error("\nFailed to register entity secret:", detail);
  process.exit(1);
});
