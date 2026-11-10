import { test } from 'node:test';
import assert from 'node:assert/strict';
import { head, searchCpu, verifyProof } from '../src/cpu.ts';
import { attemptHash } from '../src/hash.ts';
import {
  BASE_BITS,
  BASE_TARGET,
  gpuDuty,
  holderBoost,
  miningMessage,
  targetForBoost,
} from '../src/economy.ts';
import { UPGRADE_DATA, UPGRADE_UNIT, upgradeStatus } from '../src/upgrades.ts';
import { chipWeight } from '../src/gpu.ts';
import { ELYSIUM, PONK_TOKEN } from '../src/chain.ts';

const ADDR = '0x000000000000000000000000000000000000dead';
const SEED = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

test('CPU search finds a proof that verifies, and only under its target', () => {
  const target = 2 ** 24; // 8 leading zero bits: quick for a test
  const nonce = searchCpu(ADDR, SEED, target);
  assert.notEqual(nonce, null);
  assert.ok(verifyProof(ADDR, SEED, nonce!, target));
  assert.ok(head(attemptHash(ADDR, SEED, nonce!)) < target);
  for (let n = 0; n < nonce!; n++) assert.ok(!verifyProof(ADDR, SEED, n, target));
});

test('a proof is bound to its wallet and its round seed', () => {
  const target = 2 ** 24;
  const nonce = searchCpu(ADDR, SEED, target)!;
  const other = '0x000000000000000000000000000000000000beef';
  const odds = [verifyProof(other, SEED, nonce, target), verifyProof(ADDR, 'ff'.repeat(16), nonce, target)];
  assert.ok(odds.filter(Boolean).length < 2);
});

test('base difficulty is 27 bits', () => {
  assert.equal(BASE_BITS, 27);
  assert.equal(BASE_TARGET, 32);
});

test('holder boost scales odds and is clamped to 101x', () => {
  assert.equal(targetForBoost(1), BASE_TARGET);
  assert.equal(targetForBoost(0), BASE_TARGET);
  assert.equal(targetForBoost(2.5), Math.floor(BASE_TARGET * 2.5));
  assert.equal(targetForBoost(1e9), BASE_TARGET * 101);
});

test('holderBoost is 1 + percent of supply held', () => {
  assert.equal(holderBoost(0n, 1000n), 1);
  assert.equal(holderBoost(10n, 1000n), 2);
  assert.equal(holderBoost(1000n, 1000n), 101);
  assert.throws(() => holderBoost(1n, 0n));
  assert.throws(() => holderBoost(2n, 1n));
});

test('GPU duty grows with the chip and power, within bounds', () => {
  assert.ok(gpuDuty(220) > gpuDuty(8));
  assert.ok(gpuDuty(96, 100) > gpuDuty(96, 40));
  assert.equal(gpuDuty(96, 10), gpuDuty(96, 40));
  assert.ok(gpuDuty(500, 100) <= 0.34);
});

test('chip weights rank real GPUs', () => {
  assert.ok(chipWeight('NVIDIA GeForce RTX 4090') > chipWeight('Apple M2'));
  assert.ok(chipWeight('Apple M2') > chipWeight('Intel Iris Xe'));
});

test('upgrade tiers by paid HYPE', () => {
  assert.equal(upgradeStatus('0').multiplier, 1);
  assert.equal(upgradeStatus(UPGRADE_UNIT.toString()).multiplier, 2);
  assert.equal(upgradeStatus((3n * UPGRADE_UNIT).toString()).multiplier, 4);
  assert.equal(upgradeStatus((7n * UPGRADE_UNIT).toString()).multiplier, 8);
  assert.equal(upgradeStatus((2n * UPGRADE_UNIT).toString(), UPGRADE_UNIT.toString()).multiplier, 4);
  assert.equal(UPGRADE_DATA, '0x656c706f6e6b3a757067726164653a7632');
});

test('the signed message names the chain and grants no token access', () => {
  const msg = miningMessage('0xABC', 'r1', 1);
  assert.match(msg, /Chain: 99901/);
  assert.match(msg, /Wallet: 0xabc/);
  assert.match(msg, /No token approval or transfer/);
});

test('chain and token constants', () => {
  assert.equal(ELYSIUM.id, 99901);
  assert.match(PONK_TOKEN, /^0x[0-9a-f]{40}$/);
});
