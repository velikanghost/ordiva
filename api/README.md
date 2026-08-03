# Ordiva API

This NestJS API resells conventional API calls behind Circle Gateway nanopayments on Arc Testnet. It is deliberately explicit about the boundary:

- the buyer is the user's own Circle agent wallet and its backing Arc EOA;
- the seller is the Ordiva adapter wallet;
- `upstreamProvider` identifies the conventional API that actually fulfills the request;
- missing credentials, invalid input, unsafe scrape URLs, and disallowed email recipients are rejected before the payment middleware.

## Authentication routes

| Route | Purpose |
|---|---|
| `GET /v1/auth/config` | Public Circle App ID and required Arc wallet type |
| `POST /v1/auth/email/start` | Start Circle's email-OTP Web SDK flow |
| `POST /v1/auth/session` | Validate a Circle user token, sync/create one Arc EOA, and issue an Ordiva session |
| `GET /v1/auth/me` | Return the authenticated Ordiva user and wallet |

These routes are enabled when `MONGODB_URI`, `AUTH_JWT_SECRET`, `CIRCLE_API_KEY`, and `CIRCLE_APP_ID` are configured. OTP entry and wallet challenge execution happen in Circle's Web SDK. The API does not receive or persist an OTP, Circle key material, or Circle session secrets.

## Routes

| Route | Capability | Upstream |
|---|---|---|
| `POST /v1/suppliers/tavily-search` | Supplier search | Tavily |
| `POST /v1/suppliers/firecrawl-search` | Supplier search | Firecrawl |
| `POST /v1/evidence/firecrawl-scrape` | Company evidence | Firecrawl |
| `POST /v1/company/apollo-enrich` | Company evidence | Apollo |
| `POST /v1/contacts/firecrawl-extract` | Public contact discovery | Firecrawl |
| `POST /v1/email/resend-send` | Allowlisted outbound email | Resend |

`GET /v1/catalog` is free and returns configuration status, prices, and JSON Schemas. Paid responses include the Arc payment receipt, normalized data, latency, and a SHA-256 response hash.

## Run locally

```bash
cp api/.env.example api/.env
pnpm install
pnpm dev:api
```

From the repository root, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` before committing changes. The reviewed MVP structure and module boundaries are recorded in [`docs/architecture.md`](../docs/architecture.md).

The email adapter requires either `EMAIL_ALLOWED_RECIPIENTS` or `EMAIL_ALLOWED_DOMAINS`. Resend's idempotency key is mandatory, preventing a paid retry from sending the same RFQ twice.

## Payment behavior

Production uses `createGatewayMiddleware` with the accepted network restricted to `eip155:5042002`. Every unavailable or malformed request fails before `gateway.require(...)`. An upstream can still fail after payment; that failure is returned as a structured `upstream_failed` response and should be recorded by the buyer agent as a provider miss.
