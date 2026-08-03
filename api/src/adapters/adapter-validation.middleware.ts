import type { RequestHandler } from "express";
import type { AdapterDefinition } from "./types.js";
import { PreflightError } from "./types.js";

export function adapterValidationMiddleware(adapter: AdapterDefinition<unknown, unknown>): RequestHandler {
  return (request, response, next) => {
    if (!adapter.configured) {
      response.status(503).json({
        error: "adapter_unavailable",
        adapter: adapter.id,
        message: `${adapter.upstreamProvider} live execution or required configuration is unavailable; no payment was requested.`
      });
      return;
    }

    const parsed = adapter.inputSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid_input",
        adapter: adapter.id,
        issues: parsed.error.issues
      });
      return;
    }

    try {
      adapter.preflight?.(parsed.data);
    } catch (error) {
      if (error instanceof PreflightError) {
        response.status(403).json({
          error: "preflight_rejected",
          adapter: adapter.id,
          message: error.message
        });
        return;
      }
      next(error);
      return;
    }

    request.body = parsed.data;
    next();
  };
}
