// Part-Time Pilot — derive combat stats from a build.
// A "build" is { name, pilot, paint, boss?, parts: { chassis:{id,lvl,mod}, head, legs, armR, armL, mount0.., module0.. } }
// Pure functions: used by the hub (stat preview) and the battle sim.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const S = (P.Stats = {});

  const LVL_STEP = 0.12;
  const HP_SCALE = 1.8; // HP multiplier for limbs/weapons/heads (tunes battle length)
  const CORE_HP_SCALE = 1.4; // chassis HP multiplier (lower = K.O. before everything falls off)
  S.LVL_STEP = LVL_STEP;
  S.MAX_LVL = 3;

  function addMap(dst, src) {
    if (!src) return;
    for (const k in src) dst[k] = (dst[k] || 0) + src[k];
  }

  function mergeFx(acc, fx) {
    if (!fx) return;
    for (const k of ['luck', 'crit', 'acc', 'eva', 'speed', 'hpMult', 'armor', 'chain', 'splash', 'knock', 'magnet', 'spite', 'napalm', 'mechanic']) {
      if (fx[k]) acc[k] = (acc[k] || 0) + fx[k];
    }
    if (fx.dmg) addMap(acc.dmg, fx.dmg);
    if (fx.cd) addMap(acc.cd, fx.cd);
    if (fx.stable) acc.stable = true;
    if (fx.reactor) acc.reactor = true;
    if (fx.burnImmune) acc.burnImmune = true;
    for (const k of ['phoenix', 'mimic', 'lottery', 'golem', 'phase2']) if (fx[k]) acc[k] = true;
  }

  // Ditto Arm: copies the weapon on the opposite arm
  const SLAP = { type: 'melee', vfx: 'claw', dmg: 6, cd: 1.2, reach: 58 };
  function mirrorWeapon(x, items) {
    const otherKey = x.key === 'armR' ? 'armL' : 'armR';
    const o = items.find((y) => y.key === otherKey);
    if (!o || !o.def.weapon || o.def.mirror) return { wd: SLAP, name: P.t('Ditto Slap'), mult: 1 };
    return { wd: o.def.weapon, name: P.t('Ditto {name}', { name: P.partName(o.def.id) }), mult: 0.85 * (1 + LVL_STEP * o.lvl) };
  }

  // Which slot keys are active for this build's chassis
  S.activeSlots = function (build) {
    const ch = build.parts.chassis;
    return P.slotsFor(ch ? ch.id : null);
  };

  S.compute = function (build) {
    const slots = S.activeSlots(build);
    const items = [];
    for (const key of slots) {
      const item = build.parts[key];
      if (!item) continue;
      const def = P.PARTS[item.id];
      if (!def) continue;
      if (P.slotCat(key) !== def.cat) continue;
      items.push({ key, item, def, mod: item.mod ? P.MODS[item.mod] || null : null, lvl: item.lvl || 0 });
    }

    const acc = { luck: 0, crit: 0, acc: 0, eva: 0, speed: 0, hpMult: 0, armor: 0, chain: 0, splash: 0, knock: 0, magnet: 0, spite: 0, napalm: 0, dmg: {}, cd: {} };
    const tagCount = {};
    let weight = 0;
    let headDef = null, legsDef = null, chassisDef = null;
    const util = { block: null, jets: null, repair: null, shield: null, plating: null, decoy: null };

    for (const x of items) {
      const d = x.def;
      if (d.cat !== 'legs') weight += d.weight || 0;
      for (const t of d.tags || []) tagCount[t] = (tagCount[t] || 0) + 1;
      mergeFx(acc, d.passive);
      if (x.mod) {
        if (x.mod.luck) acc.luck += x.mod.luck;
        if (x.mod.crit) acc.crit += x.mod.crit;
      }
      if (d.cat === 'head') headDef = d;
      if (d.cat === 'legs') legsDef = d;
      if (d.cat === 'chassis') chassisDef = d;
      if (d.utility) {
        const u = d.utility;
        if (u.kind === 'block') util.block = { key: x.key, chance: u.chance };
        if (u.kind === 'jets') util.jets = { key: x.key, eva: u.eva };
        if (u.kind === 'repair') util.repair = { key: x.key, amount: Math.round(u.amount * (1 + LVL_STEP * x.lvl)), interval: u.interval };
        if (u.kind === 'shield') util.shield = { key: x.key, cap: Math.round(u.cap * (1 + LVL_STEP * x.lvl)), regen: u.regen };
        if (u.kind === 'plating') util.plating = { key: x.key, armor: u.armor, chassisHp: Math.round(u.chassisHp * (1 + LVL_STEP * x.lvl)) };
        if (u.kind === 'decoy') util.decoy = { key: x.key, chance: u.chance };
      }
    }

    // Hired pilot's quirk (Chapter 2): works like a passive on the whole mech
    mergeFx(acc, build.pilotFx);

    // Weapon-type counts (for Trigger Happy)
    const weaponTypeCount = {};
    for (const x of items) {
      const wd = x.def.mirror ? mirrorWeapon(x, items).wd : x.def.weapon;
      if (wd) weaponTypeCount[wd.type] = (weaponTypeCount[wd.type] || 0) + 1;
    }

    // Synergies
    const synergies = [];
    for (const sid in P.SYNERGIES) {
      const syn = P.SYNERGIES[sid];
      const n = syn.countWeaponType ? weaponTypeCount[syn.countWeaponType] || 0 : tagCount[sid] || 0;
      if (n <= 0) continue;
      let tier = -1;
      syn.tiers.forEach((t, i) => {
        if (n >= t.n) tier = i;
      });
      synergies.push({ id: sid, name: syn.name, color: syn.color, count: n, tier, next: syn.tiers[tier + 1] ? syn.tiers[tier + 1].n : null, tiers: syn.tiers });
      if (tier >= 0) mergeFx(acc, syn.tiers[tier].fx);
    }
    synergies.sort((a, b) => b.tier - a.tier || b.count - a.count);

    // Head
    const head = headDef ? headDef.head : null;
    let accuracy = (head ? head.acc : -25) + acc.acc + (build.bonusAcc || 0);
    let crit = 5 + (head ? head.crit || 0 : 0) + acc.crit;
    let luck = (head ? head.luck || 0 : 0) + acc.luck + (build.bonusLuck || 0);
    const targeting = head ? head.target : 'random';

    // Legs / mobility
    let speed, eva, cap, legsType = null, limbs = 0, stable = !!acc.stable;
    if (legsDef) {
      const L = legsDef.legs;
      speed = L.speed * (1 + acc.speed);
      eva = L.eva + acc.eva;
      cap = L.cap;
      legsType = L.type;
      limbs = L.limbs;
      if (L.stable) stable = true;
    } else {
      speed = 0.12;
      eva = 0;
      cap = 999;
    }
    if (util.jets) eva += util.jets.eva;
    eva += build.bonusEva || 0;

    const over = cap > 0 ? weight / cap - 1 : 0;
    let overweight = 0;
    if (legsDef && over > 0) {
      overweight = over;
      speed *= Math.max(0.35, 1 - over * 1.2);
      eva -= over * 40;
    }
    eva = Math.max(0, eva);

    // Armor
    let armor = (chassisDef ? chassisDef.armor : 0) + acc.armor + (util.plating ? util.plating.armor : 0);

    // Parts with HP
    // Bosses are beefier but hit a bit softer so the fight lasts long enough to be dramatic
    const BOSS_HP = build.boss ? 1.3 : 1, BOSS_DMG = build.boss ? 0.72 : 1;
    const hpMult = (1 + acc.hpMult) * BOSS_HP;
    const parts = [];
    let hpTotal = 0, hpNow = 0;
    for (const x of items) {
      if (x.def.cat === 'module') continue;
      let hp = x.def.hp * (x.def.cat === 'chassis' ? CORE_HP_SCALE : HP_SCALE) * (1 + LVL_STEP * x.lvl) * (1 + ((x.mod && x.mod.hp) || 0)) * hpMult;
      if (x.def.cat === 'chassis' && util.plating) hp += util.plating.chassisHp;
      hp = Math.max(1, Math.round(hp));
      // damage carried over from the last bout (repair it in the garage)
      const wear = Math.min(1, Math.max(0, x.item.wear || 0));
      const startHp = wear > 0 ? Math.max(1, Math.round(hp * (1 - wear))) : hp;
      hpTotal += hp;
      hpNow += startHp;
      parts.push({ key: x.key, slot: x.key, id: x.def.id, def: x.def, name: P.itemName(x.item), maxHp: hp, startHp, wear, armor: x.def.cat === 'chassis' ? 0 : x.def.armor || 0, lvl: x.lvl, mod: x.item.mod || null });
    }

    // Weapons
    const weapons = [];
    let dps = 0;
    for (const x of items) {
      let wd = x.def.weapon;
      let wname = P.partName(x.def.id), extraMult = 1;
      if (x.def.mirror) {
        const mw = mirrorWeapon(x, items);
        wd = mw.wd;
        wname = mw.name;
        extraMult = mw.mult;
      }
      if (!wd) continue;
      const modDmg = (x.mod && x.mod.dmg) || 0;
      const modCd = (x.mod && x.mod.cd) || 0;
      const dmgMult = extraMult * (1 + LVL_STEP * x.lvl) * (1 + modDmg) * (1 + (acc.dmg[wd.type] || 0) + (acc.dmg.all || 0)) * BOSS_DMG;
      const cdMult = Math.max(0.35, (1 + modCd) * (1 + (acc.cd[wd.type] || 0) + (acc.cd.all || 0)));
      const w = {
        partKey: x.key,
        id: x.def.id,
        name: wname,
        type: wd.type,
        vfx: wd.vfx,
        dmg: wd.dmg * dmgMult,
        cd: wd.cd * cdMult,
        range: wd.range ? wd.range.slice() : [0, wd.reach || 60],
        opt: wd.opt || 100,
        reach: wd.reach || 0,
        melee: wd.type === 'melee' && !wd.thrown,
        thrown: !!wd.thrown,
        spinup: wd.spinup || null,
        pull: wd.pull || 0,
        corrode: wd.corrode || 0,
        ret: !!wd.ret,
        critTopple: !!wd.critTopple,
        frost: wd.frost || 0,
        pierceN: wd.pierceN || 0,
        hitsAll: !!wd.hitsAll,
        mine: !!wd.mine,
        jam: wd.jam || 0,
        homing: !!wd.homing,
        blind: wd.blind || 0,
        chambers: !!wd.chambers,
        ripAll: wd.ripAll || 0,
        acc: wd.acc || 0,
        burst: wd.burst || 1,
        burstGap: wd.burstGap || 0,
        pellets: wd.pellets || 1,
        splash: wd.splash ? wd.splash + acc.splash : 0,
        chain: wd.chain ? wd.chain + acc.chain : 0,
        pierce: wd.pierce || 0,
        burn: wd.burn || 0,
        slow: wd.slow || 0,
        knock: wd.knock ? wd.knock * (1 + acc.knock) : 0,
        stagger: wd.stagger || 0,
        rip: wd.rip || 0,
        bias: wd.bias || null,
        charge: wd.charge || 0,
        falloff: !!wd.falloff,
        vending: !!wd.vending,
        coreBonus: wd.coreBonus || 0,
      };
      if (w.type === 'explosive' && acc.napalm) w.burn = Math.max(w.burn, acc.napalm);
      weapons.push(w);
      let shotDps = (w.dmg * w.pellets * w.burst) / (w.cd + w.charge);
      if (w.spinup) shotDps *= 1 / ((1 + w.spinup.min) / 2);
      if (w.ret) shotDps *= 2;
      if (w.pierceN) shotDps *= 1 + 0.75 * w.pierceN;
      if (w.hitsAll) shotDps *= Math.max(1, parts.length - 1);
      dps += shotDps;
    }

    const dmgMult = {};
    for (const ty of ['ballistic', 'melee', 'explosive', 'energy', 'fire', 'acid', 'cryo', 'sonic', 'emp', 'gravity']) dmgMult[ty] = 1 + (acc.dmg[ty] || 0) + (acc.dmg.all || 0);

    return {
      parts,
      weapons,
      dmgMult,
      hpTotal,
      hpNow,
      armor,
      acc: accuracy,
      eva,
      speed,
      crit,
      luck,
      targeting,
      weight,
      cap: legsDef ? cap : 0,
      overweight,
      legsType,
      limbs,
      stable,
      util,
      flags: {
        magnet: acc.magnet || 0,
        spite: acc.spite || 0,
        reactor: !!acc.reactor,
        burnImmune: !!acc.burnImmune,
        phoenix: !!acc.phoenix,
        mimic: !!acc.mimic,
        lottery: !!acc.lottery,
        golem: !!acc.golem,
        adapt: !!(head && head.adapt),
        mechanic: acc.mechanic || 0,
        phase2: !!acc.phase2,
        rush: (legsDef && legsDef.legs.rush) || 0,
      },
      synergies,
      dps,
      tagCount,
    };
  };

  // Short human-readable stat line for an item (used in lists)
  S.itemSummary = function (item) {
    const def = P.PARTS[item.id];
    if (!def) return '';
    const lvlM = 1 + LVL_STEP * (item.lvl || 0);
    const mod = item.mod ? P.MODS[item.mod] : null;
    const bits = [];
    const HPS = def.cat === 'chassis' ? 1.4 : 1.8;
    if (def.weapon) {
      const w = def.weapon;
      const dmg = w.dmg * lvlM * (1 + ((mod && mod.dmg) || 0));
      const cnt = (w.pellets || 1) * (w.burst || 1);
      const cd = w.cd * (1 + ((mod && mod.cd) || 0));
      bits.push(`${P.dmgName(w.type)} ${Math.round(dmg * 10) / 10}${cnt > 1 ? '×' + cnt : ''}`);
      bits.push(P.t('every {s}s', { s: Math.round(cd * 100) / 100 }));
      bits.push(w.type === 'melee' && !w.thrown ? P.t('melee') : P.t('range {r}', { r: w.range[1] }));
    }
    if (def.mirror) bits.push(P.t('copies your other arm'));
    if (def.head) {
      bits.push(P.t('Acc') + ` +${def.head.acc}`);
      if (def.head.crit) bits.push(P.t('Crit') + ` +${def.head.crit}%`);
      if (def.head.luck) bits.push(P.t('Luck') + ` +${def.head.luck}`);
    }
    if (def.legs) {
      bits.push(P.t('Speed') + ` ${def.legs.speed}`);
      bits.push(P.t('Eva') + ` ${def.legs.eva}`);
      bits.push(P.t('Carry') + ` ${def.legs.cap}`);
    }
    if (def.chassis) {
      bits.push(P.t('Armor') + ` ${def.armor}`);
      bits.push(P.t('{n} HP-pt', { n: def.chassis.mounts }));
      bits.push(P.t('{n} mod', { n: def.chassis.modules }));
    }
    if (def.hp) bits.push(P.t('HP') + ` ${Math.round(def.hp * HPS * lvlM * (1 + ((mod && mod.hp) || 0)))}`);
    if (def.cat !== 'legs') bits.push(P.t('Wt') + ` ${def.weight}`);
    else bits.push(P.t('Wt') + ` ${def.weight}*`);
    return bits.join(' · ');
  };
})();
