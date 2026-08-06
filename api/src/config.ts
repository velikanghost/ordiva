import { z } from "zod";

export const ARC_TESTNET_CAIP2 = "eip155:5042002" as const;

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const priceSchema = z.string().regex(/^\$(?:0|[1-9]\d*)(?:\.\d{1,6})?$/);
const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());
const optionalSecret = z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional());

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  ORDIVA_UPSTREAM_MODE: z.enum(["disabled", "live"]).default("disabled"),
  MONGODB_URI: optionalString,
  AUTH_JWT_SECRET: optionalSecret,
  CIRCLE_API_KEY: optionalString,
  CIRCLE_APP_ID: optionalString,
  OPENAI: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  CIRCLE_WALLETS_API_URL: optionalUrl.default("https://api.circle.com"),
  CIRCLE_ENTITY_SECRET: optionalString,
  CIRCLE_WALLET_SET_ID: optionalString,
  ARC_RPC_URL: optionalUrl.default("https://rpc.testnet.arc.network"),
  /** Where the API reaches its own paid adapter routes when the agent buys evidence. */
  ORDIVA_SELF_URL: optionalUrl.default("http://127.0.0.1:4100"),
  USDC_ADDRESS: addressSchema.default("0x3600000000000000000000000000000000000000"),
  GATEWAY_WALLET_ADDRESS: addressSchema.default("0x0077777d7EBA4688BDeF3E311b846F25870A19B9"),
  ARC_ADAPTER_SELLER_ADDRESS: addressSchema,
  CIRCLE_GATEWAY_FACILITATOR_URL: z.string().url().default("https://gateway-api-testnet.circle.com"),
  TAVILY_API_KEY: z.string().min(1).optional(),
  FIRECRAWL_API_KEY: z.string().min(1).optional(),
  APOLLO_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(3).optional(),
  EMAIL_ALLOWED_RECIPIENTS: z.string().default(""),
  EMAIL_ALLOWED_DOMAINS: z.string().default(""),
  // Per-action prices are held at or below $0.01: the point of a nanopayment rail
  // is that an individual service call can cost a fraction of a cent.
  PRICE_TAVILY_SEARCH: priceSchema.default("$0.01"),
  PRICE_FIRECRAWL_SEARCH: priceSchema.default("$0.01"),
  PRICE_FIRECRAWL_SCRAPE: priceSchema.default("$0.005"),
  PRICE_FIRECRAWL_CONTACT: priceSchema.default("$0.01"),
  PRICE_APOLLO_COMPANY: priceSchema.default("$0.0075"),
  PRICE_RESEND_EMAIL: priceSchema.default("$0.01")
});

export type AppConfig = z.infer<typeof envSchema>;
export type AccountsConfig = AppConfig & Required<Pick<
  AppConfig,
  "MONGODB_URI" | "AUTH_JWT_SECRET" | "CIRCLE_API_KEY" | "CIRCLE_APP_ID"
>>;
export type AgentWalletConfig = AccountsConfig &
  Required<Pick<AppConfig, "CIRCLE_ENTITY_SECRET" | "CIRCLE_WALLET_SET_ID">>;
/**
 * Sourcing now includes the paid verification stage, so it needs an agent wallet.
 * A run that cannot buy evidence is the incomplete product this work replaced.
 */
export type SourcingConfig = AgentWalletConfig &
  Required<Pick<AppConfig, "OPENAI_API_KEY" | "FIRECRAWL_API_KEY">>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = envSchema.parse(env);
  return {
    ...config,
    OPENAI_API_KEY: config.OPENAI_API_KEY ?? config.OPENAI
  };
}

export function accountsConfigured(config: AppConfig): config is AccountsConfig {
  return Boolean(config.MONGODB_URI && config.AUTH_JWT_SECRET && config.CIRCLE_API_KEY && config.CIRCLE_APP_ID);
}

export function agentWalletConfigured(config: AppConfig): config is AgentWalletConfig {
  return accountsConfigured(config) && Boolean(config.CIRCLE_ENTITY_SECRET && config.CIRCLE_WALLET_SET_ID);
}

export function sourcingConfigured(config: AppConfig): config is SourcingConfig {
  return agentWalletConfigured(config) && Boolean(config.OPENAI_API_KEY && config.FIRECRAWL_API_KEY);
}

export function commaSeparatedSet(value: string): ReadonlySet<string> {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}
