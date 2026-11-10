// Mine one proof on the CPU and verify it, the same way the server does.
// npm run example -- [address] [bits]
import { randomBytes } from 'node:crypto';
import { attemptHash, bitsForTarget, expectedAttempts, searchCpu, verifyProof } from '../src/index.ts';

const address = process.argv[2] ?? '0x000000000000000000000000000000000000dead';
const bits = Number(process.argv[3] ?? 18);
const target = 2 ** (32 - bits);
const seed = randomBytes(16).toString('hex');

console.log(`wallet ${address}\nseed   ${seed}\ntarget ${bits} bits, ~${expectedAttempts(target).toLocaleString()} attempts`);
const started = performance.now();
let nonce: number | null = null;
for (let from = 0; nonce === null; from += 100_000) nonce = searchCpu(address, seed, target, from, 100_000);
const seconds = (performance.now() - started) / 1000;

console.log(`proof  nonce ${nonce} in ${seconds.toFixed(2)}s (${Math.round(nonce / seconds).toLocaleString()} H/s)`);
console.log(`hash   ${attemptHash(address, seed, nonce)}`);
console.log(`valid  ${verifyProof(address, seed, nonce, target)} at ${bitsForTarget(target)} bits`);
