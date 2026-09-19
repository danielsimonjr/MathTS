import seedrandom from 'seedrandom';

// Type for seedrandom function
type RngFunction = () => number;

const singletonRandom: RngFunction = /* #__PURE__ */ seedrandom(Date.now());

/**
 * Create a random number generator that returns values from `seedrandom`.
 *
 * If `randomSeed` is null, the generator uses one shared generator that is seeded from
 * `Date.now()`. Otherwise it uses a new generator seeded with `String(randomSeed)`.
 */
export function createRng(randomSeed: string | number | null): RngFunction {
  let random: RngFunction;

  // create a new random generator with given seed
  function setSeed(seed: string | number | null): void {
    random = seed === null ? singletonRandom : seedrandom(String(seed));
  }

  // initialize a seeded pseudo random number generator with config's random seed
  setSeed(randomSeed);

  // wrapper function so the rng can be updated via generator
  function rng() {
    return random();
  }

  return rng;
}
