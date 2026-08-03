# Ordiva API

The NestJS package for Circle authentication, sourcing orchestration, MongoDB records, and Arc x402 adapters.

For the product narrative, architecture, payment model, route catalog, setup, environment variables, safety boundaries, and hackathon verification, see the [root README](../README.md).

## Structure

```text
api/
├── src/
│   ├── adapters/    Arc x402 routes and conventional API integrations
│   ├── auth/        Circle email OTP and Ordiva sessions
│   ├── sourcing/    OpenAI planning and supplier discovery
│   ├── users/       User persistence
│   ├── wallets/     One Arc EOA per user
│   ├── app.module.ts
│   ├── config.ts
│   └── main.ts
├── test/            API integration tests
├── .env.example
└── package.json
```

## Package commands

Run from the repository root:

```bash
pnpm dev:api
pnpm --filter @ordiva/api typecheck
pnpm --filter @ordiva/api test
pnpm --filter @ordiva/api build
```
