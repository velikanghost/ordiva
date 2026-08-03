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
