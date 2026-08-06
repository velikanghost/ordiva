"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useThemeStore } from "@/lib/theme-store";

export function ThemeToggle() {
  const { hydrated, theme, hydrate, toggleTheme } = useThemeStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="grid size-10 place-items-center rounded-[10px] border border-line text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
    >
      {isDark ? (
        <Sun aria-hidden="true" className="size-4 text-violet" />
      ) : (
        <Moon aria-hidden="true" className="size-4 text-ink" />
      )}
    </button>
  );
}
