import { leadingZeroBits } from './hash.ts';

const SPACE = 2 ** 32;

/** Chance that a single attempt lands under the target (first 32 bits of the hash). */
export const hitChance = (target: number) => Math.min(1, Math.max(0, target) / SPACE);

/** Average attempts needed for one proof. */
export const expectedAttempts = (target: number) => (target > 0 ? SPACE / target : Infinity);

/** Equivalent leading-zero-bit difficulty of a target. */
export const bitsForTarget = (target: number) => 32 - Math.log2(target);

/** Average seconds to a proof at a given hashrate (hashes per second). */
export const expectedSeconds = (target: number, hashrate: number) =>
  hashrate > 0 ? expectedAttempts(target) / hashrate : Infinity;

/** Probability of at least one proof after n attempts. */
export const chanceWithin = (target: number, attempts: number) =>
  1 - (1 - hitChance(target)) ** attempts;

/** A hash counts as "close" when it has at least `bits` leading zero bits: used for share-style progress. */
export const isNearMiss = (hash: string, bits: number) => leadingZeroBits(hash) >= bits;
