// Part-Time Pilot — deterministic auto-battle simulation.
//
// Sim.run({seed, A: build, B: build}) runs the whole fight instantly and returns:
//   events   — ordered log (fire / hit / miss / destroy / limb / stumble / burn / heal / freeze / mine / end ...)
//   frames   — per-tick x positions and shield values (30 Hz)
//   stats    — per-mech, per-part and per-weapon damage stats for the battle report
// Given the same seed and builds the result is identical, which is what makes replays tiny:
// a replay file is just { seed, A, B } and gets re-simulated on load.
// Bump VERSION whenever rules change so old replays can warn that they may differ.
//
// Team bouts (v3): A and B may each be an array of builds (index 0 = point, 1 = wing, 2 = rear).
// Every combatant is a "unit" with an id: the leads keep the ids 'A' and 'B', teammates are
// 'A1', 'A2', 'B1', 'B2'. Events use unit ids in src/dst; frames/stats/final are keyed by unit id.
// Teammates fight in their own depth lane, pick an enemy unit to attack (nearest, or a pilot's
// targeting style) and a team loses when all its units are K.O.'d. A 1v1 fight runs exactly the
// same code path, RNG draws and event log as v2, so old replays still re-simulate identically.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const Sim = (P.Sim = {});

  const DT = 1 / 30;
  Sim.DT = DT;
  Sim.MAX_T = 90;
  Sim.START_X = [140, 340];
  Sim.BOUNDS = [36, 444];
  Sim.VERSION = 3;
  Sim.COMPAT = [2, 3]; // 1v1 replays from these versions re-simulate identically
  Sim.TEAM_X = { A: [150, 118, 88], B: [330, 362, 392] };
  const MIN_SEP = 34;
  const LANE_SEP = 10; // units in different depth lanes can stand close, but never swap sides
  const EXPOSURE = { chassis: 46, head: 8, legs: 20, arm: 13, mount: 10 };

  const TRAVEL = {
    bullet: (d) => 0.05 + d / 650,
    revolver: (d) => 0.05 + d / 700,
    nail: (d) => 0.05 + d / 600,
    pellet: (d) => 0.04 + d / 700,
    plunger: (d) => 0.15 + d / 330,
    harpoon: (d) => 0.12 + d / 420,
    rocket: (d) => 0.3 + d / 280,
    swarm: (d) => 0.35 + d / 240,
    mortar: () => 1.15,
    smoke: (d) => 0.6 + d / 450,
    mine: (d) => 0.5 + d / 500,
    toast: (d) => 0.45 + d / 420,
    can: (d) => 0.15 + d / 430,
    laser: () => 0.05,
    rail: () => 0.05,
    cryo: () => 0.07,
    tesla: () => 0.06,
    arc: () => 0.06,
    emp: (d) => 0.12 + d / 700,
    sonic: (d) => 0.15 + d / 600,
    blackhole: () => 0.35,
    flame: (d) => 0.1 + d / 600,
    acid: (d) => 0.12 + d / 500,
    boomerang: (d) => 0.2 + d / 300,
    claw: () => 0.24,
    saw: () => 0.08,
    drill: () => 0.2,
    glove: () => 0.18,
    ball: () => 0.38,
    hammer: () => 0.34,
    ram: () => 0.25,
  };

  Sim.run = function (cfg) {
    const rng = U.makeRng(cfg.seed >>> 0);
    const maxT = cfg.maxT || Sim.MAX_T;
    let t = 0;
    let shotId = 0;
    let ended = null;
    const events = [];
    const frames = {};
    const timeline = [];
    let pendingFires = [];
    let pendingImpacts = [];

    function emit(e) {
      e.t = Math.round(t * 1000) / 1000;
      events.push(e);
      return e;
    }
    const alive = (m, key) => !!(m.parts[key] && !m.parts[key].destroyed);
    const jammed = (m, key) => !!(m.parts[key] && t < (m.parts[key].jammedUntil || 0));
    const working = (m, key) => alive(m, key) && !jammed(m, key);
    const weaponAlive = (m, w) => (w.ram || w.mimic ? alive(m, 'chassis') : alive(m, w.partKey));
    const incap = (m) => t < m.stumbleUntil || t < m.frozenUntil;
    const newWeaponStats = (name, type) => ({ name, type, shots: 0, hits: 0, misses: 0, crits: 0, dmg: 0 });

    function makeMech(build, side, dir, x, teamId, idx) {
      const st = P.Stats.compute(build);
      const chDef = build.parts.chassis && P.PARTS[build.parts.chassis.id];
      const m = {
        side, team: teamId || side, idx: idx || 0, lane: idx || 0, retargetT: 0, pitUsed: false, mechT: 4,
        dir, x, kv: 0, build, st, size: (chDef && chDef.chassis.big) || 0, parts: {}, list: [], weapons: [],
        stumbleUntil: -1, slowUntil: -1, burns: [],
        shield: st.util.shield ? st.util.shield.cap : 0, shieldHitT: -9, tshield: 0,
        lost: 0, phase: 1, repairT: st.util.repair ? st.util.repair.interval : 0, reactorT: 3,
        shuffleT: 0, shuffleDir: 0, ko: false, disarmed: false, lowWarned: false, pref: 100,
        frost: 0, frostT: -9, frozenUntil: -1, freezeImmune: -1, corrode: 0, blindUntil: -1,
        buffDmgUntil: -1, buffTurboUntil: -1, lotteryT: 6, rushT: 2, phoenixUsed: false, golem: 0, golemArmor: 0,
        adapt: {}, mines: [],
        stats: { dmgDealt: 0, dmgTaken: 0, shots: 0, hits: 0, misses: 0, crits: 0, partsDestroyed: 0, healed: 0, absorbed: 0, weapons: {}, parts: {} },
      };
      for (const sp of st.parts) {
        const part = {
          key: sp.key, slot: sp.slot, id: sp.id, name: sp.name, def: sp.def, max: sp.maxHp, hp: sp.startHp != null ? sp.startHp : sp.maxHp, armor: sp.armor,
          destroyed: false, limbs: sp.def.legs ? sp.def.legs.limbs : 0, limbsLost: 0, lucky: false, jammedUntil: 0,
        };
        m.parts[part.key] = part;
        m.list.push(part);
        m.stats.parts[part.key] = { name: sp.name, id: sp.id, slot: sp.slot, max: sp.maxHp, start: part.hp, dmgTaken: 0, hits: 0, destroyed: false, at: null, how: null, hpEnd: part.hp };
      }
      for (const w of st.weapons) {
        m.weapons.push(Object.assign({}, w, { timer: 0, spin: 0, lastFire: -9 }));
        m.stats.weapons[w.partKey] = newWeaponStats(w.name, w.type);
      }
      if (st.flags.rush) m.stats.weapons.rush = newWeaponStats(P.t('Rocket Rush'), 'melee');
      if (st.flags.phoenix) m.stats.weapons.phoenix = newWeaponStats(P.t('Phoenix Nova'), 'fire');
      return m;
    }

    const buildsA = Array.isArray(cfg.A) ? cfg.A : [cfg.A];
    const buildsB = Array.isArray(cfg.B) ? cfg.B : [cfg.B];
    const team = buildsA.length > 1 || buildsB.length > 1;
    const uid = (s, i) => (i ? s + i : s);
    const teamA = buildsA.map((b, i) => makeMech(b, uid('A', i), 1, team ? Sim.TEAM_X.A[i] : Sim.START_X[0], 'A', i));
    const teamB = buildsB.map((b, i) => makeMech(b, uid('B', i), -1, team ? Sim.TEAM_X.B[i] : Sim.START_X[1], 'B', i));
    const A = teamA[0];
    const B = teamB[0];
    A.foe = B;
    B.foe = A;
    // iteration order A, B, A1, B1, A2, B2 (a 1v1 is just [A, B], exactly as before)
    const mechs = [];
    for (let i = 0; i < Math.max(teamA.length, teamB.length); i++) {
      if (teamA[i]) mechs.push(teamA[i]);
      if (teamB[i]) mechs.push(teamB[i]);
    }
    for (const m of mechs) frames[m.side] = [];
    for (const m of mechs) frames['s' + m.side] = [];
    const enemiesOf = (m) => (m.team === 'A' ? teamB : teamA);
    const alliesOf = (m) => (m.team === 'A' ? teamA : teamB);

    // ---------- team targeting (team bouts only) ----------
    function pickTarget(m) {
      const foes = enemiesOf(m).filter((f) => !f.ko);
      if (!foes.length) return null;
      const style = m.build.unitTarget || 'nearest';
      if (style === 'focus') {
        const lead = alliesOf(m).find((u) => !u.ko && u !== m);
        if (lead && lead.idx < m.idx && lead.foe && !lead.foe.ko) return lead.foe;
      }
      if (style === 'lead') {
        const ld = foes.find((f) => f.idx === 0);
        if (ld) return ld;
      }
      if (style === 'weakest') {
        let best = null, bf = 9;
        for (const f of foes) {
          const c = f.parts.chassis;
          const fr = c ? c.hp / c.max : 1;
          if (fr < bf - 1e-9) {
            bf = fr;
            best = f;
          }
        }
        if (best) return best;
      }
      let best = null, bd = 1e9;
      for (const f of foes) {
        const d = Math.abs(f.x - m.x) + 6 * Math.abs(f.lane - m.lane);
        if (d < bd - 1e-9) {
          bd = d;
          best = f;
        }
      }
      return best;
    }
    function ensureTarget(m) {
      if (!team || m.ko) return;
      if (m.foe && !m.foe.ko && t < m.retargetT) return;
      m.retargetT = t + 1.5;
      const nf = pickTarget(m);
      if (nf && nf !== m.foe) {
        m.foe = nf;
        m.pref = prefDist(m);
        emit({ type: 'target', src: m.side, dst: nf.side });
      }
    }

    // ---------- derived mobility ----------
    function updateMob(m) {
      const st = m.st;
      const legs = m.parts.legs;
      let speed = st.speed, eva = st.eva, acc = st.acc, crit = st.crit;
      let offBalance = false, stumbleRate = 0, grounded = false;
      const jetsAlive = !!(st.util.jets && alive(m, st.util.jets.key));
      if (st.util.jets && !jetsAlive) eva = Math.max(0, eva - st.util.jets.eva);
      if (!legs || legs.destroyed) {
        grounded = true;
        speed = jetsAlive ? 0.55 : 0.12;
        eva = jetsAlive ? eva * 0.4 : 0;
        acc -= 8;
      } else if (legs.limbsLost > 0) {
        if (st.legsType === 'quad') {
          if (legs.limbsLost >= 2) {
            speed *= 0.75;
            eva *= 0.8;
          }
          if (legs.limbsLost >= 3) offBalance = true;
        } else offBalance = true;
        if (offBalance) {
          if (st.stable) {
            speed *= 0.75;
            eva *= 0.7;
            acc -= 4;
          } else {
            speed *= 0.45;
            eva *= 0.35;
            acc -= 12;
            stumbleRate = 0.14;
          }
          if (jetsAlive) {
            speed = Math.max(speed, st.speed * 0.85);
            stumbleRate *= 0.5;
          }
        }
      }
      const head = m.parts.head;
      m.targeting = st.targeting;
      if (head && head.destroyed) {
        acc -= 25 + (head.def.head.acc || 0);
        crit -= head.def.head.crit || 0;
        m.targeting = 'random';
      }
      m.mob = { speed, eva: Math.max(0, eva), acc, crit: Math.max(0, crit), offBalance, stumbleRate, grounded };
    }

    function prefDist(m) {
      const ws = m.weapons.filter((w) => weaponAlive(m, w));
      if (!ws.length) return 60;
      let sum = 0, wsum = 0, meleeW = 0, total = 0, minReach = 999;
      for (const w of ws) {
        let v = (w.dmg * w.pellets * w.burst) / (w.cd + w.charge);
        if (w.melee) {
          v *= 1.25;
          meleeW += v;
          minReach = Math.min(minReach, w.reach);
        }
        total += v;
        sum += (w.melee ? w.reach - 14 + m.size + m.foe.size : w.opt) * v;
        wsum += v;
      }
      if (m.st.flags.rush) meleeW += total * 0.3;
      if (meleeW / total > 0.4) return Math.max(MIN_SEP + 4 + m.size + m.foe.size, minReach - 14 + m.size + m.foe.size);
      return U.clamp(sum / wsum, 40, 300);
    }

    // ---------- targeting ----------
    function chooseTarget(m, foe, w, exclude) {
      const cands = foe.list.filter((p) => !p.destroyed && (!exclude || !exclude.has(p.key)));
      if (!cands.length) return null;
      const style = m.targeting;
      let weakest = null;
      if (style === 'weakest') for (const p of cands) if (!weakest || p.hp / p.max < weakest.hp / weakest.max) weakest = p;
      return rng.weighted(cands, (p) => {
        const cat = P.slotCat(p.slot);
        let wgt = EXPOSURE[cat] || 10;
        if (w) {
          if (style === 'weapons' && (p.def.weapon || p.def.mirror)) wgt *= 2.2;
          if (style === 'legs' && cat === 'legs') wgt *= 3;
          if (style === 'core' && cat === 'chassis') wgt *= 2;
          if (style === 'weakest' && p === weakest) wgt *= 4;
          if (w.bias === 'core' && cat === 'chassis') wgt *= 2;
          if (w.bias === 'top' && (cat === 'head' || cat === 'mount')) wgt *= 2.5;
        }
        return wgt;
      });
    }

    function mostDamaged(m) {
      let best = null, bestScore = 0;
      for (const p of m.list) {
        if (p.destroyed || p.hp >= p.max) continue;
        let score = 1 - p.hp / p.max;
        if (p.slot === 'chassis' && p.hp / p.max < 0.6) score += 0.5;
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      return best;
    }

    const dynMult = (m) => (1 + m.st.flags.spite * m.lost) * (m.phase === 2 ? 1.1 : 1) * (t < m.buffDmgUntil ? 1.5 : 1);

    // ---------- damage ----------
    function healPart(m, part, amt, why) {
      if (!part || part.destroyed || m.ko) return 0;
      const h = Math.min(Math.round(amt), part.max - part.hp);
      if (h <= 0) return 0;
      part.hp += h;
      m.stats.healed += h;
      emit({ type: 'heal', dst: m.side, part: part.key, amt: h, why, hp: part.hp });
      return h;
    }

    function stumble(m, dur) {
      if (t < m.stumbleUntil || m.ko) return;
      m.stumbleUntil = t + dur;
      emit({ type: 'stumble', dst: m.side, dur });
    }

    function addBurn(src, dst, part, wkey) {
      if (dst.st.flags.burnImmune || part.destroyed) return;
      const dps = 2.0 * src.st.dmgMult.fire;
      const until = t + 4;
      const ex = dst.burns.find((b) => b.part === part.key);
      if (ex) {
        ex.until = until;
        ex.dps = Math.max(ex.dps, dps);
      } else dst.burns.push({ part: part.key, dps, until, acc: 0, src, wkey });
      emit({ type: 'burn', dst: dst.side, part: part.key, until: Math.round(until * 100) / 100 });
    }

    function destroyPart(m, part, by, how) {
      if (part.destroyed) return;
      part.destroyed = true;
      part.hp = 0;
      if (part.limbs) part.limbsLost = part.limbs;
      m.lost++;
      const ps = m.stats.parts[part.key];
      ps.destroyed = true;
      ps.at = Math.round(t * 100) / 100;
      ps.how = how;
      if (by && by !== m) by.stats.partsDestroyed++;
      emit({ type: 'destroy', dst: m.side, part: part.key, how });
      if (part.slot === 'chassis') {
        m.ko = true;
        return;
      }
      // Scrap Golem frames absorb every wrecked part
      for (const g of mechs) {
        if (!g.st.flags.golem || g.ko || g.golem >= 10) continue;
        g.golem++;
        g.golemArmor += 0.5;
        const ch = g.parts.chassis;
        ch.max += 6;
        ch.hp += 6;
        g.stats.parts.chassis.max = ch.max;
        emit({ type: 'golem', dst: g.side, n: g.golem, hp: ch.hp, max: ch.max });
      }
      if (m.st.util.shield && part.key === m.st.util.shield.key) m.shield = 0;
      if (by && by !== m && by.st.flags.magnet && !by.ko) healPart(by, by.parts.chassis, by.st.flags.magnet, 'magnet');
      updateMob(m);
      if (!m.disarmed && !m.weapons.some((w) => !w.ram && weaponAlive(m, w))) {
        m.disarmed = true;
        m.weapons.push({
          partKey: 'ram', id: 'ram', name: P.t('Desperate Headbutt'), type: 'melee', vfx: 'ram', dmg: 4 + m.st.armor, cd: 1.6,
          range: [0, 52], opt: 40, reach: 52, melee: true, acc: 0, burst: 1, burstGap: 0, pellets: 1, splash: 0, chain: 0,
          pierce: 0, burn: 0, slow: 0, knock: 12, stagger: 0, rip: 0, bias: null, charge: 0, falloff: false, vending: false,
          coreBonus: 0, ram: true, timer: 0.8,
        });
        m.stats.weapons.ram = newWeaponStats(P.t('Desperate Headbutt'), 'melee');
        emit({ type: 'disarm', dst: m.side });
      }
      m.pref = prefDist(m);
    }

    function applyDamage(src, dst, part, raw, type, o) {
      o = o || {};
      if (!part || part.destroyed || dst.ko) return 0;
      let dmg = raw;
      if (type !== 'burn' && type !== 'self') {
        if (t < dst.frozenUntil) dmg *= 1.25;
        if (dst.tshield >= 1) {
          const ab = Math.min(dst.tshield, dmg);
          dst.tshield -= ab;
          dmg -= ab;
          dst.stats.absorbed += ab;
          emit({ type: 'absorb', src: src.side, dst: dst.side, part: part.key, amt: Math.max(1, Math.round(ab)), id: o.id, left: Math.round(dst.tshield) });
          if (dmg < 0.5) return 0;
        }
        const sh = dst.st.util.shield;
        if (dst.shield >= 1 && sh && working(dst, sh.key)) {
          const ab = Math.min(dst.shield, dmg);
          dst.shield -= ab;
          dmg -= ab;
          dst.shieldHitT = t;
          dst.stats.absorbed += ab;
          emit({ type: 'absorb', src: src.side, dst: dst.side, part: part.key, amt: Math.max(1, Math.round(ab)), id: o.id, left: Math.round(dst.shield) });
          if (dmg < 0.5) return 0;
        }
        const tf = P.DMG_TYPES[type] ? P.DMG_TYPES[type].armor : 1;
        const armor = Math.max(0, dst.st.armor + dst.golemArmor - dst.corrode) + part.armor;
        const eff = armor * tf * (1 - (o.pierce || 0));
        dmg *= 1 - eff / (eff + 12);
      }
      dmg = Math.max(1, Math.round(dmg));
      if (dmg >= part.hp && !part.lucky && dst.st.luck > 0 && rng() < dst.st.luck * 0.004) {
        part.lucky = true;
        dmg = part.hp - 1;
        emit({ type: 'lucky', dst: dst.side, part: part.key });
        if (dmg <= 0) return 0;
      }
      const real = Math.min(dmg, part.hp);
      part.hp -= real;
      const ps = dst.stats.parts[part.key];
      ps.dmgTaken += real;
      ps.hits++;
      dst.stats.dmgTaken += real;
      if (type !== 'self') {
        src.stats.dmgDealt += real;
        const ws = o.wkey && src.stats.weapons[o.wkey];
        if (ws) ws.dmg += real;
      }
      emit({ type: 'hit', src: src.side, dst: dst.side, part: part.key, dmg, crit: !!o.crit, dtype: type, hp: part.hp, id: o.id, sec: o.secondary ? 1 : 0, from: o.chainFrom });
      if (part.limbs > 1 && part.hp > 0) {
        const lost = Math.min(part.limbs - 1, Math.floor((1 - part.hp / part.max) * part.limbs + 1e-6));
        while (part.limbsLost < lost) {
          part.limbsLost++;
          emit({ type: 'limb', dst: dst.side, part: part.key, n: part.limbsLost });
          updateMob(dst);
          dst.pref = prefDist(dst);
        }
      }
      if (part.hp <= 0) {
        // Phoenix Core: the chassis refuses to die (once)
        if (part.slot === 'chassis' && dst.st.flags.phoenix && !dst.phoenixUsed) {
          dst.phoenixUsed = true;
          part.hp = Math.round(part.max * 0.4);
          emit({ type: 'phoenix', dst: dst.side, hp: part.hp });
          const foe = dst.foe;
          for (const p of foe.list.slice()) {
            if (p.destroyed || foe.ko) continue;
            applyDamage(dst, foe, p, 7 * dst.st.dmgMult.fire, 'fire', { secondary: true, wkey: 'phoenix' });
          }
          const burnable = foe.list.filter((p) => !p.destroyed);
          for (let i = 0; i < 2 && burnable.length && !foe.ko; i++) addBurn(dst, foe, rng.pick(burnable), 'phoenix');
          return real;
        }
        destroyPart(dst, part, src, type === 'burn' ? 'burn' : 'dmg');
      }
      return real;
    }

    // ---------- attacks ----------
    function fireShot(m, w) {
      if (m.ko || ended || m.foe.ko || !weaponAlive(m, w) || incap(m) || (!w.mimic && jammed(m, w.partKey))) return;
      const foe = m.foe;
      const d = Math.abs(foe.x - m.x);
      for (let i = 0; i < w.pellets; i++) {
        const target = chooseTarget(m, foe, w);
        if (!target) return;
        let travel = (TRAVEL[w.vfx] || TRAVEL.bullet)(d) + (w.charge || 0) + (w.pellets > 1 ? rng.range(0, 0.04) : 0);
        if (w.vfx === 'swarm') travel += rng.range(0, 0.25);
        const id = ++shotId;
        const ev = { type: 'fire', src: m.side, part: w.partKey, vfx: w.vfx, wtype: w.type, target: target.key, impactT: Math.round((t + travel) * 1000) / 1000, id, pellet: w.pellets > 1 ? i : undefined, charge: w.charge || undefined };
        if (team) ev.dst = foe.side;
        if (w.mine) ev.mx = Math.round(U.clamp(foe.x - m.dir * rng.range(10, 26), Sim.BOUNDS[0], Sim.BOUNDS[1]));
        if (w.ret) {
          ev.retT = Math.round((t + travel * 2 + 0.15) * 1000) / 1000;
          ev.id2 = ++shotId;
        }
        emit(ev);
        m.stats.shots++;
        m.stats.weapons[w.partKey].shots++;
        pendingImpacts.push({ t: t + travel, m, w, targetKey: target.key, id, mx: ev.mx, foe });
        if (w.ret) pendingImpacts.push({ t: ev.retT, m, w, targetKey: null, id: ev.id2, ret: true, foe });
      }
    }

    function landMine(imp) {
      const m = imp.m;
      m.mines.push({ id: imp.id, x: imp.mx, armT: t + 0.4, w: imp.w });
      emit({ type: 'mine', src: m.side, id: imp.id, x: imp.mx });
      while (m.mines.length > 3) {
        const old = m.mines.shift();
        emit({ type: 'mineGone', src: m.side, id: old.id });
      }
    }

    function tickMinesTeam(m) {
      if (!m.mines.length || m.ko) return;
      for (const mine of m.mines.slice()) {
        if (t - mine.armT > 25) {
          m.mines.splice(m.mines.indexOf(mine), 1);
          emit({ type: 'mineGone', src: m.side, id: mine.id });
          continue;
        }
        if (t < mine.armT) continue;
        const foe = enemiesOf(m).find((f) => !f.ko && !(f.parts.legs && !f.parts.legs.destroyed && f.st.legsType === 'hover') && Math.abs(f.x - mine.x) <= 9 + f.size);
        if (!foe) continue;
        m.mines.splice(m.mines.indexOf(mine), 1);
        emit({ type: 'mineBoom', src: m.side, dst: foe.side, id: mine.id, x: mine.x });
        const w = mine.w;
        const target = alive(foe, 'legs') ? foe.parts.legs : foe.parts.chassis;
        const ws = m.stats.weapons[w.partKey];
        if (ws) ws.hits++;
        m.stats.hits++;
        applyDamage(m, foe, target, w.dmg * dynMult(m), 'explosive', { wkey: w.partKey, id: mine.id });
        if (foe.ko) continue;
        if (target.slot === 'legs') applyDamage(m, foe, foe.parts.chassis, w.dmg * 0.4 * dynMult(m), 'explosive', { secondary: true, wkey: w.partKey, id: mine.id });
        if (!foe.ko && rng() < w.stagger * (foe.st.stable ? 0.4 : 1)) stumble(foe, 1.0);
      }
    }

    function tickMines(m) {
      if (team) return tickMinesTeam(m);
      const foe = m.foe;
      if (!m.mines.length || foe.ko || m.ko) return;
      const hovering = foe.parts.legs && !foe.parts.legs.destroyed && foe.st.legsType === 'hover';
      for (const mine of m.mines.slice()) {
        if (t - mine.armT > 25) {
          m.mines.splice(m.mines.indexOf(mine), 1);
          emit({ type: 'mineGone', src: m.side, id: mine.id });
          continue;
        }
        if (t < mine.armT || hovering || Math.abs(foe.x - mine.x) > 9 + foe.size) continue;
        m.mines.splice(m.mines.indexOf(mine), 1);
        emit({ type: 'mineBoom', src: m.side, id: mine.id, x: mine.x });
        const w = mine.w;
        const target = alive(foe, 'legs') ? foe.parts.legs : foe.parts.chassis;
        const ws = m.stats.weapons[w.partKey];
        if (ws) ws.hits++;
        m.stats.hits++;
        applyDamage(m, foe, target, w.dmg * dynMult(m), 'explosive', { wkey: w.partKey, id: mine.id });
        if (foe.ko) return;
        if (target.slot === 'legs') applyDamage(m, foe, foe.parts.chassis, w.dmg * 0.4 * dynMult(m), 'explosive', { secondary: true, wkey: w.partKey, id: mine.id });
        if (!foe.ko && rng() < w.stagger * (foe.st.stable ? 0.4 : 1)) stumble(foe, 1.0);
      }
    }

    const CHAMBERS = ['blank', 'normal', 'ricochet', 'golden', 'explosive', 'fan'];

    function resolveImpact(imp) {
      const m = imp.m, w = imp.w, foe = imp.foe || m.foe;
      if (ended || m.ko || foe.ko) return;
      const ws = m.stats.weapons[w.partKey];
      if (w.melee && !weaponAlive(m, w)) return;
      if (w.mine) return landMine(imp);
      let target = imp.targetKey ? foe.parts[imp.targetKey] : null;
      if (!target || target.destroyed) {
        target = chooseTarget(m, foe, w);
        if (!target) return;
      }
      const d = Math.abs(foe.x - m.x);
      const missOut = (reason) => {
        emit({ type: 'miss', src: m.side, dst: foe.side, part: target.key, id: imp.id, reason, vfx: w.vfx });
        m.stats.misses++;
        ws.misses++;
      };
      // Gambler's Revolver: spin the cylinder first
      let chamber = null;
      if (w.chambers) {
        const L = m.st.luck;
        const wt = { blank: Math.max(3, 12 - L * 0.15), normal: 40, ricochet: 16, golden: 9 + L * 0.2, explosive: 12, fan: 3 + L * 0.08 };
        chamber = rng.weighted(CHAMBERS, (k) => wt[k]);
        emit({ type: 'chamber', src: m.side, kind: chamber, id: imp.id });
        if (chamber === 'blank') return missOut('blank');
      }
      if (w.melee && d - m.size - foe.size > w.reach + 12) return missOut('whiff');
      const autoHit = !!w.blind;
      if (!autoHit) {
        const eva = foe.mob.eva * (w.homing ? 0.4 : 1) + (foe.st.flags.adapt ? Math.min(30, 6 * (foe.adapt[m.side + w.partKey] || 0)) : 0);
        const acc = m.mob.acc - (t < m.blindUntil ? 30 : 0);
        let p = (w.melee ? 0.9 : 0.84) + (acc + w.acc - eva) / 100;
        if (incap(foe)) p += 0.3;
        p = U.clamp(p, 0.12, 0.97);
        if (rng() >= p) return missOut('dodge');
        const decoy = foe.st.util.decoy;
        if (!w.melee && !w.homing && !w.hitsAll && decoy && working(foe, decoy.key) && rng() < decoy.chance) return missOut('dazzle');
      }

      let crit = rng() < (m.mob.crit + m.st.luck * 0.3) / 100;
      if (chamber === 'golden') crit = true;
      let dmg = w.dmg * (crit ? (chamber === 'golden' ? 3 : 1.75) : 1) * dynMult(m);
      if (imp.ret) dmg *= 0.8;
      if (w.falloff) dmg *= U.clamp(1.15 - d / 260, 0.35, 1.15);
      if (w.coreBonus && target.slot === 'chassis') dmg *= 1 + w.coreBonus;
      let dtype = w.type;
      let coffee = false;
      let splash = w.splash;
      if (chamber === 'explosive') {
        dtype = 'explosive';
        splash = 0.6;
      }
      if (w.vending) {
        const roll = rng() + m.st.luck * 0.004;
        if (roll > 0.97) {
          emit({ type: 'vend', src: m.side, item: 'jackpot', id: imp.id });
          dmg *= 2.5;
        } else if (roll > 0.74) {
          emit({ type: 'vend', src: m.side, item: 'snack', id: imp.id });
          healPart(m, mostDamaged(m), 9 * (1 + 0.12 * ((m.build.parts[w.partKey] || {}).lvl || 0)), 'snack');
          ws.hits++;
          return;
        } else if (roll > 0.48) {
          emit({ type: 'vend', src: m.side, item: 'coffee', id: imp.id });
          dtype = 'fire';
          coffee = true;
        } else emit({ type: 'vend', src: m.side, item: 'soda', id: imp.id });
      }
      const blk = foe.st.util.block;
      if (!w.hitsAll && blk && working(foe, blk.key) && target.key !== blk.key && rng() < blk.chance) {
        target = foe.parts[blk.key];
        emit({ type: 'block', dst: foe.side, part: blk.key, id: imp.id });
      }
      m.stats.hits++;
      ws.hits++;
      if (crit) {
        m.stats.crits++;
        ws.crits++;
      }
      const opts = { crit, pierce: w.pierce, id: imp.id, wkey: w.partKey };

      if (w.hitsAll) {
        // Sonic / gravity: every part at once
        for (const p of foe.list.slice()) {
          if (p.destroyed || foe.ko) continue;
          applyDamage(m, foe, p, dmg, dtype, Object.assign({}, opts, { secondary: p !== target }));
        }
      } else applyDamage(m, foe, target, dmg, dtype, opts);
      if (foe.ko) return;

      if (splash > 0) {
        const o = chooseTarget(m, foe, null, new Set([target.key]));
        if (o) applyDamage(m, foe, o, dmg * splash, dtype, { secondary: true, pierce: w.pierce, id: imp.id, wkey: w.partKey });
      }
      if (w.chain > 0) {
        const used = new Set([target.key]);
        for (let i = 0; i < w.chain && !foe.ko; i++) {
          const o = chooseTarget(m, foe, null, used);
          if (!o) break;
          used.add(o.key);
          applyDamage(m, foe, o, dmg * 0.4, dtype, { secondary: true, chainFrom: target.key, id: imp.id, wkey: w.partKey });
        }
      }
      const extraHits = (n, frac) => {
        const used = new Set([target.key]);
        for (let i = 0; i < n && !foe.ko; i++) {
          const o = chooseTarget(m, foe, null, used.size < foe.list.filter((p) => !p.destroyed).length ? used : null);
          if (!o) break;
          used.add(o.key);
          applyDamage(m, foe, o, dmg * frac, dtype, { secondary: true, pierce: w.pierce, chainFrom: target.key, id: imp.id, wkey: w.partKey });
        }
      };
      if (w.pierceN) extraHits(w.pierceN, 0.75);
      if (chamber === 'ricochet') extraHits(2, 0.7);
      if (chamber === 'fan') extraHits(5, 0.6);
      if (foe.ko) return;

      if (!target.destroyed) {
        if ((w.burn && (dtype === 'fire' || dtype === 'explosive') && rng() < w.burn) || coffee) addBurn(m, foe, target, w.partKey);
        if (w.slow) {
          foe.slowUntil = t + w.slow;
          emit({ type: 'slow', dst: foe.side, part: target.key, until: Math.round((t + w.slow) * 100) / 100 });
        }
      }
      if (w.corrode && rng() < w.corrode && foe.corrode < foe.st.armor + foe.golemArmor) {
        foe.corrode++;
        emit({ type: 'corrode', dst: foe.side, part: target.key, total: foe.corrode });
      }
      if (w.frost && t > foe.freezeImmune) {
        if (t - foe.frostT > 2.2) foe.frost = 0;
        foe.frost += w.frost;
        foe.frostT = t;
        if (foe.frost >= 4) {
          foe.frost = 0;
          foe.frozenUntil = t + 1.1;
          foe.freezeImmune = t + 6;
          emit({ type: 'freeze', dst: foe.side, dur: 1.1 });
        } else emit({ type: 'frost', dst: foe.side, n: foe.frost });
      }
      if (w.jam) {
        const cands = foe.list.filter((p) => !p.destroyed && (p.slot.startsWith('arm') || p.slot.startsWith('mount')) && (p.def.weapon || p.def.utility || p.def.mirror));
        if (cands.length) {
          const p = rng.pick(cands);
          p.jammedUntil = t + w.jam;
          emit({ type: 'jam', dst: foe.side, part: p.key, until: Math.round(p.jammedUntil * 100) / 100 });
        }
      }
      if (w.blind) {
        foe.blindUntil = t + w.blind;
        emit({ type: 'blind', dst: foe.side, until: Math.round(foe.blindUntil * 100) / 100 });
      }
      if (w.pull) {
        foe.kv -= m.dir * w.pull * 3.2 * (foe.st.stable ? 0.6 : 1);
        emit({ type: 'pull', src: m.side, dst: foe.side, id: imp.id });
      }
      if (w.knock) foe.kv += m.dir * w.knock * 3.2 * (foe.st.stable ? 0.5 : 1);
      if (w.critTopple && crit) stumble(foe, 1.1);
      else if (w.stagger && rng() < w.stagger * (foe.st.stable ? 0.3 : 1)) stumble(foe, 0.9);
      if (w.rip && !target.destroyed && target.slot !== 'chassis' && target.hp / target.max < 0.3 && rng() < w.rip) {
        emit({ type: 'rip', src: m.side, dst: foe.side, part: target.key });
        destroyPart(foe, target, m, 'rip');
      }
      if (w.ripAll) {
        for (const p of foe.list.slice()) {
          if (foe.ko || p.destroyed || p.slot === 'chassis' || p.hp / p.max >= 0.35 || rng() >= w.ripAll) continue;
          emit({ type: 'rip', src: m.side, dst: foe.side, part: p.key });
          destroyPart(foe, p, m, 'rip');
        }
      }
      if (foe.st.flags.adapt && !foe.ko) {
        const k = m.side + w.partKey;
        foe.adapt[k] = (foe.adapt[k] || 0) + 1;
        if (foe.adapt[k] === 1 || foe.adapt[k] === 5) emit({ type: 'adapt', dst: foe.side, n: foe.adapt[k] });
      }
    }

    // ---------- per-tick ----------
    const LOTTO = ['overdrive', 'shield', 'patch', 'turbo', 'dud', 'jackpot'];
    function lottery(m) {
      const L = m.st.luck;
      const wt = { overdrive: 20, shield: 20, patch: 20, turbo: 18, dud: Math.max(4, 22 - L * 0.3), jackpot: 2 + L * 0.08 };
      const prize = rng.weighted(LOTTO, (k) => wt[k]);
      emit({ type: 'lottery', dst: m.side, prize });
      const all = prize === 'jackpot';
      if (all || prize === 'overdrive') m.buffDmgUntil = t + 4;
      if (all || prize === 'turbo') m.buffTurboUntil = t + 4;
      if (all || prize === 'shield') m.tshield = Math.min(60, m.tshield + 20);
      if (all || prize === 'patch') healPart(m, mostDamaged(m), 18, 'lottery');
    }

    function tickStatus(m) {
      if (m.ko) return;
      for (const b of m.burns) {
        const part = m.parts[b.part];
        if (t >= b.until || !part || part.destroyed) {
          b.done = true;
          continue;
        }
        b.acc += DT;
        if (b.acc >= 0.5) {
          b.acc -= 0.5;
          applyDamage(b.src, m, part, b.dps * 0.5, 'burn', { wkey: b.wkey });
          if (m.ko) return;
        }
      }
      m.burns = m.burns.filter((b) => !b.done);
      const sh = m.st.util.shield;
      if (sh && working(m, sh.key) && t - m.shieldHitT > 1.5 && m.shield < sh.cap) m.shield = Math.min(sh.cap, m.shield + sh.regen * DT);
      const rp = m.st.util.repair;
      if (rp && working(m, rp.key)) {
        m.repairT -= DT;
        if (m.repairT <= 0) {
          m.repairT = rp.interval;
          const tgt = mostDamaged(m);
          if (tgt) healPart(m, tgt, rp.amount, 'drone');
        }
      }
      // pilot quirk: a mechanic patches the most damaged part every 4s
      if (m.st.flags.mechanic) {
        m.mechT -= DT;
        if (m.mechT <= 0) {
          m.mechT = 4;
          const tgt = mostDamaged(m);
          if (tgt) healPart(m, tgt, m.st.flags.mechanic, 'mechanic');
        }
      }
      // Pit Crew facility: one emergency pit stop per bout when the chassis gets low
      if (m.build.pitStop && !m.pitUsed && m.parts.chassis.hp / m.parts.chassis.max < 0.35) {
        m.pitUsed = true;
        healPart(m, m.parts.chassis, m.parts.chassis.max * m.build.pitStop, 'pit');
      }
      if (m.st.flags.reactor) {
        m.reactorT -= DT;
        if (m.reactorT <= 0) {
          m.reactorT = 3;
          applyDamage(m, m, m.parts.chassis, 1, 'self');
          if (m.ko) return;
        }
      }
      if (m.st.flags.lottery) {
        m.lotteryT -= DT;
        if (m.lotteryT <= 0) {
          m.lotteryT = 9;
          lottery(m);
        }
      }
      tickMines(m);
      if (team) ensureTarget(m);
      if (m.ko || m.foe.ko) return;
      if (m.mob.stumbleRate > 0 && t >= m.stumbleUntil + 0.8 && rng() < m.mob.stumbleRate * DT) stumble(m, 1.2);
      if ((m.build.boss || m.st.flags.phase2) && m.phase === 1) {
        const ch = m.parts.chassis;
        if (ch.hp / ch.max < 0.5) {
          m.phase = 2;
          emit({ type: 'phase', dst: m.side });
        }
      }
      const ch = m.parts.chassis;
      if (!m.lowWarned && ch.hp / ch.max < 0.25) {
        m.lowWarned = true;
        emit({ type: 'lowhp', dst: m.side });
      }
    }

    function tickMove(m) {
      if (m.ko) return;
      const foe = m.foe;
      let v = 0;
      if (!incap(m)) {
        const d = Math.abs(foe.x - m.x);
        const toward = Math.sign(foe.x - m.x) || m.dir;
        const spd = 26 * m.mob.speed * (t < m.slowUntil ? 0.7 : 1) * (m.phase === 2 ? 1.3 : 1) * (t < m.buffTurboUntil ? 1.5 : 1);
        if (d > m.pref + 8) v = toward * spd;
        else if (d < m.pref - 8) v = -toward * spd * 0.8;
        else {
          m.shuffleT -= DT;
          if (m.shuffleT <= 0) {
            m.shuffleT = rng.range(0.8, 2.2);
            m.shuffleDir = rng() < 0.5 ? (rng() < 0.5 ? -1 : 1) : 0;
          }
          v = m.shuffleDir * spd * 0.35;
        }
        // Rocket Skates: slam into the enemy on arrival
        if (m.st.flags.rush && alive(m, 'legs') && t >= m.rushT && !foe.ko && d <= MIN_SEP + m.size + foe.size + 6) {
          m.rushT = t + 3;
          const target = chooseTarget(m, foe, null);
          if (target) {
            emit({ type: 'rush', src: m.side, dst: foe.side, part: target.key });
            m.stats.weapons.rush.shots++;
            m.stats.weapons.rush.hits++;
            m.stats.hits++;
            applyDamage(m, foe, target, m.st.flags.rush * dynMult(m), 'melee', { wkey: 'rush' });
            foe.kv += m.dir * 40 * 3.2 * (foe.st.stable ? 0.5 : 1);
            if (!foe.ko && rng() < 0.2 * (foe.st.stable ? 0.3 : 1)) stumble(foe, 0.9);
          }
        }
      }
      m.x += (v + m.kv) * DT;
      m.kv *= 0.86;
      if (Math.abs(m.kv) < 1) m.kv = 0;
      m.x = U.clamp(m.x, Sim.BOUNDS[0], Sim.BOUNDS[1]);
    }

    function separateTeams() {
      for (let pass = 0; pass < 2; pass++) {
        for (const a of teamA) {
          for (const b of teamB) {
            const minSep = a.lane === b.lane ? MIN_SEP + a.size + b.size : LANE_SEP;
            const gap = b.x - a.x;
            if (gap >= minSep) continue;
            const push = (minSep - gap) / 2;
            a.x -= push;
            b.x += push;
            if (a.x < Sim.BOUNDS[0]) {
              a.x = Sim.BOUNDS[0];
              b.x = a.x + minSep;
            }
            if (b.x > Sim.BOUNDS[1]) {
              b.x = Sim.BOUNDS[1];
              a.x = b.x - minSep;
            }
          }
        }
      }
    }

    function separate() {
      if (team) return separateTeams();
      const gap = B.x - A.x;
      const minSep = MIN_SEP + A.size + B.size;
      if (gap < minSep) {
        const push = (minSep - gap) / 2;
        A.x -= push;
        B.x += push;
        if (A.x < Sim.BOUNDS[0]) {
          A.x = Sim.BOUNDS[0];
          B.x = A.x + minSep;
        }
        if (B.x > Sim.BOUNDS[1]) {
          B.x = Sim.BOUNDS[1];
          A.x = B.x - minSep;
        }
      }
    }

    function tickWeapons(m) {
      if (m.ko || incap(m)) return;
      const d = Math.abs(m.foe.x - m.x);
      const rate = (t < m.slowUntil ? 1 / 1.25 : 1) * (m.phase === 2 ? 1.25 : 1) * (t < m.buffTurboUntil ? 1.5 : 1);
      for (const w of m.weapons) {
        if (!weaponAlive(m, w) || (!w.mimic && !w.ram && jammed(m, w.partKey))) continue;
        w.timer -= DT * rate;
        if (w.timer > 0) continue;
        const inRange = w.melee ? d - m.size - m.foe.size <= w.reach : d >= w.range[0] && d <= w.range[1];
        if (!inRange) {
          w.timer = 0;
          continue;
        }
        let cd = w.cd;
        if (w.spinup) {
          if (t - w.lastFire > 1.6) w.spin = 0;
          w.spin = Math.min(w.spinup.steps, w.spin + 1);
          cd *= U.lerp(1, w.spinup.min, w.spin / w.spinup.steps);
        }
        w.lastFire = t;
        w.timer = cd * rng.range(0.92, 1.08) + w.charge;
        for (let b = 0; b < w.burst; b++) pendingFires.push({ t: t + b * w.burstGap, m, w });
      }
    }

    const teamDown = (tm) => tm.every((u) => u.ko);
    function checkEnd() {
      if (ended) return true;
      if (team) {
        const da = teamDown(teamA), db = teamDown(teamB);
        if (!da && !db) return false;
        const winner = da ? 'B' : 'A';
        ended = { winner, reason: 'ko' };
        emit({ type: 'end', winner, reason: 'ko' });
        return true;
      }
      if (A.ko || B.ko) {
        const winner = A.ko && B.ko ? 'B' : A.ko ? 'B' : 'A';
        ended = { winner, reason: 'ko' };
        emit({ type: 'end', winner, reason: 'ko' });
        return true;
      }
      return false;
    }

    const hpFrac = (m) => {
      let a = 0, b = 0;
      for (const p of m.list) {
        a += p.hp;
        b += p.max;
      }
      return b ? a / b : 0;
    };
    const teamHpFrac = (tm) => {
      let a = 0, b = 0;
      for (const m of tm) for (const p of m.list) {
        a += p.hp;
        b += p.max;
      }
      return b ? a / b : 0;
    };
    const teamDmg = (tm) => tm.reduce((s, m) => s + m.stats.dmgDealt, 0);

    // ---------- main loop ----------
    for (const m of mechs) {
      updateMob(m);
      for (const w of m.weapons) w.timer = w.cd * rng.range(0.25, 0.9) + 0.5;
    }
    emit({ type: 'start' });
    // Mimic Module: copy the opponent's best weapon at the bell
    if (team) for (const m of mechs) ensureTarget(m);
    const originals = {};
    for (const m of mechs) originals[m.side] = m.weapons.slice();
    for (const m of mechs) {
      if (!m.st.flags.mimic) continue;
      let best = null, bestV = 0;
      for (const w of originals[m.foe.side]) {
        const v = (w.dmg * w.pellets * w.burst) / (w.cd + w.charge);
        if (v > bestV) {
          bestV = v;
          best = w;
        }
      }
      if (!best) continue;
      const copy = Object.assign({}, best, { partKey: 'mimic', mimic: true, name: P.t('Mimic: {name}', { name: best.name }), dmg: best.dmg * 0.8, timer: best.cd * 0.6 + 0.8, spin: 0, lastFire: -9 });
      m.weapons.push(copy);
      m.stats.weapons.mimic = newWeaponStats(copy.name, copy.type);
      emit({ type: 'mimic', src: m.side, name: best.name, vfx: best.vfx, wid: best.id });
    }
    for (const m of mechs) m.pref = prefDist(m);

    const steps = Math.round(maxT / DT);
    let step = 0;
    for (step = 0; step <= steps; step++) {
      t = step * DT;
      for (const m of mechs) tickStatus(m);
      if (!checkEnd()) {
        for (const m of mechs) tickMove(m);
        separate();
        checkEnd();
        if (!ended) for (const m of mechs) tickWeapons(m);
        if (!ended && pendingFires.length) {
          const due = pendingFires.filter((f) => f.t <= t + 1e-9);
          if (due.length) {
            pendingFires = pendingFires.filter((f) => f.t > t + 1e-9);
            for (const f of due) fireShot(f.m, f.w);
          }
        }
        if (!ended && pendingImpacts.length) {
          const due = pendingImpacts.filter((f) => f.t <= t + 1e-9).sort((a, b) => a.t - b.t || a.id - b.id);
          if (due.length) {
            pendingImpacts = pendingImpacts.filter((f) => f.t > t + 1e-9);
            for (const imp of due) {
              resolveImpact(imp);
              if (checkEnd()) break;
            }
          }
        }
        checkEnd();
      }
      for (const m of mechs) frames[m.side].push(Math.round(m.x * 10) / 10);
      for (const m of mechs) frames['s' + m.side].push(Math.round(m.shield + m.tshield));
      if (step % 30 === 0) timeline.push([Math.round(t), teamDmg(teamA), teamDmg(teamB)]);
      if (ended) break;
    }
    if (!ended) {
      const fa = team ? teamHpFrac(teamA) : hpFrac(A), fb = team ? teamHpFrac(teamB) : hpFrac(B);
      const winner = Math.abs(fa - fb) < 0.005 ? (rng() < 0.5 ? 'A' : 'B') : fa > fb ? 'A' : 'B';
      ended = { winner, reason: 'time', fa, fb };
      emit({ type: 'end', winner, reason: 'time', fa: Math.round(fa * 1000) / 1000, fb: Math.round(fb * 1000) / 1000 });
    }
    timeline.push([Math.round(t * 10) / 10, teamDmg(teamA), teamDmg(teamB)]);

    const snap = (m) => {
      const o = {};
      for (const p of m.list) {
        o[p.key] = { hp: p.hp, max: p.max, destroyed: p.destroyed, limbsLost: p.limbsLost };
        m.stats.parts[p.key].hpEnd = p.hp;
      }
      return o;
    };
    const final = {};
    const stats = {};
    const partNames = {};
    for (const m of mechs) {
      final[m.side] = snap(m);
      stats[m.side] = m.stats;
      partNames[m.side] = Object.fromEntries(m.list.map((p) => [p.key, p.name]));
    }
    const out = {
      version: Sim.VERSION,
      seed: cfg.seed >>> 0,
      dt: DT,
      duration: Math.round(t * 1000) / 1000,
      winner: ended.winner,
      reason: ended.reason,
      events,
      frames,
      timeline,
      final,
      hpFrac: { A: team ? teamHpFrac(teamA) : hpFrac(A), B: team ? teamHpFrac(teamB) : hpFrac(B) },
      stats,
      partNames,
    };
    if (team) {
      out.team = true;
      out.units = mechs.map((m) => ({ id: m.side, team: m.team, idx: m.idx, ko: m.ko }));
      out.teamStats = {};
      for (const [k, tm] of [['A', teamA], ['B', teamB]]) {
        const s = { dmgDealt: 0, dmgTaken: 0, shots: 0, hits: 0, misses: 0, crits: 0, partsDestroyed: 0, healed: 0, absorbed: 0 };
        for (const m of tm) for (const key in s) s[key] += m.stats[key];
        out.teamStats[k] = s;
      }
    }
    return out;
  };
  // Unit ids of one team in a sim result (works for 1v1 and team bouts)
  Sim.unitsOf = (sim, tm) => (sim.units ? sim.units.filter((u) => u.team === tm).map((u) => u.id) : [tm]);
})();
