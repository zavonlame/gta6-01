// random.js — one job: deterministic randomness for the city and the shots.
// A tiny mulberry32 stream; same seed always builds the same Solmar.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function chance(rng, p) {
  return rng() < p;
}

export function intRange(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// Fisher-Yates shuffle that never touches the caller's array.
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// A shared stream for one-off cosmetic rolls (smoke puffs, sparks).
let shared = makeRng(20261124);
export function reseedShared(seed) {
  shared = makeRng(seed);
}
export function sharedRoll() {
  return shared();
}
