"use client";

import { create } from "zustand";

const THEME_KEY = "ordiva.theme.v1";

export type Theme = "light" | "dark";

interface ThemeState {
  hydrated: boolean;
  theme: Theme;
  hydrate: () => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  hydrated: false,
  theme: "light",
  hydrate: () => {
    const current = readTheme();
    applyTheme(current);
    set({ hydrated: true, theme: current });
  },
  toggleTheme: () => {
    const nextTheme: Theme = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
    set({ theme: nextTheme });
  },
  setTheme: (nextTheme) => {
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
    set({ theme: nextTheme });
  },
}));
