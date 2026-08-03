"use client";

import { create } from "zustand";
import { clearSession, readSession, saveSession, type OrdivaSession } from "@/lib/session";

interface SessionState {
  hydrated: boolean;
  session: OrdivaSession | null;
  hydrate: () => void;
  acceptSession: (session: OrdivaSession) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  hydrated: false,
  session: null,
  hydrate: () => set({ hydrated: true, session: readSession() }),
  acceptSession: (session) => {
    saveSession(session);
    set({ hydrated: true, session });
  },
  signOut: () => {
    clearSession();
    set({ hydrated: true, session: null });
  },
}));
