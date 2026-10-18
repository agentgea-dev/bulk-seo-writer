/**
 * Fixed-window, in-memory rate limiter for the LLM route.
 *
 * Caps how many paid generations one client can trigger per window. State
 * lives in the server instance's memory, so on serverless (Vercel) each warm
 * instance counts separately: this stops casual abuse of a public demo, not a
 * determined attacker. Set a spending limit at the LLM provider as well.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** seconds until the window resets (0 when ok) */
  retryAfterSec: number;
}

export function createRateLimiter(
  max: number,
  windowMs: number,
  now: () => number = Date.now
): (key: string) => RateLimitResult {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (key: string) => {
    const t = now();
    // Drop expired entries so the map can't grow without bound.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    if (entry.count >= max) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSec: Math.ceil((entry.resetAt - t) / 1000),
      };
    }
    entry.count++;
    return { ok: true, remaining: max - entry.count, retryAfterSec: 0 };
  };
}

/** Parse a positive integer env value, falling back on anything else. */
export function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
