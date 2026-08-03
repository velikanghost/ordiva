import { randomUUID } from "node:crypto";
import { ConflictException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_CONFIG, AUTH_FETCH } from "../src/auth/auth.constants.js";
import { AuthController } from "../src/auth/auth.controller.js";
import { AuthService } from "../src/auth/auth.service.js";
import { CircleWalletsClient } from "../src/auth/circle-wallets.client.js";
import { SessionGuard } from "../src/auth/session.guard.js";
import { SessionTokenService } from "../src/auth/session-token.service.js";
import type { AccountsConfig } from "../src/config.js";
import { UsersService, type UserView } from "../src/users/users.service.js";
import { WalletsService, type WalletView } from "../src/wallets/wallets.service.js";

const openApps: INestApplication[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function config(): AccountsConfig {
  return {
    PORT: 4100,
    ORDIVA_UPSTREAM_MODE: "live",
    MONGODB_URI: "mongodb://127.0.0.1:27017/ordiva-test",
    AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
    CIRCLE_API_KEY: "circle-test-key",
    CIRCLE_APP_ID: "circle-app-id",
    CIRCLE_WALLETS_API_URL: "https://api.circle.com",
    ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111",
    CIRCLE_GATEWAY_FACILITATOR_URL: "https://gateway-api-testnet.circle.com",
    EMAIL_ALLOWED_RECIPIENTS: "",
    EMAIL_ALLOWED_DOMAINS: "",
    PRICE_TAVILY_SEARCH: "$0.01",
    PRICE_FIRECRAWL_SEARCH: "$0.02",
    PRICE_FIRECRAWL_SCRAPE: "$0.02",
    PRICE_FIRECRAWL_CONTACT: "$0.05",
    PRICE_APOLLO_COMPANY: "$0.03",
    PRICE_RESEND_EMAIL: "$0.01"
  };
}

const user: UserView = {
  id: "user-1",
  circleUserId: "circle-user-1",
  status: "active"
};

const wallet: WalletView = {
  userId: user.id,
  id: "circle-wallet-1",
  address: "0x2222222222222222222222222222222222222222",
  blockchain: "ARC-TESTNET",
  accountType: "EOA",
  state: "LIVE"
};

function usersMock() {
  return {
    upsertVerifiedIdentity: vi.fn().mockResolvedValue(user),
    getById: vi.fn().mockResolvedValue(user)
  };
}

function walletsMock() {
  return {
    syncOneForUser: vi.fn().mockResolvedValue(wallet),
    findByUserId: vi.fn().mockResolvedValue(wallet)
  };
}

async function createAuthApp(fetchMock: typeof fetch, users = usersMock(), wallets = walletsMock()) {
  const testingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AUTH_CONFIG, useValue: config() },
      { provide: AUTH_FETCH, useValue: fetchMock },
      { provide: UsersService, useValue: users },
      { provide: WalletsService, useValue: wallets },
      CircleWalletsClient,
      SessionTokenService,
      SessionGuard,
      AuthService
    ]
  }).compile();
  const app = testingModule.createNestApplication();
  await app.init();
  openApps.push(app);
  return { app, testingModule, users, wallets };
}

function circleResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  }));
}

