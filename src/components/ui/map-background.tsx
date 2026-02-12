/**
 * MapBackground Component
 *
 * Full-screen map background with brand overlay styling.
 * Uses CSS layers for:
 * - Dark overlay
 * - Subtle blur
 * - Purple gradient
 * - Noise texture (CSS-based)
 */
"use client";

import React from "react";

// SVG noise pattern as data URL (avoids need for external image)
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

interface MapBackgroundProps {
  /** Static map URL or null for fallback */
  url: string | null;
  /** Custom overlay opacity (default: 0.55) */
  overlayOpacity?: number;
  /** Custom blur amount (default: 2px) */
  blurAmount?: number;
}

export function MapBackground({
  url,
  overlayOpacity = 0.55,
  blurAmount = 2,
}: MapBackgroundProps) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Map image or fallback */}
      {url ? (
        // Using <img> intentionally for external Google Maps URLs
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          loading="eager"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-neutral-950 via-purple-950/30 to-neutral-950" />
      )}

      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: overlayOpacity }}
      />

      {/* Subtle blur */}
      <div
        className="absolute inset-0"
        style={{ backdropFilter: `blur(${blurAmount}px)` }}
      />

      {/* Purple gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-transparent to-black/60" />

      {/* Noise texture (SVG-based) */}
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{ backgroundImage: NOISE_SVG }}
      />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,black_100%)] opacity-40" />
    </div>
  );
}
