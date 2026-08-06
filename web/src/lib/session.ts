const SESSION_KEY = "ordiva.session.v1";

export interface OrdivaSession {
  token: string;
  email: string;
  wallet: {
    id: string;
    address: string;
    blockchain: "ARC-TESTNET";
    accountType: "EOA";
    state: string;
  };
  /**
   * Circle's short-lived material, needed to authorise wallet challenges such as
   * funding the agent.
   *
   * Held only by the browser and only in `sessionStorage`, never sent to or stored
   * by Ordiva's API beyond the single request that uses it. Circle expires these
   * after roughly an hour, after which funding prompts a fresh sign-in.
   */
  circleAuth?: {
    userToken: string;
    encryptionKey: string;
  };
}

export function saveSession(session: OrdivaSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readSession(): OrdivaSession | null {
  const value = sessionStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as OrdivaSession;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
