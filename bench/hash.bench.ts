// CPU hashrate of the pure-TypeScript SHA-256 on this machine.
// npm run bench
import { attemptHash } from '../src/hash.ts';

const address = '0x4aa4a53ed3979d728f9eecac16b4801d45cd2066';
const seed = '00'.repeat(16);
for (let i = 0; i < 20_000; i++) attemptHash(address, seed, i); // warm up

const runs: number[] = [];
for (let r = 0; r < 5; r++) {
  const n = 200_000;
  const t = performance.now();
  for (let i = 0; i < n; i++) attemptHash(address, seed, i);
  runs.push(n / ((performance.now() - t) / 1000));
}
runs.sort((a, b) => a - b);
console.log(`attemptHash: ${Math.round(runs[2]).toLocaleString()} H/s (median of 5)`);
