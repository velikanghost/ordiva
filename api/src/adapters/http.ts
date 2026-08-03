import { z } from "zod";

export class UpstreamError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

const errorBodySchema = z.object({
  error: z.union([z.string(), z.object({ message: z.string().optional() }).passthrough()]).optional(),
  message: z.string().optional()
}).passthrough();

export async function requestJson(
  provider: string,
  url: string | URL,
  init: RequestInit,
  fetchImpl: typeof fetch,
  timeoutMs = 30_000
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new UpstreamError(
      provider,
      0,
      true,
      error instanceof Error ? error.message : "Upstream request failed"
    );
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new UpstreamError(provider, response.status, response.status >= 500, "Upstream returned non-JSON data");
    }
  }

  if (!response.ok) {
    const parsed = errorBodySchema.safeParse(body);
    const upstreamMessage = parsed.success
      ? parsed.data.message ??
        (typeof parsed.data.error === "string" ? parsed.data.error : parsed.data.error?.message)
      : undefined;
    throw new UpstreamError(
      provider,
      response.status,
      response.status === 429 || response.status >= 500,
      upstreamMessage ?? `Upstream returned HTTP ${response.status}`
    );
  }

  return body;
}
