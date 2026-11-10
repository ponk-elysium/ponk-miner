
export const UPGRADE_DATA = `0x${[...new TextEncoder().encode('elponk:upgrade:v2')].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
// 0.06 HYPE per unit.
export const UPGRADE_UNIT = 60_000_000_000_000_000n;
export const UPGRADES = [
  { name: 'SPARK', multiplier: 2, units: 1 },
  { name: 'TURBO', multiplier: 4, units: 3 },
  { name: 'OVERDRIVE', multiplier: 8, units: 7 },
] as const;

export function upgradeStatus(
  paidWei = '0',
  legacyCreditWei = '0',
  retiredOwned = false,
) {
  const paid = BigInt(paidWei) + BigInt(legacyCreditWei);
  const tier = [...UPGRADES]
    .reverse()
    .find((item) => paid >= BigInt(item.units) * UPGRADE_UNIT);
  return {
    paidWei,
    creditWei: paid.toString(),
    multiplier: retiredOwned ? 16 : (tier?.multiplier ?? 1),
  };
}
export type UpgradeStatus = ReturnType<typeof upgradeStatus>;
