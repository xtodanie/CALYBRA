/**
 * ProgressBar Component
 *
 * Animated progress bar with optional milestones.
 * Features:
 * - Smooth width transitions
 * - Customizable colors via className
 * - Optional shimmer effect
 * - Segmented milestone mode
 */
"use client";

import React from "react";

interface ProgressBarProps {
  /** Current value */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Enable breathing shimmer effect */
  shimmer?: boolean;
  /** Custom height class (default: h-2) */
  heightClass?: string;
  /** Custom bar color class */
  barColorClass?: string;
  /** Custom background color class */
  bgColorClass?: string;
  /** Milestone values to show as segments */
  milestones?: number[];
  /** Custom className for container */
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  shimmer = false,
  heightClass = "h-2",
  barColorClass = "bg-purple-400/90",
  bgColorClass = "bg-white/10",
  milestones,
  className = "",
}: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div
      className={`relative w-full rounded-full ${bgColorClass} ring-1 ring-white/10 ${heightClass} ${className}`}
    >
      {/* Main progress bar */}
      <div
        className={`${heightClass} rounded-full ${barColorClass} transition-[width] duration-300 ease-out ${
          shimmer ? "animate-pulse" : ""
        }`}
        style={{ width: `${percentage}%` }}
      />

      {/* Shimmer overlay */}
      {shimmer && percentage > 0 && percentage < 100 && (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
          style={{ width: `${percentage}%` }}
        />
      )}

      {/* Milestone markers */}
      {milestones?.map((milestone) => {
        const pos = (milestone / max) * 100;
        if (pos <= 0 || pos >= 100) return null;
        return (
          <div
            key={milestone}
            className="absolute top-0 h-full w-0.5 bg-white/30"
            style={{ left: `${pos}%` }}
          />
        );
      })}
    </div>
  );
}
