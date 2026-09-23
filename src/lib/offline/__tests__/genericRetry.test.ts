import { describe, expect, it } from "vitest";
import {
  calculateGenericRetryAt,
  GENERIC_RETRY_MAX_MS,
  parseRetryAfter,
} from "../genericRetry";

describe("generic retry policy", () => {
  it("aplica jitter determinístico limitado e cap de cinco minutos", () => {
    expect(
      calculateGenericRetryAt({ retryCount: 1, nowMs: 1_000, randomValue: 0 }),
    ).toBe(5_000);
    expect(
      calculateGenericRetryAt({
        retryCount: 20,
        nowMs: 1_000,
        randomValue: 1,
      }),
    ).toBe(1_000 + GENERIC_RETRY_MAX_MS);
  });

  it("descarta Retry-After inválido ou passado", () => {
    const now = Date.parse("2026-09-22T12:00:00.000Z");
    expect(parseRetryAfter("invalid", now)).toBeUndefined();
    expect(parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT", now)).toBeUndefined();
  });
});
