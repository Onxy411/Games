// Headless smoke test: data integrity + sim invariants + a full scripted campaign run.
//   node tools/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const store = {};
const ctx = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Boolean, Infinity, NaN, isFinite, parseInt, parseFloat };
ctx.window = ctx;
ctx.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
vm.createContext(ctx);
for (const f of ['src/core/util.js', 'src/core/i18n.js', 'src/data/sprites.js', 'src/data/sprites_ext.js', 'src/data/parts.js', 'src/data/parts_ext.js', 'src/data/campaign.js', 'src/data/facilities.js', 'src/data/chapter2.js', 'src/data/lang_vi.js', 'src/data/lang_vi_content.js', 'src/game/stats.js', 'src/game/loot.js', 'src/game/opponents.js', 'src/game/state.js', 'src/battle/sim.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const P = ctx.PTP;
let fails = 0;
const check = (cond, msg) => {
  if (!cond) {
    fails++;
    console.log('FAIL:', msg);
  }
};

// ---- data integrity ----
for (const [id, d] of Object.entries(P.PARTS)) {
  check(P.RARITY[d.rarity], `${id}: bad rarity`);
  check(P.CATS[d.cat], `${id}: bad category`);
  for (const key of [d.sprite, d.trinket, ...(d.spriteFrames || [])].filter(Boolean)) check(P.SPRITES[key], `${id}: missing sprite ${key}`);
  if (d.cat !== 'module') check(d.sprite, `${id}: visible part has no sprite`);
  for (const t of d.tags || []) check(P.SYNERGIES[t], `${id}: unknown tag ${t}`);
  if (d.weapon) check(d.weapon.cd > 0 && d.weapon.dmg > 0, `${id}: weapon needs dmg/cd`);
}
for (const [eid, e] of Object.entries(P.ENEMIES)) for (const [k, it] of Object.entries(e.parts || {})) check(P.PARTS[it.id] && P.slotCat(k) === P.PARTS[it.id].cat, `enemy ${eid}: bad part ${k}=${it.id}`);
for (const b of P.CHAPTER1.bouts) {
  check(P.ENEMIES[b.enemy], `bout ${b.id}: unknown enemy`);
  check(P.ARENAS[b.arena], `bout ${b.id}: unknown arena`);
}
for (const b of P.BLUEPRINTS) check(P.PARTS[b.id] && P.PARTS[b.id].blueprint && P.PARTS[b.id].noLoot, 'blueprint ' + b.id + ' must be a noLoot prototype');
for (const v of P.VENTURES) check(v.crash && v.boom && v.name, 'venture ' + v.id + ' malformed');
// fusion sanity
{
  const ins = [{ id: 'rivet_gun', lvl: 2 }, { id: 'claw_x', lvl: 0 }].length;
  const sample = [{ id: 'rivet_gun', lvl: 2 }, { id: 'hydraulic_claw', lvl: 1 }, { id: 'plunger_launcher', lvl: 0 }];
  const o = P.Loot.fuseOdds(sample, 10);
  const tot = Object.values(o.probs).reduce((a, b) => a + b, 0);
  check(Math.abs(tot - 1) < 1e-6, 'fuse odds must sum to 1');
  check(o.catBias && o.catBias.cat === 'arm', 'three arms should bias toward arms');
  for (let i = 0; i < 300; i++) {
    const r = P.Loot.fuse(sample, i % 40);
    check(P.PARTS[r.item.id] && !P.PARTS[r.item.id].noLoot, 'fuse produced invalid item ' + r.item.id);
  }
  void ins;
}
for (const id of P.Loot.JUNK_BIN) check(P.PARTS[id], `junk bin ${id} unknown`);
for (const [k, s] of Object.entries(P.SPRITES)) check(Array.isArray(s.rows) && s.rows.length && s.pivot, `sprite ${k} malformed`);

// ---- loot sanity ----
for (let i = 0; i < 500; i++) {
  const it = P.Loot.rollItem({ luck: i % 60, tier: i % 4 });
  check(P.PARTS[it.id] && !P.PARTS[it.id].noLoot, 'loot rolled invalid/noLoot item ' + it.id);
  if (it.mod) check(P.MODS[it.mod], 'bad mod ' + it.mod);
}
check(P.Loot.shopStock(2).length === 6, 'shop stock size');

// ---- sim invariants ----
const starter = () => {
  P.State.newGame();
  const rk = P.State.d.inventory.find((i) => i.id === 'bottle_rockets');
  P.State.equip('mount0', rk.uid);
  return P.State.build();
};
for (const b of P.CHAPTER1.bouts) {
  const A = starter();
  const B = P.State.boutBuild(b, false);
  for (let s = 0; s < 20; s++) {
    const r = P.Sim.run({ seed: 77 + s, A, B });
    let lastT = -1, ok = true;
    for (const e of r.events) {
      if (e.t < lastT - 1e-9) ok = false;
      lastT = e.t;
      if (e.type === 'hit' && (!Number.isFinite(e.dmg) || e.dmg < 1)) ok = false;
    }
    check(ok, `bout ${b.id} seed ${s}: events out of order or bad damage`);
    check(r.winner === 'A' || r.winner === 'B', 'winner missing');
    check(r.events[r.events.length - 1].type === 'end', 'last event must be end');
    check(r.frames.A.every(Number.isFinite) && r.frames.B.every(Number.isFinite), 'NaN positions');
    check(r.frames.A.every((x, i) => r.frames.B[i] - x >= 33.9), 'mechs crossed/overlapped');
  }
}

// ---- facilities / opponents / repairs data ----
for (const f of P.FACILITIES) {
  check(f.levels.length === 3 && f.levels.every((l, i) => l.cost > 0 && (!i || l.cost > f.levels[i - 1].cost)), `facility ${f.id}: 3 levels with rising cost`);
}
for (const [eid, pool] of Object.entries(P.ENEMY_POOLS)) {
  check(P.ENEMIES[eid], `pool ${eid}: unknown enemy`);
  for (const [slot, list] of Object.entries(pool.slots)) {
    for (const entry of list) {
      if (entry === null) continue;
      const id = entry.split('@')[0];
      check(P.PARTS[id] && P.slotCat(slot) === P.PARTS[id].cat, `pool ${eid}: ${slot}=${entry} does not fit`);
    }
  }
}
// every rolled build is legal and deterministic
for (const b of P.CHAPTER1.bouts) {
  for (let s = 0; s < 60; s++) {
    const r1 = P.Opponents.roll(b.enemy, b.tier, 9000 + s);
    const r2 = P.Opponents.roll(b.enemy, b.tier, 9000 + s);
    check(JSON.stringify(r1) === JSON.stringify(r2), `${b.enemy}: roll not deterministic`);
    check(r1.parts.chassis, `${b.enemy}: rolled build has no chassis`);
    const valid = new Set(P.slotsFor(r1.parts.chassis.id));
    for (const [k, it] of Object.entries(r1.parts)) {
      check(valid.has(k) && P.PARTS[it.id] && P.slotCat(k) === P.PARTS[it.id].cat, `${b.enemy}: rolled ${k}=${it.id} invalid`);
      check(!it.mod || P.MODS[it.mod], `${b.enemy}: bad mod ${it.mod}`);
      check((it.lvl || 0) <= 3, `${b.enemy}: tinker level too high`);
    }
    if (b.boss) check(r1.boss && r1.parts.chassis.id === 'compactor_frame' && r1.parts.armR.id === 'baron_blunderbuss', 'baron keeps his gilded core');
  }
}
// carried-over damage: a worn part starts the bout with less HP, a clean build is unchanged
{
  const base = { name: 't', paint: 'rust', parts: { chassis: { id: 'dumpster_frame', lvl: 0, mod: null }, legs: { id: 'scrap_stompers', lvl: 0, mod: null }, armR: { id: 'rivet_gun', lvl: 0, mod: null } } };
  const worn = JSON.parse(JSON.stringify(base));
  worn.parts.chassis.wear = 0.5;
  const sb = P.Stats.compute(base), sw = P.Stats.compute(worn);
  check(sb.hpNow === sb.hpTotal && sw.hpTotal === sb.hpTotal && sw.hpNow < sb.hpNow, 'wear lowers starting HP only');
  check(P.Loot.repairCost({ id: 'dumpster_frame', lvl: 0, wear: 1 }, 0) === Math.ceil(60 * P.REPAIR_RATE), 'full repair = price x rate');
  check(P.Loot.repairCost({ id: 'dumpster_frame', lvl: 0, wear: 0.5, free: true }, 0) === 0, 'junk bin repairs are free');
  const r = P.Sim.run({ seed: 5, A: worn, B: base });
  check(r.stats.A.parts.chassis.start < r.stats.A.parts.chassis.max, 'sim starts worn chassis below max');
}

// ---- full campaign: build a stronger mech between bouts, repair, retry losses ----
// Runs three fixed runs (different rolled opponents). The loot RNG is seeded too, so this is deterministic.
const S = P.State;
const upgrades = {
  f2: [['traffic_light', 'head'], ['scrap_shotgun', 'armL']],
  f3: [['fridge_frame', 'chassis'], ['chicken_walkers', 'legs'], ['bottle_rockets', 'mount0'], ['jump_jets', 'mount1']],
  f4: [['owl_optics', 'head'], ['ammo_hopper', 'module0']],
  f5: [['bulldozer_treads', 'legs'], ['jackhammer', 'armR']],
  boss: [['vault_frame', 'chassis'], ['tesla_coil', 'mount0'], ['repair_drone', 'mount1'], ['ammo_hopper', 'module0'], ['gyro_stabilizer', 'module1'], ['bulldozer_treads', 'legs', 2], ['jackhammer', 'armR', 2], ['scrap_shotgun', 'armL', 2]],
};
const refill = () => {
  // keep the mech whole: refill empty slots from the junk bin like a player would
  for (const k of S.slots()) {
    if (S.d.equip[k] || P.slotCat(k) === 'module' || P.slotCat(k) === 'mount') continue;
    const id = { head: 'bucket_head', legs: 'scrap_stompers', arm: 'rivet_gun' }[P.slotCat(k)];
    if (id) S.equip(k, S.addItem({ id, lvl: 0, mod: null, free: true }).uid);
  }
};
function runCampaign(runSeed, loud) {
  P.util.rng = P.util.makeRng(runSeed ^ 0x5bd1e995);
  S.newGame();
  S.d.runSeed = runSeed;
  S.d.inventory.forEach((i) => (i.lvl = 0));
  S.equip('mount0', S.d.inventory.find((i) => i.id === 'bottle_rockets').uid);
  let battles = 0, repaired = 0, fees = 0, rebought = 0, boughtFacility = null;
  const plan = {};
  // after a loss, put planned parts back: from spares if we have one, otherwise buy it if affordable
  const restore = () => {
    for (const [slot, want] of Object.entries(plan)) {
      const cur = S.item(S.d.equip[slot]);
      if (cur && cur.id === want.id) continue;
      const spare = S.d.inventory.find((i) => i.id === want.id && !S.slotOf(i.uid));
      if (spare) {
        S.equip(slot, spare.uid);
        continue;
      }
      const price = P.Loot.price(want);
      if (S.d.money >= price + 60) {
        S.d.money -= price;
        rebought += price;
        S.equip(slot, S.addItem(want).uid);
      }
    }
  };
  for (const b of P.CHAPTER1.bouts) {
    for (const [id, slot, lvl] of upgrades[b.id] || []) {
      const it = S.addItem({ id, lvl: lvl != null ? lvl : b.tier >= 2 ? 1 : 0, mod: null });
      S.equip(slot, it.uid);
      plan[slot] = { id, lvl: it.lvl, mod: null };
    }
    refill();
    let won = false, streak = 0;
    for (let attempt = 0; attempt < 12 && !won; attempt++) {
      // a stuck player works a shift every day, and after three straight losses tinkers the whole mech
      if (S.canShift()) S.workShift(P.Loot.pilesForDay(S.d.day)[0]);
      if (streak >= 3) {
        streak = 0;
        for (const k of S.slots()) {
          const it = S.item(S.d.equip[k]);
          if (it && !it.free && P.PARTS[it.id].hp && it.lvl < 3) it.lvl++;
        }
      }
      // broke? sell spare parts (cheapest first) until the repairs are covered, like a player would
      const spares = S.d.inventory.filter((i) => !S.slotOf(i.uid) && !i.free && !P.PARTS[i.id].blueprint).sort((a, c) => P.Loot.sellPrice(a) - P.Loot.sellPrice(c));
      while (S.d.money < S.repairBill(true) && spares.length) {
        const sp = spares.shift();
        S.d.money += P.Loot.sellPrice(sp);
        S.removeItem(sp.uid);
      }
      // patch up before the fight with whatever money there is
      const before = S.d.money;
      const rep = S.repairMany(S.damaged(true));
      repaired += rep.spent;
      check(Math.abs(before - rep.spent - S.d.money) < 1e-6, 'repair spend must match money change');
      check(S.d.money >= 0 || rep.spent === 0, 'repairs never put you in debt');
      const A = S.build(), B = S.boutBuild(b, false);
      check(JSON.stringify(B) === JSON.stringify(S.boutBuild(b, false)), 'bout build must be stable within a run');
      const seed = 1000 + battles * 31;
      const sim = P.Sim.run({ seed, A, B });
      const m0 = S.d.money;
      const res = S.applyBattle(b, sim, Object.assign({}, S.d.equip), false, B);
      check(Math.abs(S.d.money - (m0 + res.money - res.fee)) < 1e-6, 'payout accounting');
      fees += res.fee;
      battles++;
      won = res.won;
      streak = won ? 0 : streak + 1;
      if (res.won && res.salvage.length) S.addItem(res.salvage[0]);
      for (let c = 0; c < res.crates; c++) S.addItem(P.Loot.rollItem({ luck: S.luck(), tier: S.tier() }));
      if (!res.won) restore();
      refill();
      const replay = S.makeReplay(b, seed, A, B, sim, b.arena);
      const again = P.Sim.run({ seed: replay.seed, A: JSON.parse(JSON.stringify(replay.A)), B: JSON.parse(JSON.stringify(replay.B)) });
      check(again.winner === sim.winner && again.duration === sim.duration, `replay mismatch on ${b.id}`);
    }
    // buy the first facility once it's affordable (keeps a repair cushion)
    if (!boughtFacility && S.d.money >= P.FACILITIES_BY_ID.repair_bay.levels[0].cost + 150) {
      check(S.buyFacility('repair_bay') && S.facLevel('repair_bay') === 1 && S.repairDisc() === 0.2, 'buy Repair Bay L1');
      boughtFacility = 'repair_bay@day' + S.d.day;
    }
    if (loud) console.log(`  ${b.id.padEnd(5)} ${won ? 'cleared' : 'NOT cleared'} (battles: ${battles}, money $${S.d.money}, repairs paid $${repaired}, fees $${fees}, parts re-bought $${rebought}, bill now $${S.repairBill(true)}, inventory ${S.d.inventory.length})`);
    check(won, `run ${runSeed}: campaign stuck at ${b.id}`);
    if (!won) break;
  }
  check(S.d.campaign.complete, `run ${runSeed}: campaign should be complete`);
  console.log(`run ${runSeed}: ${S.d.campaign.complete ? 'complete' : 'STUCK'} in ${battles} bouts · day ${S.d.day} · money $${S.d.money} · repairs $${repaired} · fees $${fees} · re-bought $${rebought} · facility ${boughtFacility || 'none'}`);
}
runCampaign(424242, true);
runCampaign(1337, false);
runCampaign(2026, false);

// ==================== Chapter 2: the Public Arena ====================
check(P.Sim.COMPAT.includes(2) && P.Sim.VERSION === 3, 'sim v3 keeps v2 1v1 replays compatible');
for (const [tid, t] of Object.entries(P.TEAMS)) for (const u of t.units) check(P.ENEMIES[u.enemy] && P.ENEMY_POOLS[u.enemy], `team ${tid}: unknown unit ${u.enemy}`);
for (const b of P.CHAPTER2.bouts) {
  check(P.TEAMS[b.team] && P.TEAMS[b.team].units.length >= b.size, `bout ${b.id}: team too small`);
  check(P.ARENAS[b.arena], `bout ${b.id}: unknown arena`);
}
for (const pl of P.PILOTS) check(pl.fee > 0 && pl.wage > 0 && (!pl.unlock || P.CHAPTER2.bouts.some((b) => b.id === pl.unlock)), `pilot ${pl.id} malformed`);
for (const sp of P.SPONSORS) check(P.SPONSOR_CONDS[sp.bonus.cond] && sp.pay > 0 && sp.bouts > 0, `sponsor ${sp.id} malformed`);
for (const p of P.PAINTS) check(p.enemyOnly || !p.unlock || P.CHAPTER1.bouts.concat(P.CHAPTER2.bouts).some((b) => b.id === p.unlock), `paint ${p.id} unlock`);
// team sim invariants on every Chapter 2 bout
for (const b of P.CHAPTER2.bouts) {
  for (let s = 0; s < 6; s++) {
    const B = P.TEAMS[b.team].units.slice(0, b.size).map((u, i) => P.Opponents.roll(u.enemy, b.tier, 3000 + s * 11 + i, { lvlBonus: u.lvl || 0, modDelta: u.mod || 0 }));
    const A = B.map((x, i) => P.Opponents.roll(['gary', 'ohm', 'deacon'][i], 3, 600 + s * 5 + i));
    for (const x of A.concat(B)) {
      const valid = new Set(P.slotsFor(x.parts.chassis.id));
      for (const [k, it] of Object.entries(x.parts)) check(valid.has(k) && P.slotCat(k) === P.PARTS[it.id].cat, `${b.id}: rolled ${k}=${it.id} invalid`);
    }
    const r = P.Sim.run({ seed: 4242 + s, A, B });
    const again = P.Sim.run({ seed: 4242 + s, A: JSON.parse(JSON.stringify(A)), B: JSON.parse(JSON.stringify(B)) });
    check(JSON.stringify(r.events) === JSON.stringify(again.events), `${b.id}: team sim not deterministic`);
    check(r.team && r.units.length === b.size * 2, `${b.id}: unit count`);
    check(r.events[r.events.length - 1].type === 'end' && (r.winner === 'A' || r.winner === 'B'), `${b.id}: bad end`);
    let lastT = -1;
    for (const e of r.events) {
      if (e.t < lastT - 1e-9 || (e.type === 'hit' && !(e.dmg >= 1))) check(false, `${b.id}: events out of order or bad damage`);
      lastT = e.t;
    }
    const ia = P.Sim.unitsOf(r, 'A'), ib = P.Sim.unitsOf(r, 'B');
    let crossed = false;
    for (let fi = 0; fi < r.frames.A.length && !crossed; fi++) if (Math.max(...ia.map((u) => r.frames[u][fi])) >= Math.min(...ib.map((u) => r.frames[u][fi]))) crossed = true;
    check(!crossed, `${b.id}: teams crossed sides`);
  }
}

// old single-mech saves migrate into the garage
{
  P.util.rng = P.util.makeRng(77);
  S.newGame();
  const eq = JSON.parse(JSON.stringify(S.d.equip));
  const old = JSON.parse(JSON.stringify(S.d));
  delete old.mechs;
  delete old.cur;
  delete old.chapter;
  localStorageSet(old);
  check(S.load() && S.d.mechs.length === 1 && JSON.stringify(S.d.mechs[0].equip) === JSON.stringify(eq) && S.d.mechs[0].pilot === 'you', 'old save migrates into mech #1');
  check(S.chapterId() === 'ch1' && S.bouts().length === 6, 'old save stays in Chapter 1');
}

// scripted Chapter 2 run: carry over a finished Chapter 1 save, build a team, hire pilots, sign sponsors
function runChapter2(runSeed, loud) {
  runCampaign(runSeed, false);
  check(S.d.campaign.complete, 'Ch1 must be done before Ch2');
  const money0 = S.d.money, fac0 = JSON.stringify(S.d.facilities), inv0 = S.d.inventory.length;
  check(S.startChapter2() && S.d.chapter === 'ch2' && S.d.mechs.length === 2, 'Chapter 2 starts with a second mech');
  check(S.d.money === money0 && JSON.stringify(S.d.facilities) === fac0 && S.d.inventory.length >= inv0, 'money, facilities and parts carry over');
  check(S.bouts().every((b) => b.team) && S.nextBout().id === 'p1', 'Chapter 2 ladder');
  S.d.money += 2500; // a player who kept investing in the Pit Exchange
  check(S.hirePilot('tony') && S.d.mechs[1].pilot === 'tony', 'hiring fills the empty cockpit');
  check(!S.hirePilot('baron_p'), 'Baron is not for hire before bout 3');
  const it2 = (id, lvl) => ({ id, lvl: lvl || 0, mod: null });
  const plans = {};
  const kit = (mi, parts) => {
    S.selectMech(mi);
    plans[mi] = Object.assign(plans[mi] || {}, parts);
    for (const [slot, p] of Object.entries(parts)) S.equip(slot, S.addItem(p).uid);
  };
  // a player heading into the league first rebuilds mech #1 properly (Chapter 1 losses tend to strip it)
  kit(0, { chassis: it2('vault_frame', 1), head: it2('owl_optics', 1), legs: it2('bulldozer_treads', 2), armR: it2('jackhammer', 2), armL: it2('scrap_shotgun', 2), mount0: it2('tesla_coil', 1), mount1: it2('repair_drone', 1), module0: it2('ammo_hopper'), module1: it2('gyro_stabilizer') });
  // after a loss: re-equip planned parts from spares, or buy them back when affordable
  const restoreAll = () => {
    for (const [mi, plan] of Object.entries(plans)) {
      S.selectMech(Number(mi));
      for (const [slot, want] of Object.entries(plan)) {
        const cur = S.item(S.d.equip[slot]);
        if (cur && cur.id === want.id) continue;
        const spare = S.d.inventory.find((i) => i.id === want.id && !S.inUse(i.uid));
        if (spare) S.equip(slot, spare.uid);
        else if (S.d.money >= P.Loot.price(want) + 100) {
          S.d.money -= P.Loot.price(want);
          S.equip(slot, S.addItem(want).uid);
        }
      }
    }
    S.selectMech(0);
  };
  kit(1, { chassis: it2('fridge_frame', 2), head: it2('cyclops_lens', 2), legs: it2('chicken_walkers', 2), armR: it2('scrap_shotgun', 2), armL: it2('rivet_gun', 3), mount0: it2('bottle_rockets', 2), mount1: it2('jump_jets', 1), module0: it2('ammo_hopper') });
  S.selectMech(0);
  check(S.inUse(S.d.mechs[1].equip.chassis).mech === 1 && !S.slotOf(S.d.mechs[1].equip.chassis), 'parts on mech #2 are in use but not on mech #1');
  const sp = S.sponsorOffers()[0];
  check(sp && S.signSponsor(sp.id) && S.d.sponsors.length === 1, 'sign a sponsor');
  let battles = 0, grinds = 0;
  // short on cash? rematch an easy 2v2 for purse, gate and sponsor money, like a player would
  const grind = () => {
    const easy = P.CHAPTER2.bouts.find((x) => x.id === 'p1');
    for (let g = 0; g < 4 && S.d.money < 900; g++) {
      restoreAll();
      S.repairMany(S.damaged(true));
      for (let mi = 0; mi < S.d.mechs.length; mi++) {
        S.selectMech(mi);
        refill();
      }
      S.selectMech(0);
      const lu = S.lineupFor(easy);
      const A = lu.map((mi) => S.build(null, mi)), B = S.boutTeam(easy, true);
      const snaps = lu.map((mi) => Object.assign({}, S.mechRec(mi).equip));
      const sim = P.Sim.run({ seed: 90000 + grinds * 41, A, B });
      const res = S.applyTeamBattle(easy, sim, lu, snaps, true, B);
      if (res.won && res.salvage.length) S.addItem(res.salvage[0]);
      grinds++;
    }
  };
  for (const b of P.CHAPTER2.bouts) {
    if (b.id === 'p4') {
      check(S.d.mechs.length === 3, 'third bay after bout 3');
      check(S.hirePilot('rosa') && S.d.mechs[2].pilot === 'rosa', 'hire a third pilot');
      kit(2, { chassis: it2('boiler_frame', 2), head: it2('traffic_light', 2), legs: it2('bulldozer_treads', 2), armR: it2('hydraulic_claw', 3), armL: it2('flamethrower', 2), mount0: it2('toaster_lobber', 2), module0: it2('napalm_injector'), module1: it2('duct_tape') });
      S.selectMech(0);
    }
    if (b.boss) {
      // the championship: rebuild mechs #2 and #3 from Chapter 2 salvage, then tinker everything one more level (Tinker Lab)
      kit(1, { chassis: it2('vault_frame', 1), head: it2('owl_optics', 1), legs: it2('bulldozer_treads', 2), armR: it2('jackhammer', 2), armL: it2('scrap_shotgun', 2), mount0: it2('tesla_coil', 1), mount1: it2('repair_drone', 1), module0: it2('ammo_hopper'), module1: it2('gyro_stabilizer') });
      kit(2, { chassis: it2('fridge_frame', 1), head: it2('owl_optics'), legs: it2('bulldozer_treads', 1), armR: it2('wrecking_ball'), armL: it2('scrap_shotgun', 1), mount0: it2('tesla_coil'), mount1: it2('mortar_pipe'), module0: it2('ammo_hopper') });
      S.selectMech(0);
      if (!S.facLevel('tinker_lab')) S.d.facilities.tinker_lab = 2;
      for (const m of S.d.mechs) for (const uid of Object.values(m.equip)) {
        const x = S.item(uid);
        if (x && P.PARTS[x.id].hp && x.lvl < 4) x.lvl++;
      }
      for (const plan of Object.values(plans)) for (const p of Object.values(plan)) if (P.PARTS[p.id].hp && p.lvl < 4) p.lvl++;
    }
    let won = false, streak = 0;
    for (let attempt = 0; attempt < 12 && !won; attempt++) {
      // stuck? tinker the whole team (planned parts too) and put the toughest mech on point
      if (streak >= 3) {
        streak = 0;
        for (const plan of Object.values(plans)) for (const p of Object.values(plan)) if (P.PARTS[p.id].hp && p.lvl < 4) p.lvl++;
        for (const m of S.d.mechs) for (const uid of Object.values(m.equip)) {
          const x = S.item(uid);
          if (x && !x.free && P.PARTS[x.id].hp && x.lvl < 4) x.lvl++;
        }
        const order = S.d.mechs.map((_, i) => i).sort((a, c) => S.stats(null, c).hpTotal - S.stats(null, a).hpTotal);
        S.setLineup(order);
      }
      const spares = S.d.inventory.filter((i) => !S.inUse(i.uid) && !i.free && !P.PARTS[i.id].blueprint).sort((a, c) => P.Loot.sellPrice(a) - P.Loot.sellPrice(c));
      while (S.d.money < S.repairBill(true) && spares.length) {
        const x = spares.shift();
        S.d.money += P.Loot.sellPrice(x);
        S.removeItem(x.uid);
      }
      if (attempt > 0 && S.d.money < 900) grind();
      restoreAll();
      S.repairMany(S.damaged(true));
      // refill any slot that lost its part
      for (let mi = 0; mi < S.d.mechs.length; mi++) {
        S.selectMech(mi);
        refill();
      }
      S.selectMech(0);
      if (S.d.sponsors.length < S.sponsorSlots()) {
        const o = S.sponsorOffers()[0];
        if (o) S.signSponsor(o.id);
      }
      const lineup = S.lineupFor(b);
      check(lineup.length === Math.min(b.size, S.d.mechs.filter((_, i) => S.mechReady(i)).length), `${b.id}: lineup`);
      const A = lineup.map((mi) => S.build(null, mi));
      const B = S.boutTeam(b, false);
      check(JSON.stringify(B) === JSON.stringify(S.boutTeam(b, false)), 'team roll stable');
      const snaps = lineup.map((mi) => Object.assign({}, S.mechRec(mi).equip));
      const seed = 70000 + battles * 37;
      const sim = P.Sim.run({ seed, A, B });
      const m0 = S.d.money, fame0 = S.d.fame;
      const res = S.applyTeamBattle(b, sim, lineup, snaps, false, B);
      check(Math.abs(S.d.money - (m0 + res.money - res.fee - res.wages)) < 1e-6, `${b.id}: team payout accounting`);
      check(S.d.fame === U_clamp(fame0 + res.fame), `${b.id}: fame bookkeeping`);
      check(res.wages === lineup.reduce((a, mi) => a + (P.PILOTS_BY_ID[S.d.mechs[mi].pilot] || { wage: 0 }).wage, 0), `${b.id}: wages`);
      const replay = S.makeReplay(b, seed, A, B, sim, b.arena);
      check(!S.validateReplay(JSON.parse(JSON.stringify(replay))), `${b.id}: team replay validates`);
      const again = P.Sim.run({ seed, A: JSON.parse(JSON.stringify(replay.A)), B: JSON.parse(JSON.stringify(replay.B)) });
      check(again.winner === sim.winner && again.duration === sim.duration, `${b.id}: team replay mismatch`);
      if (res.won && res.salvage.length) S.addItem(res.salvage[0]);
      if (!res.won) restoreAll();
      battles++;
      won = res.won;
      streak = won ? 0 : streak + 1;
    }
    if (loud) console.log(`  ${b.id.padEnd(5)} ${won ? 'cleared' : 'NOT cleared'} (team battles: ${battles}, money $${S.d.money}, fame ${S.d.fame}, sponsors ${S.d.sponsors.map((c) => c.id).join('+') || '-'}, bill $${S.repairBill(true)})`);
    check(won, `run ${runSeed}: Chapter 2 stuck at ${b.id}`);
    if (!won) break;
  }
  check(S.d.campaign.complete2, `run ${runSeed}: Chapter 2 should be complete`);
  check(S.pilotUnlocked(P.PILOTS_BY_ID.baron_p) && S.pilotUnlocked(P.PILOTS_BY_ID.gary_p), 'Gary and the Baron become hireable');
  console.log(`run ${runSeed} Chapter 2: ${S.d.campaign.complete2 ? 'complete' : 'STUCK'} in ${battles} team bouts (+${grinds} rematches for cash) · money $${S.d.money} · fame ${S.d.fame} · wages paid $${S.d.stats.wagesPaid || 0}`);
}
function U_clamp(v) {
  return Math.max(0, Math.min(100, v));
}
function localStorageSet(obj) {
  ctx.localStorage.setItem('ptp_save_v1', JSON.stringify(obj));
}
runChapter2(424242, true);
runChapter2(1337, false);


// ==================== translations ====================
{
  const vi = P.I18N.ui.vi, C = P.I18N.content.vi;
  check(vi && C, 'Vietnamese tables loaded');
  const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of require('./i18n_keys.js').listKeys()) {
    if (vi[k] == null) check(false, `vi: missing UI string "${k}"`);
    else check(ph(vi[k]) === ph(k), `vi: placeholders differ for "${k}"`);
  }
  const has = (o, f, what) => check(o && typeof (f ? o[f] : o) === 'string' && (f ? o[f] : o).length > 0, `vi: missing ${what}`);
  for (const id in P.PARTS) {
    has(C.parts[id], 'name', `part name ${id}`);
    has(C.parts[id], 'desc', `part desc ${id}`);
  }
  for (const id in P.MODS) has(C.mods[id], 'name', `mod ${id}`);
  for (const k in P.CATS) has(C.cats[k], null, `category ${k}`);
  for (const k in P.RARITY) has(C.rarities[k], null, `rarity ${k}`);
  for (const k in P.DMG_TYPES) has(C.dmgTypes[k], null, `damage type ${k}`);
  for (const k in P.TARGETING) {
    has(C.targeting[k], null, `targeting ${k}`);
    has(C.targetNames[k], null, `targeting name ${k}`);
  }
  for (const [id, s] of Object.entries(P.SYNERGIES)) check(C.synergies[id] && C.synergies[id].name && C.synergies[id].tiers.length === s.tiers.length, `vi: synergy ${id}`);
  for (const p of P.PAINTS) has(C.paints[p.id], null, `paint ${p.id}`);
  for (const [id, e] of Object.entries(P.ENEMIES)) for (const f of ['mech', 'title', 'quote', 'lose', 'phase2']) if (e[f]) has(C.enemies[id], f, `enemy ${id}.${f}`);
  for (const id in P.TEAMS) for (const f of ['name', 'quote', 'lose']) has(C.teams[id], f, `team ${id}.${f}`);
  for (const b of P.CHAPTER1.bouts.concat(P.CHAPTER2.bouts)) has(C.bouts[b.id], null, `bout title ${b.id}`);
  for (const r of P.ROADMAP) check(C.roadmap[r.n] && C.roadmap[r.n].title && C.roadmap[r.n].blurb, `vi: roadmap ${r.n}`);
  for (const k of ['intro', 'afterLoss', 'noShift', 'ending', 'ch2intro', 'ending2']) check(C.dialogue[k] && C.dialogue[k].length === P.DIALOGUE[k].length, `vi: dialogue ${k} line count`);
  for (const [id, lines] of Object.entries(P.DIALOGUE.afterWin)) check(C.afterWin[id] && C.afterWin[id].length === lines.length, `vi: afterWin ${id}`);
  for (const [k, lines] of Object.entries(P.ANNOUNCER)) {
    check(Array.isArray(C.announcer[k]) && C.announcer[k].length > 0, `vi: announcer ${k}`);
    const allowed = new Set((lines.join(' ').match(/\{\w\}/g) || []));
    for (const l of C.announcer[k] || []) for (const x of l.match(/\{\w\}/g) || []) check(allowed.has(x), `vi: announcer ${k} uses unknown ${x}`);
  }
  for (const f of P.FACILITIES) check(C.facilities[f.id] && C.facilities[f.id].name && C.facilities[f.id].blurb && C.facilities[f.id].later && C.facilities[f.id].levels.length === f.levels.length, `vi: facility ${f.id}`);
  for (const pl of P.PILOTS) for (const f of ['title', 'quirk', 'desc', 'bio']) has(C.pilots[pl.id], f, `pilot ${pl.id}.${f}`);
  for (const s of P.SPONSORS) has(C.sponsors[s.id], 'blurb', `sponsor ${s.id}`);
  for (const v of P.VENTURES) for (const f of ['blurb', 'boomNews', 'crashNews']) has(C.ventures[v.id], f, `venture ${v.id}.${f}`);
  for (const p of P.Loot.PILES) for (const f of ['name', 'desc']) has(C.piles[p.id], f, `pile ${p.id}.${f}`);
  // switching language changes text, and switching back restores English
  P.I18N.set('vi');
  check(P.itemName({ id: 'dumpster_frame', lvl: 1, mod: 'rusty' }) === 'Khung Thùng Rác Rỉ Sét +1', 'vi item names put the prefix after the noun');
  check(P.slotLabel('mount1') === 'Giá gắn 2' && P.t('Day') === 'Ngày', 'vi labels');
  const s1 = P.Sim.run({ seed: 3, A: P.Opponents.fixed('gary'), B: P.Opponents.fixed('twins') });
  P.I18N.set('en');
  const s2 = P.Sim.run({ seed: 3, A: P.Opponents.fixed('gary'), B: P.Opponents.fixed('twins') });
  check(s1.winner === s2.winner && s1.duration === s2.duration, 'language never changes a fight');
  check(P.itemName({ id: 'dumpster_frame', lvl: 0, mod: 'rusty' }) === 'Rusty Dumpster Frame', 'back to English');
}

console.log(fails ? `\n${fails} check(s) FAILED` : '\nAll smoke checks passed.');
process.exit(fails ? 1 : 0);
