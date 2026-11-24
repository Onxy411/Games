// Part-Time Pilot — themed random opponents.
// Each opponent rolls a loadout from their themed pool (P.ENEMY_POOLS), scaled by the bout tier:
// tinker levels and the chance of loot prefixes grow with the tier. Rolls use a seed, so the same
// run always meets the same build (and the ladder's scouting report matches the actual fight).
// Replays store the rolled build itself, so changing pools never breaks a saved replay.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const O = (P.Opponents = {});

  // Tinker budget [min, max] (spread over the build) and prefix chance per part, by tier.
  // Tiers 0-3 are Chapter 1; 4-6 are the public league.
  O.TIERS = [
    { lvl: [0, 0], mod: 0.06 },
    { lvl: [0, 1], mod: 0.1 },
    { lvl: [1, 2], mod: 0.15 },
    { lvl: [1, 3], mod: 0.2 },
    { lvl: [2, 4], mod: 0.3 },
    { lvl: [3, 6], mod: 0.35 },
    { lvl: [5, 9], mod: 0.4 },
  ];

  O.seedFor = (runSeed, key) => U.hashStr(String(runSeed) + ':' + key);

  const entryOk = (entry, tier) => {
    if (entry === null) return true;
    const at = entry.indexOf('@');
    return at < 0 || tier >= Number(entry.slice(at + 1));
  };
  const entryId = (entry) => (entry === null ? null : entry.split('@')[0]);

  // Fixed build straight from P.ENEMIES (used when an opponent has no pool).
  O.fixed = function (enemyId) {
    const e = P.ENEMIES[enemyId];
    if (!e.parts) return O.roll(enemyId, 4, 1); // pool-only opponents (Chapter 2)
    return { name: e.mech, pilot: e.pilot, paint: e.paint, boss: !!e.boss, parts: U.deepCopy(e.parts) };
  };

  // Roll a parts map from a pool definition { lvl, slots: { slotKey: [ids...] } }.
  O.rollParts = function (pool, tier, rng, opts) {
    opts = opts || {};
    const T = O.TIERS[U.clamp(tier | 0, 0, O.TIERS.length - 1)];
    const pickFrom = (slot) => {
      const list = (pool.slots[slot] || []).filter((e) => entryOk(e, tier));
      if (!list.length) return null;
      return entryId(rng.pick(list));
    };
    const chassis = pickFrom('chassis');
    const parts = {};
    if (!chassis) return parts;
    parts.chassis = { id: chassis, lvl: 0, mod: null };
    const keys = P.slotsFor(chassis);
    for (const k of keys) {
      if (k === 'chassis') continue;
      const id = pickFrom(k);
      if (id && P.PARTS[id] && P.slotCat(k) === P.PARTS[id].cat) parts[k] = { id, lvl: 0, mod: null };
    }
    // loot prefixes
    for (const k of keys) {
      if (!parts[k]) continue;
      parts[k].mod = P.Loot.rollMod(P.PARTS[parts[k].id], 0, rng, Math.max(0, T.mod + (opts.modDelta || 0)) - 0.3);
    }
    // tinker levels, spread over parts that have HP
    let budget = Math.max(0, rng.int(T.lvl[0], T.lvl[1]) + (pool.lvl || 0) + (opts.lvlBonus || 0));
    const maxLvl = opts.maxLvl || (tier >= 4 ? 4 : 3);
    const tinkerable = keys.filter((k) => parts[k] && P.PARTS[parts[k].id].cat !== 'module');
    let guard = 0;
    while (budget > 0 && tinkerable.length && guard++ < 50) {
      const k = rng.pick(tinkerable);
      if (parts[k].lvl < maxLvl) {
        parts[k].lvl++;
        budget--;
      }
    }
    return parts;
  };

  // Rolled build for an opponent at a tier. seed: number.
  O.roll = function (enemyId, tier, seed, opts) {
    const e = P.ENEMIES[enemyId];
    const pool = P.ENEMY_POOLS && P.ENEMY_POOLS[enemyId];
    if (!e) return null;
    if (!pool) return O.fixed(enemyId);
    const rng = U.makeRng(seed >>> 0);
    const parts = O.rollParts(pool, tier, rng, opts);
    if (!parts.chassis && e.parts) return O.fixed(enemyId);
    return { name: e.mech, pilot: e.pilot, paint: e.paint, boss: !!e.boss, parts };
  };
})();
