import { attemptHash } from './hash.ts';

/** First 32 bits of a SHA-256 digest, the value the round target is compared against. */
export const head = (hash: string) => Number.parseInt(hash.slice(0, 8), 16);

/** A proof is valid when the attempt hash's head is under the round target. */
export function verifyProof(address: string, seed: string, nonce: number, target: number) {
  return head(attemptHash(address, seed, nonce)) < target;
}

/** Plain CPU search over [from, from + count). Returns the first winning nonce, or null. */
export function searchCpu(
  address: string,
  seed: string,
  target: number,
  from = 0,
  count = 1_000_000,
): number | null {
  for (let nonce = from; nonce < from + count; nonce++)
    if (head(attemptHash(address, seed, nonce)) < target) return nonce;
  return null;
}
