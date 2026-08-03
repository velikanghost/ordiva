import type { SessionClaims } from "./auth/session-token.service.js";

declare global {
  namespace Express {
    interface Request {
      auth?: SessionClaims;
      payment?: {
        verified: boolean;
        payer: string;
        amount: string;
        network: string;
        transaction?: string;
      };
    }
  }
}

export {};
