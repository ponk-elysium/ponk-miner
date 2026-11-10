import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import {
  attemptBytes,
  attemptHash,
  attemptWords,
  leadingZeroBits,
  nonceKey,
  sha256Bytes,
  sha256Hex,
} from '../src/hash.ts';

const ADDR = '0x4aa4a53ed3979d728f9eecac16b4801d45cd2066';
const SEED = '00112233445566778899aabbccddeeff';
const ref = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('sha256 matches node:crypto on known vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sha256 matches node:crypto across block boundaries', () => {
  for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
    const data = randomBytes(len);
    assert.equal(sha256Bytes(data), ref(data), `length ${len}`);
  }
});

test('attempt is address(20) | seed(16) | nonce(8, big-endian)', () => {
  const bytes = attemptBytes(ADDR, SEED, 2 ** 32 + 7);
  assert.equal(bytes.length, 44);
  assert.equal(Buffer.from(bytes.slice(0, 20)).toString('hex'), ADDR.slice(2));
  assert.equal(Buffer.from(bytes.slice(20, 36)).toString('hex'), SEED);
  assert.equal(Buffer.from(bytes.slice(36)).toString('hex'), '0000000100000007');
});

test('attemptHash equals sha256 of the attempt bytes', () => {
  for (const nonce of [0, 1, 123_456, 2 ** 40]) {
    assert.equal(attemptHash(ADDR, SEED, nonce), ref(attemptBytes(ADDR, SEED, nonce)));
  }
});

test('attemptWords is the padded single block the GPU shader hashes', () => {
  const words = attemptWords(ADDR, SEED, 42);
  const block = Buffer.alloc(64);
  Buffer.from(attemptBytes(ADDR, SEED, 42)).copy(block);
  block[44] = 0x80;
  block.writeUInt32BE(44 * 8, 60);
  for (let i = 0; i < 16; i++) assert.equal(words[i], block.readUInt32BE(i * 4));
});

test('leadingZeroBits counts bits, not nibbles', () => {
  assert.equal(leadingZeroBits('ffff'), 0);
  assert.equal(leadingZeroBits('7f'), 1);
  assert.equal(leadingZeroBits('1f'), 3);
  assert.equal(leadingZeroBits('00f'), 8);
  assert.equal(leadingZeroBits('0001'), 15);
});

test('nonceKey is a 40-char hex key', () => {
  assert.equal(nonceKey(255), '0'.repeat(38) + 'ff');
});
