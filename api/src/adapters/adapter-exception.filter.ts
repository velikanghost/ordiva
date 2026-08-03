import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { UpstreamError } from "./http.js";

function paymentReceipt(request: Request) {
  return request.payment
    ? {
        verified: request.payment.verified,
        payer: request.payment.payer,
        amountBaseUnits: request.payment.amount,
        network: request.payment.network,
        settlementId: request.payment.transaction ?? null
      }
    : null;
}

@Catch(UpstreamError, ZodError)
export class AdapterExceptionFilter implements ExceptionFilter {
  catch(error: UpstreamError | ZodError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (error instanceof UpstreamError) {
      response.status(502).json({
        error: "upstream_failed",
        provider: error.provider,
        upstreamStatus: error.status || null,
        retryable: error.retryable,
        message: error.message,
        payment: paymentReceipt(request)
      });
      return;
    }

    response.status(502).json({
      error: "invalid_upstream_response",
      issues: error.issues,
      payment: paymentReceipt(request)
    });
  }
}
