import { webcrypto } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type { AccountsConfig } from "../config.js";
import { AUTH_CONFIG } from "./auth.constants.js";

const loginStateSchema = z.object({
  kind: z.literal("login_state"),
  deviceId: z.string().min(1)
});

const sessionSchema = z.object({
  kind: z.literal("session"),
  sub: z.string().min(1),
  circleUserId: z.string().min(1)
});

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

export type SessionClaims = z.infer<typeof sessionSchema>;

@Injectable()
export class SessionTokenService {
  private readonly secret: Uint8Array;

  constructor(@Inject(AUTH_CONFIG) config: AccountsConfig) {
    this.secret = new TextEncoder().encode(config.AUTH_JWT_SECRET);
  }

  issueLoginState(deviceId: string): Promise<string> {
    return new SignJWT({ kind: "login_state", deviceId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("ordiva-api")
      .setAudience("ordiva-web")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(this.secret);
  }

  issueSession(userId: string, circleUserId: string): Promise<string> {
    return new SignJWT({ kind: "session", circleUserId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("ordiva-api")
      .setAudience("ordiva-web")
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.secret);
  }

  async verifyLoginState(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: "ordiva-api",
        audience: "ordiva-web",
        algorithms: ["HS256"]
      });
      return loginStateSchema.parse(payload);
    } catch {
      throw new UnauthorizedException("Login state is invalid or expired");
    }
  }

  async verifySession(token: string): Promise<SessionClaims> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: "ordiva-api",
        audience: "ordiva-web",
        algorithms: ["HS256"]
      });
      return sessionSchema.parse(payload);
    } catch {
      throw new UnauthorizedException("Session is invalid or expired");
    }
  }
}
