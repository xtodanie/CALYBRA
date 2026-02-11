/**
 * Rounding helpers
 * Pure functions. No IO, no randomness, no time.
 */

export function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const decimal = value - floor;

  if (decimal < 0.5) return floor;
  if (decimal > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}
