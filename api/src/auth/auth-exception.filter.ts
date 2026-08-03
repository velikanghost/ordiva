import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";
import { CircleWalletsApiError } from "./circle-wallets.client.js";

@Catch(CircleWalletsApiError, ZodError)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(error: CircleWalletsApiError | ZodError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (error instanceof CircleWalletsApiError) {
      response.status(error.status === 401 ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_GATEWAY).json({
        error: "circle_wallets_failed",
        upstreamStatus: error.status || null,
        circleCode: error.code ?? null,
        message: error.message
      });
      return;
    }

    response.status(HttpStatus.BAD_GATEWAY).json({
      error: "invalid_circle_response",
      issues: error.issues
    });
  }
}
