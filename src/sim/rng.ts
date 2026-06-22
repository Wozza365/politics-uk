/**
 * Deterministic pseudo-randomness for the sim (spec §10.5 / cross-cutting
 * "Determinism" concern): no `Math.random()` anywhere in the sim path, so a
 * given (date, party, ...) always reproduces the same "random" wobble.
 */

/** djb2-ish string hash -> 32-bit unsigned int, used to seed the PRNG from a string key. */
function hashSeed(key: string): number {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32: small, fast, good-enough-for-games PRNG. Returns a function yielding [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A deterministic value in `[-magnitude, +magnitude]`, derived purely from `key`.
 * Same key in -> same value out, every time (no shared/mutable RNG state).
 */
export function seededVariance(key: string, magnitude = 1): number {
  const next = mulberry32(hashSeed(key))
  return (next() * 2 - 1) * magnitude
}
