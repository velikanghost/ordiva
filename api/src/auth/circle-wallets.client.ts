import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import type { AccountsConfig } from "../config.js";
import { AUTH_CONFIG, AUTH_FETCH } from "./auth.constants.js";

const deviceTokensSchema = z.object({
  data: z.object({
    deviceToken: z.string().min(1),
    deviceEncryptionKey: z.string().min(1),
    otpToken: z.string().min(1)
  })
});

const circleUserSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    status: z.string()
  }).passthrough()
});

const circleWalletSchema = z.object({
  id: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  blockchain: z.string(),
  accountType: z.string(),
  state: z.string()
}).passthrough();

const circleWalletsSchema = z.object({
  data: z.object({ wallets: z.array(circleWalletSchema).default([]) })
});

const challengeSchema = z.object({
  data: z.object({ challengeId: z.string().min(1) })
});

const circleErrorSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  error: z.string().optional(),
  message: z.string().optional()
}).passthrough();

export type CircleWallet = z.infer<typeof circleWalletSchema>;

export class CircleWalletsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | string | undefined,
    message: string
  ) {
    super(message);
    this.name = "CircleWalletsApiError";
  }
}

@Injectable()
export class CircleWalletsClient {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AccountsConfig,
    @Inject(AUTH_FETCH) private readonly fetchImpl: typeof fetch
  ) {}

  async startEmailOtp(email: string, deviceId: string) {
    const raw = await this.request("/v1/w3s/users/email/token", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: randomUUID(), email, deviceId })
    });
    return deviceTokensSchema.parse(raw).data;
  }

  async getUser(userToken: string) {
    const raw = await this.request("/v1/w3s/user", { method: "GET" }, userToken);
    return circleUserSchema.parse(raw).data;
  }

  async listWallets(userToken: string): Promise<CircleWallet[]> {
    const raw = await this.request("/v1/w3s/wallets?pageSize=50", { method: "GET" }, userToken);
    return circleWalletsSchema.parse(raw).data.wallets;
  }

  async initializeArcEoa(userToken: string, refId: string): Promise<string> {
    const raw = await this.request("/v1/w3s/user/initialize", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        accountType: "EOA",
        blockchains: ["ARC-TESTNET"],
        metadata: [{ name: "Ordiva Arc wallet", refId }]
      })
    }, userToken);
    return challengeSchema.parse(raw).data.challengeId;
  }

  async createArcEoa(userToken: string, refId: string): Promise<string> {
    const raw = await this.request("/v1/w3s/user/wallets", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        accountType: "EOA",
        blockchains: ["ARC-TESTNET"],
        metadata: [{ name: "Ordiva Arc wallet", refId }]
      })
    }, userToken);
    return challengeSchema.parse(raw).data.challengeId;
  }

  private async request(path: string, init: RequestInit, userToken?: string): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.config.CIRCLE_API_KEY}`);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    if (userToken) headers.set("x-user-token", userToken);

    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, this.config.CIRCLE_WALLETS_API_URL), {
        ...init,
        headers,
        signal: AbortSignal.timeout(30_000)
      });
    } catch (error) {
      throw new CircleWalletsApiError(
        0,
        undefined,
        error instanceof Error ? error.message : "Circle Wallets request failed"
      );
    }

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new CircleWalletsApiError(response.status, undefined, "Circle Wallets returned non-JSON data");
    }

    if (!response.ok) {
      const parsed = circleErrorSchema.safeParse(body);
      throw new CircleWalletsApiError(
        response.status,
        parsed.success ? parsed.data.code : undefined,
        parsed.success
          ? parsed.data.message ?? parsed.data.error ?? `Circle Wallets returned HTTP ${response.status}`
          : `Circle Wallets returned HTTP ${response.status}`
      );
    }

    return body;
  }
}
