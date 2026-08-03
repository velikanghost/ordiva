import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard.js";
import { createSourcingRunSchema } from "./sourcing.schemas.js";
import { SourcingService } from "./sourcing.service.js";

@Controller("/v1/runs")
@UseGuards(SessionGuard)
export class SourcingController {
  constructor(@Inject(SourcingService) private readonly sourcing: SourcingService) {}

  @Post("plan")
  plan(@Req() request: Request, @Body() body: unknown) {
    if (!request.auth) throw new UnauthorizedException("Missing authenticated user");
    const input = createSourcingRunSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Provide a valid goal, USDC budget, and a minimum of three suppliers");
    }
    return this.sourcing.plan(request.auth.sub, input.data);
  }
}
