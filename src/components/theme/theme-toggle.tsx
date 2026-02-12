"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import { useT } from "@/i18n/provider";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const t = useT();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? t.theme.toggleToLight : t.theme.toggleToDark}
      className="transition-all duration-200 hover:scale-[1.02]"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">{isDark ? t.theme.toggleToLight : t.theme.toggleToDark}</span>
    </Button>
  );
}
