/**
 * LoaderCounter Component
 *
 * Animated counter that ramps to a target value with easing.
 * Features:
 * - Auto-duration based on target magnitude
 * - Locale-aware number formatting
 * - K/M/B shortening option
 * - Configurable prefix/suffix
 */
"use client";

import React from "react";

function formatNumber(n: number, locale?: string, useGrouping = true): string {
  return new Intl.NumberFormat(locale ?? undefined, { useGrouping }).format(n);
}

function shortenNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

interface LoaderCounterProps {
  /** Target value to count to */
  to: number;
  /** Animation duration in seconds, or "auto" for smart duration */
  durationSec?: number | "auto";
  /** Locale for number formatting, or "auto" for browser default */
  locale?: "auto" | string;
  /** Whether to format with thousand separators (default: true) */
  format?: boolean;
  /** Whether to shorten large numbers with K/M/B (default: false) */
  shorten?: boolean;
  /** Prefix to display before the number */
  prefix?: string;
  /** Suffix to display after the number */
  suffix?: string;
  /** Custom class for styling */
  className?: string;
}

export function LoaderCounter({
  to,
  durationSec = "auto",
  locale = "auto",
  format = true,
  shorten = false,
  prefix = "",
  suffix = "",
  className = "",
}: LoaderCounterProps) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    const start = performance.now();
    const target = Math.max(0, Math.floor(to));

    // Auto-calculate duration based on number magnitude
    const duration =
      durationSec === "auto"
        ? Math.min(2.2 + Math.log10(Math.max(10, target)) * 0.55, 6.5)
        : Math.max(0.2, durationSec);

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / (duration * 1000));
      // Organic ease-out with slight early acceleration
      const eased = 1 - Math.pow(1 - t, 3.2);
      const next = Math.floor(target * eased);
      setValue(next);

      if (t < 1) {
        requestAnimationFrame(tick);
      }
    }

    const frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [to, durationSec]);

  const displayValue = shorten
    ? shortenNumber(value)
    : format
      ? formatNumber(value, locale === "auto" ? undefined : locale)
      : String(value);

  return (
    <span aria-live="polite" className={`tabular-nums ${className}`}>
      {prefix && <span className="text-white/70">{prefix}</span>}
      <span className="text-white">{displayValue}</span>
      {suffix && <span className="text-white/70">{suffix}</span>}
    </span>
  );
}
