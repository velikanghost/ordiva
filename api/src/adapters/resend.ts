import { z } from "zod";
import type { AppConfig } from "../config.js";
import { commaSeparatedSet } from "../config.js";
import { requestJson } from "./http.js";
import type { AdapterDefinition } from "./types.js";
import { PreflightError } from "./types.js";

const inputSchema = z.object({
  to: z.string().trim().toLowerCase().email(),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(10_000),
  idempotencyKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9._/-]+$/)
});

const outputSchema = z.object({
  messageId: z.string(),
  to: z.string().email(),
  accepted: z.literal(true)
});

const rawSchema = z.object({ id: z.string().min(1) }).passthrough();

export function resendAdapter(config: AppConfig): AdapterDefinition<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> {
  const allowedRecipients = commaSeparatedSet(config.EMAIL_ALLOWED_RECIPIENTS);
  const allowedDomains = commaSeparatedSet(config.EMAIL_ALLOWED_DOMAINS);

  return {
    id: "resend-email",
    operator: "ordiva",
    upstreamProvider: "Resend",
    capability: "email_send",
    description: "Send one idempotent plain-text RFQ email to the tested demo allowlist.",
    method: "POST",
    path: "/v1/email/resend-send",
    price: config.PRICE_RESEND_EMAIL,
    inputSchema,
    outputSchema,
    configured: Boolean(config.RESEND_API_KEY && config.RESEND_FROM_EMAIL && (allowedRecipients.size || allowedDomains.size)),
    preflight(input) {
      const domain = input.to.split("@")[1];
      if (!allowedRecipients.has(input.to) && (!domain || !allowedDomains.has(domain))) {
        throw new PreflightError("Recipient is not on the tested email allowlist");
      }
    },
    async execute(input, context) {
      const raw = await requestJson("Resend", "https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${context.config.RESEND_API_KEY}`,
          "content-type": "application/json",
          "idempotency-key": input.idempotencyKey
        },
        body: JSON.stringify({
          from: context.config.RESEND_FROM_EMAIL,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          tags: [{ name: "source", value: "ordiva_arc_adapter" }]
        })
      }, context.fetch);
      const parsed = rawSchema.parse(raw);
      return { messageId: parsed.id, to: input.to, accepted: true as const };
    }
  };
}
