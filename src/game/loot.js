// Part-Time Pilot — loot tables, shop stock, scavenging, salvage, crafting.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const L = (P.Loot = {});

  const RAR_MULT = { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 4, prototype: 4 };

  L.rarityWeights = function (luck, tier) {
    luck = Math.max(0, luck || 0);
    const w = {
      common: 60,
      uncommon: 28 * (1 + luck / 60) * (1 + 0.3 * tier),
      rare: 10 * (1 + luck / 35) * (1 + 0.6 * tier),
      epic: 2.2 * (1 + luck / 22) * (1 + 1.0 * tier),
      legendary: 0.35 * (1 + luck / 15) * (1 + 1.0 * tier),
    };
    const maxIdx = Math.min(4, tier + 2);
    P.RARITY_ORDER.forEach((r, i) => {
      if (i > maxIdx) w[r] = 0;
    });
    if (tier === 0) w.rare *= 0.5;
    return w;
  };

  L.rollRarity = function (luck, tier, rng, minIdx) {
    rng = rng || U.rng;
    const w = L.rarityWeights(luck, tier);
    const list = P.RARITY_ORDER.filter((r, i) => i >= (minIdx || 0) && w[r] > 0);
    return rng.weighted(list, (r) => w[r]);
  };

  L.pool = function (filter) {
    return Object.values(P.PARTS).filter((d) => !d.noLoot && (!filter || filter(d)));
  };

  L.rollMod = function (def, luck, rng, chanceBonus) {
    rng = rng || U.rng;
    const chance = 0.3 + (luck || 0) * 0.004 + (chanceBonus || 0);
    if (rng() > chance) return null;
    const ids = Object.keys(P.MODS).filter((id) => {
      const m = P.MODS[id];
      if (m.weaponOnly && !def.weapon) return false;
      if (m.needsHp && !def.hp) return false;
      if (def.cat === 'module' && (m.hp || m.dmg) && id !== 'golden') return false;
      return true;
    });
    return rng.weighted(ids, (id) => {
      const m = P.MODS[id];
      let wt = m.weight;
      if (id === 'golden') wt *= 1 + luck / 10;
      if (id === 'haunted' || id === 'lucky') wt *= 1 + luck / 25;
      if (id === 'rusty') wt /= 1 + luck / 20;
      return wt;
    });
  };

  // opts: { luck, tier, rng, cats:[...], tags:[...], bias (0..1 chance to honor filter), minRarity }
  L.rollItem = function (opts) {
    const rng = opts.rng || U.rng;
    const luck = opts.luck || 0;
    const tier = opts.tier || 0;
    const minIdx = opts.minRarity ? P.RARITY_ORDER.indexOf(opts.minRarity) : 0;
    let rarity = L.rollRarity(luck, tier, rng, minIdx);
    const useFilter = (opts.cats || opts.tags) && rng() < (opts.bias == null ? 0.75 : opts.bias);
    const filt = (d) =>
      (!useFilter || ((!opts.cats || opts.cats.includes(d.cat)) && (!opts.tags || (d.tags || []).some((t) => opts.tags.includes(t))))) &&
      (!opts.exclude || !opts.exclude.includes(d.id));
    let pool = L.pool((d) => d.rarity === rarity && filt(d));
    let guard = 0;
    while (!pool.length && guard++ < 6) {
      const idx = P.RARITY_ORDER.indexOf(rarity);
      rarity = P.RARITY_ORDER[Math.max(0, idx - 1)];
      pool = L.pool((d) => d.rarity === rarity && filt(d));
      if (!pool.length && idx === 0) pool = L.pool(filt);
    }
    if (!pool.length) pool = L.pool();
    const def = rng.pick(pool);
    return { id: def.id, lvl: 0, mod: L.rollMod(def, luck, rng) };
  };

  L.price = function (item) {
    const def = P.PARTS[item.id];
    if (!def) return 0;
    const mod = item.mod ? P.MODS[item.mod] : null;
    return Math.round((def.price * (mod ? mod.price : 1) * (1 + 0.35 * (item.lvl || 0))) / 5) * 5;
  };
  L.sellPrice = function (item) {
    if (item.free) return 0;
    return Math.max(1, Math.round(L.price(item) * 0.4));
  };
  L.salvageValue = function (item) {
    if (item.free) return 0;
    const def = P.PARTS[item.id];
    return Math.round(P.RARITY[def.rarity].scrap * (1 + 0.5 * (item.lvl || 0)) * (item.mod === 'golden' ? 2 : 1));
  };
  // opts: { maxLvl, disc } from the Tinker Lab
  L.tinkerCost = function (item, opts) {
    opts = opts || {};
    const def = P.PARTS[item.id];
    const lvl = item.lvl || 0;
    if (lvl >= (opts.maxLvl || P.Stats.MAX_LVL)) return null;
    return Math.max(1, Math.round((lvl + 1) * 4 * RAR_MULT[def.rarity] * (1 - (opts.disc || 0))));
  };

  // Cost to fully repair a damaged part: wear x price x REPAIR_RATE, minus the Repair Bay discount.
  // Junk Bin freebies are patched for free.
  L.repairCost = function (item, disc, wear) {
    const w = wear != null ? wear : item.wear || 0;
    if (item.free || w <= 0.001) return 0;
    return Math.max(1, Math.ceil(L.price(item) * P.REPAIR_RATE * w * (1 - (disc || 0))));
  };

  L.shopStock = function (tier, rng) {
    rng = rng || U.rng;
    const out = [];
    const used = new Set();
    const wants = [['arm'], ['mount'], ['legs', 'head'], ['chassis', 'module'], null, null];
    for (const cats of wants) {
      let item, guard = 0;
      do {
        item = L.rollItem({ luck: 5, tier, rng, cats: cats || undefined, bias: 1 });
      } while (used.has(item.id) && guard++ < 10);
      used.add(item.id);
      if (item.mod === 'rusty' && rng() < 0.5) item.mod = null;
      out.push(item);
    }
    return out;
  };

  L.JUNK_BIN = ['dumpster_frame', 'bucket_head', 'scrap_stompers', 'rivet_gun', 'hydraulic_claw', 'plunger_launcher'];

  L.PILES = [
    { id: 'kitchen', name: 'Kitchen Heap', icon: '🍳', desc: 'Busted appliances. Smells like old casserole.', tags: ['appliance', 'pyro'] },
    { id: 'cars', name: 'Car Graveyard', icon: '🚗', desc: 'Doors, wheels, engines. Mostly legs and guns.', cats: ['legs', 'arm', 'chassis'] },
    { id: 'electronics', name: 'E-Waste Mountain', icon: '📺', desc: 'Tangled wires and suspicious capacitors.', tags: ['sparky'], cats: ['head', 'module', 'mount'] },
    { id: 'lostfound', name: 'Lost & Found Bin', icon: '🎲', desc: 'Things people swear they never owned.', tags: ['lucky'] },
    { id: 'demolition', name: 'Condemned Building', icon: '🏚', desc: 'Rubble, rebar and one very angry pigeon.', tags: ['demolition', 'junk'] },
    { id: 'tarp', name: 'The Mystery Tarp', icon: '❓', desc: "Nobody knows what's under it. High risk, high reward.", mystery: true },
  ];

  L.pilesForDay = function (day) {
    const rng = U.makeRng(day * 7919 + 17);
    const pool = L.PILES.filter((p) => !p.mystery);
    const a = [];
    while (a.length < 2) {
      const p = rng.pick(pool);
      if (!a.includes(p)) a.push(p);
    }
    a.push(L.PILES.find((p) => p.mystery));
    return a;
  };

  // Returns { items:[], wage, notes:[], luckBonus }
  L.scavenge = function (pile, luck, tier, rng) {
    rng = rng || U.rng;
    const res = { items: [], wage: 25, notes: [], luckBonus: 0 };
    if (pile.mystery) res.blueprintChance = 0.14 + luck * 0.002;
    else if (pile.id === 'lostfound') res.blueprintChance = 0.06 + luck * 0.001;
    else res.blueprintChance = 0.02;
    if (pile.mystery) {
      const roll = rng();
      if (roll < 0.22) {
        res.notes.push(P.t('Under the tarp: a raccoon. It looks at you with deep respect. It is now your mascot. (+1 permanent Luck)'));
        res.luckBonus = 1;
        return res;
      }
      const it = L.rollItem({ luck: luck + 25, tier: Math.min(3, tier + 1), rng });
      res.items.push(it);
      if (roll > 0.85) {
        res.items.push(L.rollItem({ luck: luck + 25, tier: Math.min(3, tier + 1), rng }));
        res.notes.push(P.t('The tarp was hiding a whole stash!'));
      }
      return res;
    }
    res.items.push(L.rollItem({ luck, tier, rng, cats: pile.cats, tags: pile.tags, bias: 0.8 }));
    if (rng() < 0.15 + luck / 120) {
      res.items.push(L.rollItem({ luck, tier, rng, cats: pile.cats, tags: pile.tags, bias: 0.8 }));
      res.notes.push(P.t('Lucky find — two parts!'));
    }
    if (rng() < 0.2) {
      const bonus = 5 + Math.floor(rng() * 20);
      res.wage += bonus;
      res.notes.push(P.t('Found ${n} in a couch cushion.', { n: bonus }));
    }
    return res;
  };

  // Enemy parts that survived the battle (winner's salvage rights)
  L.salvageOptions = function (enemyBuild, final, luck, allowChassis, rng, extra) {
    rng = rng || U.rng;
    const opts = [];
    for (const key in enemyBuild.parts) {
      const it = enemyBuild.parts[key];
      if (!it) continue;
      const def = P.PARTS[it.id];
      if (!def) continue;
      if (def.cat === 'chassis' && !allowChassis) continue;
      const f = final[key];
      // a K.O. always wrecks the chassis, but the frame itself can be hauled away as a trophy
      if (f && f.destroyed && def.cat !== 'chassis') continue;
      opts.push({ id: it.id, lvl: it.lvl || 0, mod: it.mod || null });
    }
    // shuffle and trim
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    const n = 3 + (rng() < luck / 100 ? 1 : 0) + (extra || 0);
    if (allowChassis) {
      const ci = opts.findIndex((o) => P.PARTS[o.id].cat === 'chassis');
      if (ci > 0) opts.unshift(opts.splice(ci, 1)[0]);
    }
    return opts.slice(0, n);
  };

  // ---------------------------------------------------------------------------------------------
  // Junk-o-Matic 3000: feed three parts in, get one random part out.
  // Output rarity centers on the average input rarity, with a luck-boosted chance to roll higher.
  // Two or more inputs of the same category/tag pull the result toward that category/tag.
  // ---------------------------------------------------------------------------------------------
  const rarIdx = (id) => Math.min(4, P.RARITY_ORDER.indexOf(P.PARTS[id].rarity));
  L.fuseOdds = function (items, luck) {
    luck = Math.max(0, luck || 0);
    const idx = items.map((it) => rarIdx(it.id));
    const avg = idx.reduce((a, b) => a + b, 0) / idx.length;
    const base = Math.floor(avg + 1e-9), frac = avg - base;
    const same = idx.every((i) => i === idx[0]);
    const w = [0, 0, 0, 0, 0];
    const add = (i, v) => (w[U.clamp(i, 0, 4)] += Math.max(0, v));
    add(base - 1, base > 0 ? 0.1 : 0);
    add(base, 0.55 - frac * 0.3);
    add(base + 1, 0.3 + frac * 0.3 + luck * 0.004 + (same ? 0.1 : 0));
    add(base + 2, 0.035 + luck * 0.001);
    const tot = w.reduce((a, b) => a + b, 0);
    const probs = {};
    P.RARITY_ORDER.slice(0, 5).forEach((r, i) => (probs[r] = w[i] / tot));
    const count = (arr) => arr.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
    const cats = count(items.map((it) => P.PARTS[it.id].cat));
    const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    const tags = count(items.flatMap((it) => P.PARTS[it.id].tags || []));
    const topTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];
    return {
      probs,
      catBias: topCat && topCat[1] >= 2 ? { cat: topCat[0], chance: topCat[1] === 3 ? 0.85 : 0.65 } : null,
      tagBias: topTag && topTag[1] >= 2 ? { tag: topTag[0], chance: 0.5 } : null,
      blueprintChance: 0.03 + luck * 0.0005 + (avg >= 2 ? 0.02 : 0),
      lvl: Math.floor(items.reduce((a, it) => a + (it.lvl || 0), 0) / items.length),
    };
  };
  L.fuse = function (items, luck, rng) {
    rng = rng || U.rng;
    const o = L.fuseOdds(items, luck);
    let rarity = rng.weighted(Object.keys(o.probs), (r) => o.probs[r]);
    const useCat = o.catBias && rng() < o.catBias.chance;
    const useTag = o.tagBias && rng() < o.tagBias.chance;
    const inputs = new Set(items.map((it) => it.id));
    const pick = (r, cat, tag) => {
      let pool = L.pool((d) => d.rarity === r && (!cat || d.cat === cat) && (!tag || (d.tags || []).includes(tag)));
      const fresh = pool.filter((d) => !inputs.has(d.id));
      return fresh.length ? fresh : pool;
    };
    let pool = pick(rarity, useCat && o.catBias.cat, useTag && o.tagBias.tag);
    if (!pool.length) pool = pick(rarity, useCat && o.catBias.cat, null);
    if (!pool.length) pool = pick(rarity, null, null);
    let guard = 0;
    while (!pool.length && guard++ < 5) {
      rarity = P.RARITY_ORDER[Math.max(0, P.RARITY_ORDER.indexOf(rarity) - 1)];
      pool = pick(rarity, null, null);
    }
    const def = rng.pick(pool);
    return {
      item: { id: def.id, lvl: o.lvl, mod: L.rollMod(def, luck, rng, 0.15) },
      rarity,
      blueprint: rng() < o.blueprintChance,
    };
  };

  // chance that a loot crate contains a prototype blueprint
  L.crateBlueprintChance = (luck) => 0.05 + Math.max(0, luck) * 0.001;
})();
