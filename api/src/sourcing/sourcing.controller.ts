import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard.js";
import { RunsService } from "./runs.service.js";
import { createSourcingRunSchema } from "./sourcing.schemas.js";
import { SourcingService } from "./sourcing.service.js";
import { VerificationService } from "./verification.service.js";

@Controller("/v1/runs")
@UseGuards(SessionGuard)
export class SourcingController {
  constructor(
    @Inject(SourcingService) private readonly sourcing: SourcingService,
    @Inject(RunsService) private readonly runs: RunsService,
    @Inject(VerificationService) private readonly verification: VerificationService
  ) {}

  @Post("plan")
  plan(@Req() request: Request, @Body() body: unknown) {
    const input = createSourcingRunSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Provide a valid goal, USDC budget, and a minimum of three suppliers");
    }
    return this.sourcing.planAndPersist(this.userId(request), input.data);
  }

  @Get()
  list(@Req() request: Request) {
    return this.runs.listForUser(this.userId(request));
  }

  @Get(":runId")
  get(@Req() request: Request, @Param("runId") runId: string) {
    return this.runs.view(runId, this.userId(request));
  }

  /**
   * Start buying evidence for every candidate in the run.
   *
   * The only human involvement is this request. Each purchase after it is
   * authorised by deterministic policy against the budget already granted.
   *
   * Returns as soon as the work is scheduled — a run takes far longer than any
   * proxy will hold a connection. Poll `GET /v1/runs/:runId` for progress.
   */
  @Post(":runId/verify")
  @HttpCode(HttpStatus.ACCEPTED)
  verify(@Req() request: Request, @Param("runId") runId: string) {
    return this.verification.startVerification(runId, this.userId(request));
  }

  private userId(request: Request): string {
    if (!request.auth) throw new UnauthorizedException("Missing authenticated user");
    return request.auth.sub;
  }
}
