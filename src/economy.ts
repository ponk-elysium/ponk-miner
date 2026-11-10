export const HOUR_MS = 60 * 60 * 1000;
export const HOUR_CAP_CENTS = 1000;
export const HOUR_BUDGET_MICRO_USD = 10_000_000;
export const REWARD_MICRO_USD = 20_000;
export const MAX_GAS_MICRO_USD = 20_000;
export const CENT_MS_FLOOR = 3 * 60 * 1000;
export const CHALLENGE_TTL = 2 * HOUR_MS;
export const BASE_BITS = 27;
export const BASE_TARGET = 2 ** (32 - BASE_BITS);

export function targetForBoost(boost: number) {
  return Math.floor(BASE_TARGET * Math.max(1, Math.min(101, boost)));
}

export function holderBoost(balance: bigint, supply: bigint) {
  if (supply <= 0n || balance < 0n || balance > supply)
    throw new Error('Invalid token supply');
  return 1 + Number((balance * 100_000_000n) / supply) / 1_000_000;
}

export function gpuDuty(weight: number, power = 75) {
  const duty =
    weight >= 180
      ? 0.34
      : weight >= 110
        ? 0.26
        : weight >= 60
          ? 0.18
          : weight >= 28
            ? 0.12
            : 0.08;
  return duty * Math.max(0.4, Math.min(1, power / 100));
}

export function miningMessage(address: string, id: string, issued: number) {
  return `elzponk.fun mining authorization\nChain: 99901\nWallet: ${address.toLowerCase()}\nRequest: ${id}\nIssued: ${issued}\nAuthorize one mining round. No token approval or transfer.`;
}
