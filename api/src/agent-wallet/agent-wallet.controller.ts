import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { SessionGuard } from "../auth/session.guard.js";
import { AgentFundingService } from "./agent-funding.service.js";
import { CircleUcwApiError } from "./circle-ucw.client.js";

const fundSchema = z
  .object({
    circleUserToken: z.string().min(1),
    amount: z.string().trim().min(1)
  })
  .strict();

@Controller("v1/agent-wallet")
@UseGuards(SessionGuard)
export class AgentWalletController {
  constructor(@Inject(AgentFundingService) private readonly funding: AgentFundingService) {}

  @Get()
  status(@Req() request: Request) {
    return this.funding.status(this.userId(request));
  }

  /**
   * Step 1: permit the Gateway to move USDC out of the owner's wallet.
   *
   * Split from the deposit because the approval must be *mined* before a deposit
   * can pull against it — a single call cannot guarantee that ordering.
   */
  @Post("fund/approve")
  @HttpCode(HttpStatus.OK)
  approve(@Req() request: Request, @Body() body: unknown) {
    const input = this.parseFund(body);
    return this.guardCircle(() =>
      this.funding.createApproveChallenge(this.userId(request), input.circleUserToken, input.amount)
    );
  }

  /** Step 2: move the approved USDC into the agent's Gateway balance. */
  @Post("fund/deposit")
  @HttpCode(HttpStatus.OK)
  deposit(@Req() request: Request, @Body() body: unknown) {
    const input = this.parseFund(body);
    return this.guardCircle(() =>
      this.funding.createDepositChallenge(this.userId(request), input.circleUserToken, input.amount)
    );
  }

  private parseFund(body: unknown) {
    const parsed = fundSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid_input", issues: parsed.error.issues });
    }
    return parsed.data;
  }

  /**
   * Translate an expired Circle token into a re-auth signal.
   *
   * Expiry is routine — Circle user tokens last about an hour — so the browser is
   * told to sign in again rather than shown an opaque upstream error.
   *
   * @param run - The Circle-touching operation to guard.
   */
  private async guardCircle<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof CircleUcwApiError && error.requiresReauth) {
        throw new UnauthorizedException({
          error: "circle_reauth_required",
          message: "Your Circle session expired. Sign in again to authorise funding."
        });
      }
      throw error;
    }
  }

  /**
   * Resolve the caller from the verified session.
   *
   * Funding always targets the authenticated user's own agent wallet — the owner is
   * never taken from the request body.
   *
   * @param request - Guarded request carrying verified session claims.
   */
  private userId(request: Request): string {
    if (!request.auth) throw new UnauthorizedException("Missing authenticated session");
    return request.auth.sub;
  }
}
