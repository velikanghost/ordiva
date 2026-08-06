export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = body.message;
    if (Array.isArray(message)) return message.map(String).join(" ");
    if (typeof message === "string" && message.trim()) return message;
  }
  return `Request failed with status ${status}`;
}

/**
 * Call a session-guarded endpoint with the Ordiva bearer token attached.
 *
 * @param path - API path below `/api/backend`.
 * @param token - The Ordiva session token.
 * @param init - Standard fetch options.
 */
export async function apiAuthJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(path, {
    ...init,
    headers: { ...init?.headers, authorization: `Bearer ${token}` },
  });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new ApiError(errorMessage(body, response.status), response.status, body);
  }
  return body as T;
}
