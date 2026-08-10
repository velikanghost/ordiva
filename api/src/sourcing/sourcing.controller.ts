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
import { OutreachService } from "./outreach.service.js";
import { z } from "zod";

const outreachUpdateSchema = z.object({
  recipient: z.string().trim().toLowerCase().email(),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(10_000)
}).strict();
const outreachApprovalSchema = z.object({ contentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

@Controller("/v1/runs")
@UseGuards(SessionGuard)
export class SourcingController {
  constructor(
    @Inject(SourcingService) private readonly sourcing: SourcingService,
    @Inject(RunsService) private readonly runs: RunsService,
    @Inject(VerificationService) private readonly verification: VerificationService,
    @Inject(OutreachService) private readonly outreach: OutreachService
  ) {}

  @Post("plan")
  async plan(@Req() request: Request, @Body() body: unknown) {
    const input = createSourcingRunSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Provide a valid goal, USDC budget, and a minimum of three suppliers");
    }
    const userId = this.userId(request);
    const run = await this.sourcing.planAndPersist(userId, input.data);
    return this.verification.startVerification(run.id, userId);
  }

  @Get()
  list(@Req() request: Request) {
    return this.runs.listForUser(this.userId(request));
  }

  @Get(":runId")
  get(@Req() request: Request, @Param("runId") runId: string) {
    return this.runs.view(runId, this.userId(request));
  }

  /** Explicit recovery hook; normal run creation starts verification automatically. */
  @Post(":runId/verify")
  @HttpCode(HttpStatus.ACCEPTED)
  verify(@Req() request: Request, @Param("runId") runId: string) {
    return this.verification.startVerification(runId, this.userId(request));
  }

  @Post(":runId/outreach/drafts")
  createOutreachDrafts(@Req() request: Request, @Param("runId") runId: string) {
    return this.outreach.createDrafts(runId, this.userId(request));
  }

  @Post(":runId/outreach/:outreachId")
  updateOutreach(
    @Req() request: Request,
    @Param("runId") runId: string,
    @Param("outreachId") outreachId: string,
    @Body() body: unknown
  ) {
    const input = outreachUpdateSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Provide a valid recipient, subject, and message");
    return this.outreach.updateDraft(runId, outreachId, this.userId(request), input.data);
  }

  @Post(":runId/outreach/:outreachId/approve")
  approveOutreach(
    @Req() request: Request,
    @Param("runId") runId: string,
    @Param("outreachId") outreachId: string,
    @Body() body: unknown
  ) {
    const input = outreachApprovalSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Approve the current outreach content hash");
    return this.outreach.approve(runId, outreachId, this.userId(request), input.data.contentHash);
  }

  @Post(":runId/outreach/:outreachId/send")
  @HttpCode(HttpStatus.ACCEPTED)
  sendOutreach(
    @Req() request: Request,
    @Param("runId") runId: string,
    @Param("outreachId") outreachId: string
  ) {
    return this.outreach.send(runId, outreachId, this.userId(request));
  }

  @Post(":runId/outreach/:outreachId/send-test")
  sendTestOutreach(
    @Req() request: Request,
    @Param("runId") runId: string,
    @Param("outreachId") outreachId: string
  ) {
    if (!request.auth) throw new UnauthorizedException("Missing authenticated user");
    return this.outreach.sendTest(runId, outreachId, request.auth.sub, request.auth.email);
  }

  private userId(request: Request): string {
    if (!request.auth) throw new UnauthorizedException("Missing authenticated user");
    return request.auth.sub;
  }
}
