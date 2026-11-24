// Seeded randomness for Solmar Heat.
//
// One tiny generator (mulberry32) is all the game needs: give it a seed and
// it hands back the same stream of numbers every time, so the same seed
// always builds the same city, the same traffic and the same screenshot
// scenes. Nothing here touches the DOM or the clock.

// Mulberry32: a 32-bit state, advanced once per call, returning [0, 1).
export function createRandom(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// Draw one element of `list` at random, using the seeded stream.
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}
