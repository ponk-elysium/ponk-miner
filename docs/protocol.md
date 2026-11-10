# Mining protocol

## Round

1. The wallet asks for a round. The server returns a request id, a 16-byte random seed and a target.
2. The wallet signs the authorization message (`miningMessage`): domain, chain `99901`, wallet, request id, issue time. It grants no token approval or transfer.
3. The round lives for two hours (`CHALLENGE_TTL`).

## Attempt

```
offset  size  field
0       20    wallet address
20      16    round seed
36      8     nonce, big-endian
```

44 bytes fit one SHA-256 block (padding byte at 44, bit length 352 at 60), so the GPU hashes a single block per nonce and only compares the first output word.

## Target

A proof is valid when `head(sha256(attempt)) < target`, where `head` is the first 32 bits.

| | target | bits | attempts per proof |
|---|---|---|---|
| base | 32 | 27 | 134,217,728 |
| 4× | 128 | 25 | 33,554,432 |
| 101× cap | 3,232 | ~20.3 | ~1,328,900 |

The multiplier is `holderBoost × upgrade`. `holderBoost = 1 + (percent of elPONK supply held)`, read on-chain at the current block, capped with upgrades at 101×.

## Verification

The server re-hashes the submitted nonce with the round's wallet and seed. Because the wallet and seed are in the hashed bytes, a proof can't be moved to another wallet or replayed in another round. Each round pays at most once.

## Power

`gpuDuty(weight, power)` sets how much of each frame the GPU works. Heavier chips run a larger share; the Power slider scales it between 40% and 100% of that share. Pauses keep the page responsive.
