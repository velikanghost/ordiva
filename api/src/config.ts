import { z } from "zod";

export const ARC_TESTNET_CAIP2 = "eip155:5042002" as const;

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const priceSchema = z.string().regex(/^\$(?:0|[1-9]\d*)(?:\.\d{1,6})?$/);
const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());
const optionalSecret = z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional());

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  MONGODB_URI: optionalString,
  AUTH_JWT_SECRET: optionalSecret,
  CIRCLE_API_KEY: optionalString,
  CIRCLE_APP_ID: optionalString,
  OPENAI: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  CIRCLE_WALLETS_API_URL: optionalUrl.default("https://api.circle.com"),
  ARC_ADAPTER_SELLER_ADDRESS: addressSchema,
  CIRCLE_GATEWAY_FACILITATOR_URL: z.string().url().default("https://gateway-api-testnet.circle.com"),
  TAVILY_API_KEY: z.string().min(1).optional(),
  FIRECRAWL_API_KEY: z.string().min(1).optional(),
  APOLLO_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(3).optional(),
  EMAIL_ALLOWED_RECIPIENTS: z.string().default(""),
  EMAIL_ALLOWED_DOMAINS: z.string().default(""),
  PRICE_TAVILY_SEARCH: priceSchema.default("$0.01"),
  PRICE_FIRECRAWL_SEARCH: priceSchema.default("$0.02"),
  PRICE_FIRECRAWL_SCRAPE: priceSchema.default("$0.02"),
  PRICE_FIRECRAWL_CONTACT: priceSchema.default("$0.05"),
  PRICE_APOLLO_COMPANY: priceSchema.default("$0.03"),
  PRICE_RESEND_EMAIL: priceSchema.default("$0.01")
});

export type AppConfig = z.infer<typeof envSchema>;
export type AccountsConfig = AppConfig & Required<Pick<
  AppConfig,
  "MONGODB_URI" | "AUTH_JWT_SECRET" | "CIRCLE_API_KEY" | "CIRCLE_APP_ID"
>>;
export type SourcingConfig = AccountsConfig & Required<Pick<AppConfig, "OPENAI_API_KEY" | "FIRECRAWL_API_KEY">>;

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

export function sourcingConfigured(config: AppConfig): config is SourcingConfig {
  return accountsConfigured(config) && Boolean(config.OPENAI_API_KEY && config.FIRECRAWL_API_KEY);
}

export function commaSeparatedSet(value: string): ReadonlySet<string> {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}
