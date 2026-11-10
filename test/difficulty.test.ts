import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bitsForTarget,
  chanceWithin,
  expectedAttempts,
  expectedSeconds,
  hitChance,
  isNearMiss,
} from '../src/difficulty.ts';
import { BASE_TARGET, targetForBoost } from '../src/economy.ts';
import { attemptHash } from '../src/hash.ts';
import { head } from '../src/cpu.ts';

test('base target is a 27-bit difficulty, about 134M attempts per proof', () => {
  assert.equal(bitsForTarget(BASE_TARGET), 27);
  assert.equal(expectedAttempts(BASE_TARGET), 2 ** 27);
});

test('boost divides the expected work', () => {
  assert.equal(expectedAttempts(targetForBoost(4)), 2 ** 25);
  assert.ok(hitChance(targetForBoost(101)) > hitChance(BASE_TARGET) * 100);
});

test('time to proof follows hashrate', () => {
  assert.equal(expectedSeconds(BASE_TARGET, 2 ** 27), 1);
  assert.equal(expectedSeconds(BASE_TARGET, 0), Infinity);
});

test('chance within the expected attempts is about 63%', () => {
  const p = chanceWithin(BASE_TARGET, expectedAttempts(BASE_TARGET));
  assert.ok(Math.abs(p - (1 - 1 / Math.E)) < 1e-6);
});

test('hit rate matches the target on real hashes', () => {
  const target = 2 ** 28; // 1 in 16
  let hits = 0;
  const n = 20_000;
  for (let i = 0; i < n; i++)
    if (head(attemptHash('0x' + '11'.repeat(20), 'ab'.repeat(16), i)) < target) hits++;
  assert.ok(Math.abs(hits / n - hitChance(target)) < 0.01, `rate ${hits / n}`);
});

test('near misses count leading zero bits', () => {
  assert.ok(isNearMiss('000fff', 12));
  assert.ok(!isNearMiss('001fff', 12));
});
