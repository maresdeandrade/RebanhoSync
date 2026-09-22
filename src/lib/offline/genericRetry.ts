export const GENERIC_RETRY_BASE_MS = 5_000;
export const GENERIC_RETRY_MAX_MS = 5 * 60_000;

const MIN_JITTER_FACTOR = 0.8;
const JITTER_SPREAD = 0.4;

export function parseRetryAfter(
  value: string | null,
  nowMs = Date.now(),
): number | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds) && seconds >= 0) {
      const retryAt = nowMs + seconds * 1_000;
      return retryAt > nowMs ? retryAt : undefined;
    }
  }

  const parsedDate = Date.parse(trimmed);
  return Number.isFinite(parsedDate) && parsedDate > nowMs
    ? parsedDate
    : undefined;
}

export function calculateGenericRetryAt({
  retryCount,
  nowMs = Date.now(),
  randomValue = Math.random(),
  retryAfterAt,
}: {
  retryCount: number;
  nowMs?: number;
  randomValue?: number;
  retryAfterAt?: number;
}): number {
  const exponent = Math.max(0, retryCount - 1);
  const exponentialDelay = Math.min(
    GENERIC_RETRY_BASE_MS * 2 ** exponent,
    GENERIC_RETRY_MAX_MS,
  );
  const normalizedRandom = Math.min(1, Math.max(0, randomValue));
  const jitteredDelay = Math.min(
    GENERIC_RETRY_MAX_MS,
    Math.round(
      exponentialDelay *
        (MIN_JITTER_FACTOR + normalizedRandom * JITTER_SPREAD),
    ),
  );
  const genericRetryAt = nowMs + Math.max(1, jitteredDelay);

  return retryAfterAt && retryAfterAt > genericRetryAt
    ? retryAfterAt
    : genericRetryAt;
}
