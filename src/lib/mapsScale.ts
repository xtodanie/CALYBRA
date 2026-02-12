/**
 * Google Maps scale → zoom conversion utilities
 *
 * INVARIANT: Pure math - no side effects
 * INVARIANT: Deterministic - same inputs produce same outputs
 */

const EARTH_RADIUS_M = 6378137;

/**
 * Calculate meters per pixel at a given latitude and zoom level
 */
function metersPerPixel(latDeg: number, zoom: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  return (Math.cos(latRad) * 2 * Math.PI * EARTH_RADIUS_M) / (256 * Math.pow(2, zoom));
}

/**
 * Calculate zoom level for a given map scale (1:N)
 *
 * Scale 1:N means: 1 physical inch on screen represents N inches in reality.
 * Formula: N = metersPerPixel * DPI / 0.0254
 *
 * @param latDeg - Latitude in degrees
 * @param scaleDenominator - Target scale denominator (e.g., 50 for 1:50)
 * @param dpi - Screen DPI (default: 96)
 * @param minZoom - Minimum zoom level (default: 0)
 * @param maxZoom - Maximum zoom level (default: 21)
 * @returns Best matching zoom level
 */
export function zoomForScale({
  latDeg,
  scaleDenominator,
  dpi = 96,
  minZoom = 0,
  maxZoom = 21,
}: {
  latDeg: number;
  scaleDenominator: number;
  dpi?: number;
  minZoom?: number;
  maxZoom?: number;
}): number {
  // Validate inputs
  if (scaleDenominator <= 0) {
    throw new Error("scaleDenominator must be positive");
  }
  if (dpi <= 0) {
    throw new Error("dpi must be positive");
  }

  // Search for the zoom level that best matches the target scale
  let bestZoom = minZoom;
  let bestErr = Number.POSITIVE_INFINITY;

  for (let z = minZoom; z <= maxZoom; z++) {
    const mpp = metersPerPixel(latDeg, z);
    const computedN = (mpp * dpi) / 0.0254;
    const err = Math.abs(computedN - scaleDenominator);
    if (err < bestErr) {
      bestErr = err;
      bestZoom = z;
    }
  }

  return bestZoom;
}

/**
 * Calculate the scale denominator at a given zoom level
 *
 * @param latDeg - Latitude in degrees
 * @param zoom - Zoom level
 * @param dpi - Screen DPI (default: 96)
 * @returns Scale denominator (N in 1:N)
 */
export function scaleForZoom({
  latDeg,
  zoom,
  dpi = 96,
}: {
  latDeg: number;
  zoom: number;
  dpi?: number;
}): number {
  const mpp = metersPerPixel(latDeg, zoom);
  return (mpp * dpi) / 0.0254;
}
