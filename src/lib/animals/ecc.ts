export const ECC_MIN = 1.0;
export const ECC_MAX = 5.0;
export const ECC_STEP = 0.25;

/**
 * Validate that a numeric ECC value is within the allowed range.
 * Returns true if value >= ECC_MIN && value <= ECC_MAX.
 */
export function validateEcc(value: number): boolean {
  return typeof value === 'number' && value >= ECC_MIN && value <= ECC_MAX;
}

/**
 * Normalize the value to the nearest valid step.
 * Rounds to the nearest step based on ECC_STEP; if the resulting value falls outside the allowed ECC range, the original invalid value is returned unchanged.
 */
export function normalizeEcc(value: number): number {
  // Round to nearest valid step without clamping out-of-range values
  const steps = Math.round((value - ECC_MIN) / ECC_STEP);
  const normalized = ECC_MIN + steps * ECC_STEP;
  // If the normalized value falls outside the allowed range, retain the original invalid value
  if (normalized < ECC_MIN || normalized > ECC_MAX) {
    return value;
  }
  return normalized;
}

/**
 * Verify that the value respects the step size.
 * Returns true if (value - ECC_MIN) is an exact multiple of ECC_STEP.
 * Allows a tiny floating‑point tolerance.
 */
export function isValidEccStep(value: number): boolean {
  const diff = value - ECC_MIN;
  const remainder = Math.abs(diff % ECC_STEP);
  const tolerance = 1e-9;
  return remainder < tolerance || Math.abs(remainder - ECC_STEP) < tolerance;
}
