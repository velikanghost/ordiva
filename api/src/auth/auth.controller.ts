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
  UseFilters,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { AuthExceptionFilter } from "./auth-exception.filter.js";
import { AuthService } from "./auth.service.js";
import { SessionGuard } from "./session.guard.js";

const startSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  deviceId: z.string().uuid()
});

const sessionSchema = z.object({
  state: z.string().min(1),
  circleUserToken: z.string().min(1)
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ error: "invalid_input", issues: parsed.error.issues });
  }
  return parsed.data;
}

@Controller("v1/auth")
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get("config")
  config() {
    return this.auth.publicConfig();
  }

  @Post("email/start")
  @HttpCode(HttpStatus.OK)
  startEmail(@Body() body: unknown) {
    const input = parseBody(startSchema, body);
    return this.auth.startEmailLogin(input.email, input.deviceId);
  }

  @Post("session")
  @HttpCode(HttpStatus.OK)
  session(@Body() body: unknown) {
    const input = parseBody(sessionSchema, body);
    return this.auth.completeSession(input.state, input.circleUserToken);
  }

  @Get("me")
  @UseGuards(SessionGuard)
  me(@Req() request: Request) {
    if (!request.auth) throw new UnauthorizedException("Missing authenticated session");
    return this.auth.me(request.auth);
  }
}
