/**
 * AddressMapController Component
 *
 * Address input form that fetches geocode data and map URL from server.
 * Handles loading states, validation, and error display.
 */
"use client";

import React from "react";
import { z } from "zod";

const AddressSchema = z.object({
  address: z.string().trim().min(5).max(200),
});

export interface MapResponse {
  formattedAddress: string;
  lat: number;
  lng: number;
  zoom: number;
  scaleDenominator: number;
  dpi: number;
  staticMapUrl: string;
}

interface AddressMapControllerProps {
  /** Callback when map data is received or cleared */
  onMap: (url: string | null, meta?: MapResponse) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Button text */
  buttonText?: string;
  /** Loading button text */
  loadingText?: string;
  /** Custom scale denominator (default: 50 for 1:50) */
  scaleDenominator?: number;
}

export function AddressMapController({
  onMap,
  placeholder = "Enter venue address (e.g., Calle Gran Vía 12, Madrid)",
  buttonText = "Set",
  loadingText = "Loading…",
  scaleDenominator = 50,
}: AddressMapControllerProps) {
  const [address, setAddress] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = AddressSchema.safeParse({ address });
    if (!parsed.success) {
      setError("Enter a valid address (minimum 5 characters).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: parsed.data.address,
          scaleDenominator,
          dpi: 96,
          width: 1600,
          height: 900,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as MapResponse;
      onMap(data.staticMapUrl, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      onMap(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-xl bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none ring-1 ring-white/10 transition-all focus:ring-2 focus:ring-purple-400/50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-purple-500/90 px-6 py-3 font-medium text-white transition-all hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? loadingText : buttonText}
        </button>
      </div>
      {error && (
        <div className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </form>
  );
}
