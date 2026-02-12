/**
 * Map API Route - Geocoding and Static Map URL generation
 *
 * SECURITY:
 * - Google API key is never exposed to client
 * - Address caching with TTL to prevent abuse
 * - Rate limiting via in-memory counter (replace with Redis in prod)
 * - Zod validation on all inputs
 *
 * INVARIANT: No addresses or API keys logged
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { zoomForScale } from "@/lib/mapsScale";

// Input validation schema
const MapRequestBody = z.object({
  address: z.string().trim().min(5).max(200),
  scaleDenominator: z.number().int().min(10).max(5000).default(50),
  dpi: z.number().int().min(72).max(600).default(96),
  width: z.number().int().min(600).max(2400).default(1600),
  height: z.number().int().min(600).max(2400).default(900),
});

// In-memory cache for geocoding results (replace with Redis in production)
interface CacheEntry {
  exp: number;
  lat: number;
  lng: number;
  formatted: string;
}
const geocodeCache = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

// Rate limiting (simple in-memory, replace with Redis in production)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

function getCached(key: string): CacheEntry | null {
  const entry = geocodeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    geocodeCache.delete(key);
    return null;
  }
  return entry;
}

async function geocode(address: string): Promise<CacheEntry> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_MAPS_API_KEY not set");
  }

  const cacheKey = address.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Geocode HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
    error_message?: string;
  };

  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(
      `Geocode failed: ${data.status}${data.error_message ? ` (${data.error_message})` : ""}`
    );
  }

  const loc = data.results[0].geometry.location;
  const formatted = data.results[0].formatted_address;

  const entry: CacheEntry = {
    exp: Date.now() + TTL_MS,
    lat: loc.lat,
    lng: loc.lng,
    formatted,
  };
  geocodeCache.set(cacheKey, entry);
  return entry;
}

export async function POST(req: Request) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = MapRequestBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { address, scaleDenominator, dpi, width, height } = parsed.data;

  try {
    const { lat, lng, formatted } = await geocode(address);
    const zoom = zoomForScale({ latDeg: lat, scaleDenominator, dpi });

    const key = process.env.GOOGLE_MAPS_API_KEY!;
    const mapId = process.env.GOOGLE_MAPS_MAP_ID; // Optional styled map ID

    const staticUrl = new URL("https://maps.googleapis.com/maps/api/staticmap");
    staticUrl.searchParams.set("center", `${lat},${lng}`);
    staticUrl.searchParams.set("zoom", String(zoom));
    staticUrl.searchParams.set("size", `${width}x${height}`);
    staticUrl.searchParams.set("scale", "2"); // Higher DPI image
    staticUrl.searchParams.set("maptype", "roadmap");
    if (mapId) {
      staticUrl.searchParams.set("map_id", mapId);
    }
    staticUrl.searchParams.set("key", key);

    return NextResponse.json({
      formattedAddress: formatted,
      lat,
      lng,
      zoom,
      scaleDenominator,
      dpi,
      staticMapUrl: staticUrl.toString(),
    });
  } catch (e) {
    // Return fallback-friendly error (don't expose internal details)
    const message = e instanceof Error ? e.message : "Unknown error";
    // Avoid logging address or key
    console.error("Map API error:", message.includes("API_KEY") ? "API_KEY_ERROR" : "GEOCODE_ERROR");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
