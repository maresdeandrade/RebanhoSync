import { expect, test } from 'vitest';
import { validateEcc, normalizeEcc, isValidEccStep, ECC_MIN, ECC_MAX, ECC_STEP } from '@/lib/animals/ecc';

// Helper to generate a value within the range using steps
function makeValidStepValue(stepMultiplier: number): number {
  return ECC_MIN + stepMultiplier * ECC_STEP;
}

test('validateEcc returns true for values within range and false otherwise', () => {
  expect(validateEcc(ECC_MIN)).toBe(true);
  expect(validateEcc(ECC_MAX)).toBe(true);
  expect(validateEcc((ECC_MIN + ECC_MAX) / 2)).toBe(true);
  expect(validateEcc(ECC_MIN - 0.01)).toBe(false);
  expect(validateEcc(ECC_MAX + 0.01)).toBe(false);
});

test('normalizeEcc does not clamp invalid values and rounds valid steps', () => {
  // Values below min should remain unchanged (invalid)
  const below = ECC_MIN - 5;
  expect(normalizeEcc(below)).toBe(below);
  // Values above max should remain unchanged (invalid)
  const above = ECC_MAX + 10;
  expect(normalizeEcc(above)).toBe(above);
  // Valid step value should round to nearest step
  const valid = ECC_MIN + ECC_STEP * 4; // 2.0
  expect(normalizeEcc(valid)).toBeCloseTo(valid);
  // Near valid but not exact step should round to nearest valid step within range
  const near = ECC_MIN + 1.1; // e.g., 2.1
  const normalized = normalizeEcc(near);
  expect(isValidEccStep(normalized) && normalized >= ECC_MIN && normalized <= ECC_MAX).toBe(true);
});

test('isValidEccStep correctly identifies step alignment', () => {
  // Valid step values
  for (let i = 0; i <= (ECC_MAX - ECC_MIN) / ECC_STEP; i++) {
    const val = makeValidStepValue(i);
    expect(isValidEccStep(val)).toBe(true);
  }
  // Invalid step value (half step)
  const invalid = ECC_MIN + ECC_STEP / 2;
  expect(isValidEccStep(invalid)).toBe(false);
});
