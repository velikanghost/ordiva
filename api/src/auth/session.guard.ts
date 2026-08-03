import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { SessionTokenService } from "./session-token.service.js";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SessionTokenService) private readonly tokens: SessionTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) throw new UnauthorizedException("Missing bearer session");
    request.auth = await this.tokens.verifySession(authorization.slice("Bearer ".length));
    return true;
  }
}
