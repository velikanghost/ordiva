import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AccountsConfig } from "../config.js";
import { UsersService } from "../users/users.service.js";
import type { CircleArcWallet } from "../wallets/wallets.service.js";
import { WalletsService } from "../wallets/wallets.service.js";
import { AUTH_CONFIG } from "./auth.constants.js";
import { CircleWalletsApiError, CircleWalletsClient, type CircleWallet } from "./circle-wallets.client.js";
import { SessionTokenService, type SessionClaims } from "./session-token.service.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AccountsConfig,
    @Inject(CircleWalletsClient) private readonly circle: CircleWalletsClient,
    @Inject(SessionTokenService) private readonly tokens: SessionTokenService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(WalletsService) private readonly wallets: WalletsService
  ) {}

  publicConfig() {
    return {
      appId: this.config.CIRCLE_APP_ID,
      blockchain: "ARC-TESTNET" as const,
      accountType: "EOA" as const
    };
  }

  async startEmailLogin(email: string, deviceId: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const [circleTokens, state] = await Promise.all([
      this.circle.startEmailOtp(normalizedEmail, deviceId),
      this.tokens.issueLoginState(deviceId, normalizedEmail)
    ]);

    return {
      state,
      ...circleTokens
    };
  }

  async completeSession(state: string, circleUserToken: string) {
    const login = await this.tokens.verifyLoginState(state);
    const circleUser = await this.circle.getUser(circleUserToken);
    if (circleUser.status !== "ENABLED") throw new UnauthorizedException("Circle user is not enabled");

    const user = await this.users.upsertVerifiedIdentity(circleUser.id, login.email);
    const circleWallets = await this.circle.listWallets(circleUserToken);
    const arcWallets = circleWallets.filter((wallet) => wallet.blockchain === "ARC-TESTNET");

    if (arcWallets.length > 1) {
      throw new ConflictException("Circle returned more than one Arc wallet for this user");
    }

    let wallet = null;
    let challengeId: string | null = null;
    const existing = arcWallets[0];

    if (existing) {
      const normalized = this.normalizeArcEoa(existing);
      wallet = await this.wallets.syncOneForUser(user.id, normalized);
    } else {
      challengeId = await this.createWalletChallenge(circleUserToken, user.id);
    }

    return {
      sessionToken: await this.tokens.issueSession(user.id, user.circleUserId, user.email),
      user,
      wallet,
      walletAction: challengeId
        ? { required: true as const, challengeId, accountType: "EOA" as const, blockchain: "ARC-TESTNET" as const }
        : { required: false as const }
    };
  }

  async me(session: SessionClaims) {
    const [user, wallet] = await Promise.all([
      this.users.getById(session.sub),
      this.wallets.findByUserId(session.sub)
    ]);
    if (user.circleUserId !== session.circleUserId) throw new UnauthorizedException("Session user mismatch");
    if (user.email !== session.email) throw new UnauthorizedException("Session email mismatch");
    return { user, wallet };
  }

  async finalizeWallet(session: SessionClaims, circleUserToken: string) {
    const circleUser = await this.circle.getUser(circleUserToken);
    if (circleUser.status !== "ENABLED") throw new UnauthorizedException("Circle user is not enabled");
    if (circleUser.id !== session.circleUserId) throw new UnauthorizedException("Circle user does not match session");

    const circleWallets = await this.circle.listWallets(circleUserToken);
    const arcWallets = circleWallets.filter((wallet) => wallet.blockchain === "ARC-TESTNET");
    if (arcWallets.length > 1) {
      throw new ConflictException("Circle returned more than one Arc wallet for this user");
    }

    const existing = arcWallets[0];
    if (!existing) return { wallet: null };

    return {
      wallet: await this.wallets.syncOneForUser(session.sub, this.normalizeArcEoa(existing))
    };
  }

  private normalizeArcEoa(wallet: CircleWallet): CircleArcWallet {
    if (wallet.accountType !== "EOA") {
      throw new ConflictException(
        "The existing Arc wallet is not an EOA; Gateway nanopayments require an EOA"
      );
    }
    return {
      id: wallet.id,
      address: wallet.address,
      blockchain: "ARC-TESTNET",
      accountType: "EOA",
      state: wallet.state
    };
  }

  private async createWalletChallenge(circleUserToken: string, userId: string): Promise<string> {
    try {
      return await this.circle.initializeArcEoa(circleUserToken, userId);
    } catch (error) {
      if (error instanceof CircleWalletsApiError && String(error.code) === "155106") {
        return this.circle.createArcEoa(circleUserToken, userId);
      }
      throw error;
    }
  }
}