describe("Circle email authentication", () => {
  it("starts Circle email OTP without handling the OTP itself", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(await circleResponse({
      data: {
        deviceToken: "device-token",
        deviceEncryptionKey: "device-encryption-key",
        otpToken: "otp-token"
      }
    }));
    const { app } = await createAuthApp(fetchMock);
    const deviceId = randomUUID();

    const response = await request(app.getHttpServer())
      .post("/v1/auth/email/start")
      .send({ email: "BUYER@example.com", deviceId })
      .expect(200);

    expect(response.body).toMatchObject({
      deviceToken: "device-token",
      deviceEncryptionKey: "device-encryption-key",
      otpToken: "otp-token"
    });
    expect(response.body.state).toEqual(expect.any(String));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.circle.com/v1/w3s/users/email/token");
    expect(JSON.parse(String(init?.body))).toMatchObject({ email: "buyer@example.com", deviceId });
  });

  it("creates an Ordiva session and syncs one existing Arc EOA", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(await circleResponse({ data: { id: user.circleUserId, status: "ENABLED" } }))
      .mockResolvedValueOnce(await circleResponse({ data: { wallets: [{
        id: wallet.id,
        address: wallet.address,
        blockchain: "ARC-TESTNET",
        accountType: "EOA",
        state: "LIVE"
      }] } }));
    const setup = await createAuthApp(fetchMock);
    const tokenService = setup.testingModule.get(SessionTokenService);
    const state = await tokenService.issueLoginState(randomUUID());

    const session = await request(setup.app.getHttpServer())
      .post("/v1/auth/session")
      .send({ state, circleUserToken: "circle-user-token" })
      .expect(200);

    expect(session.body.user).toEqual(user);
    expect(session.body.wallet).toEqual(wallet);
    expect(session.body.walletAction).toEqual({ required: false });
    expect(setup.wallets.syncOneForUser).toHaveBeenCalledOnce();

    const me = await request(setup.app.getHttpServer())
      .get("/v1/auth/me")
      .set("authorization", `Bearer ${session.body.sessionToken}`)
      .expect(200);
    expect(me.body).toEqual({ user, wallet });
  });

  it("requests an Arc EOA creation challenge when the user has no Arc wallet", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(await circleResponse({ data: { id: user.circleUserId, status: "ENABLED" } }))
      .mockResolvedValueOnce(await circleResponse({ data: { wallets: [] } }))
      .mockResolvedValueOnce(await circleResponse({ data: { challengeId: "challenge-1" } }));
    const setup = await createAuthApp(fetchMock);
    const state = await setup.testingModule.get(SessionTokenService).issueLoginState(randomUUID());

    const response = await request(setup.app.getHttpServer())
      .post("/v1/auth/session")
      .send({ state, circleUserToken: "circle-user-token" })
      .expect(200);

    expect(response.body.wallet).toBeNull();
    expect(response.body.walletAction).toEqual({
      required: true,
      challengeId: "challenge-1",
      accountType: "EOA",
      blockchain: "ARC-TESTNET"
    });
    const [, init] = fetchMock.mock.calls[2] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      accountType: "EOA",
      blockchains: ["ARC-TESTNET"]
    });
  });

  it("uses wallet creation when the Circle user was already initialized", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(await circleResponse({ data: { id: user.circleUserId, status: "ENABLED" } }))
      .mockResolvedValueOnce(await circleResponse({ data: { wallets: [] } }))
      .mockResolvedValueOnce(await circleResponse({ code: 155106, message: "already initialized" }, 400))
      .mockResolvedValueOnce(await circleResponse({ data: { challengeId: "challenge-2" } }));
    const setup = await createAuthApp(fetchMock);
    const state = await setup.testingModule.get(SessionTokenService).issueLoginState(randomUUID());

    const response = await request(setup.app.getHttpServer())
      .post("/v1/auth/session")
      .send({ state, circleUserToken: "circle-user-token" })
      .expect(200);

    expect(response.body.walletAction.challengeId).toBe("challenge-2");
    expect(String(fetchMock.mock.calls[3]?.[0])).toBe("https://api.circle.com/v1/w3s/user/wallets");
  });

  it("rejects an existing Arc SCA instead of silently creating a second wallet", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(await circleResponse({ data: { id: user.circleUserId, status: "ENABLED" } }))
      .mockResolvedValueOnce(await circleResponse({ data: { wallets: [{
        id: "sca-wallet",
        address: wallet.address,
        blockchain: "ARC-TESTNET",
        accountType: "SCA",
        state: "LIVE"
      }] } }));
    const setup = await createAuthApp(fetchMock);
    const state = await setup.testingModule.get(SessionTokenService).issueLoginState(randomUUID());

    const response = await request(setup.app.getHttpServer())
      .post("/v1/auth/session")
      .send({ state, circleUserToken: "circle-user-token" })
      .expect(409);

    expect(response.body.message).toContain("Gateway nanopayments require an EOA");
    expect(setup.wallets.syncOneForUser).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("one-wallet persistence rule", () => {
  it("rejects replacing a user's registered Circle wallet", async () => {
    const model = {
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ circleWalletId: "wallet-existing" })
      }),
      findOneAndUpdate: vi.fn()
    };
    const service = new WalletsService(model as never);

    await expect(service.syncOneForUser("user-1", {
      id: "wallet-different",
      address: wallet.address,
      blockchain: "ARC-TESTNET",
      accountType: "EOA",
      state: "LIVE"
    })).rejects.toBeInstanceOf(ConflictException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
