// Headless balance checker: runs the real battle sim in Node.
//   node tools/balance.js            -> win rates of sample player builds vs every opponent
//   node tools/balance.js verbose    -> also prints one sample fight summary per matchup
//   node tools/balance.js fixed      -> only the fixed-opponent table (fast)
//   node tools/balance.js ch2        -> only the Chapter 2 team-bout table
// Tables: fixed opponents, rolled opponents (avg + spread across loadouts), repair bill after a win.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Boolean, Infinity, NaN, isFinite, parseInt, parseFloat };
ctx.window = ctx;
ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
vm.createContext(ctx);
for (const f of ['src/core/util.js', 'src/core/i18n.js', 'src/data/sprites.js', 'src/data/sprites_ext.js', 'src/data/parts.js', 'src/data/parts_ext.js', 'src/data/campaign.js', 'src/data/facilities.js', 'src/data/chapter2.js', 'src/game/stats.js', 'src/game/loot.js', 'src/game/opponents.js', 'src/battle/sim.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const P = ctx.PTP;
const verbose = process.argv.includes('verbose');

const it = (id, lvl) => ({ id, lvl: lvl || 0, mod: null });
const PLAYER_BUILDS = {
  starter: {
    chassis: it('dumpster_frame'), head: it('bucket_head'), legs: it('scrap_stompers'),
    armR: it('hydraulic_claw'), armL: it('rivet_gun'), mount0: it('bottle_rockets'), module0: it('duct_tape'),
  },
  early: {
    chassis: it('dumpster_frame', 1), head: it('traffic_light'), legs: it('scrap_stompers', 1),
    armR: it('hydraulic_claw', 1), armL: it('rivet_gun', 1), mount0: it('bottle_rockets', 1), module0: it('duct_tape'),
  },
  mid: {
    chassis: it('fridge_frame', 1), head: it('cyclops_lens'), legs: it('chicken_walkers', 1),
    armR: it('scrap_shotgun', 1), armL: it('rivet_gun', 2), mount0: it('bottle_rockets', 1), mount1: it('jump_jets'), module0: it('ammo_hopper'),
  },
  late: {
    chassis: it('vault_frame', 1), head: it('owl_optics', 1), legs: it('bulldozer_treads', 2),
    armR: it('jackhammer', 2), armL: it('scrap_shotgun', 2), mount0: it('tesla_coil', 1), mount1: it('repair_drone', 1),
    module0: it('ammo_hopper'), module1: it('gyro_stabilizer'),
  },
  late2: {
    chassis: it('fridge_frame', 1), head: it('owl_optics'), legs: it('bulldozer_treads', 1),
    armR: it('wrecking_ball'), armL: it('scrap_shotgun', 1), mount0: it('tesla_coil'), mount1: it('mortar_pipe'), module0: it('ammo_hopper'),
  },
  lateJunk: {
    chassis: it('boiler_frame', 2), head: it('traffic_light', 2), legs: it('bulldozer_treads', 2),
    armR: it('hydraulic_claw', 3), armL: it('flamethrower', 2), mount0: it('toaster_lobber', 2),
    module0: it('napalm_injector'), module1: it('duct_tape'),
  },
};

const N = 200;
const bouts = P.CHAPTER1.bouts;
const enemies = bouts.map((b) => b.enemy);
const fixedOnly = process.argv.includes('fixed');
const ch2Only = process.argv.includes('ch2');
const pct = (x) => `${Math.round(x * 100)}%`;

// Repair bill for player A after a fight: wear x price x REPAIR_RATE (no Repair Bay discount).
function repairBill(A, r) {
  let bill = 0;
  for (const [k, f] of Object.entries(r.final.A)) {
    const it = A.parts[k];
    if (!it) continue;
    const wear = f.destroyed ? (k === 'chassis' ? 1 - P.KO_WELD : 0) : 1 - f.hp / f.max;
    bill += P.Loot.repairCost(it, 0, wear);
  }
  return bill;
}
function partValue(A) {
  return Object.values(A.parts).reduce((a, it) => a + P.Loot.price(it), 0);
}

// ---------- 1) original fixed builds (reference curve) ----------
if (!ch2Only) console.log('FIXED opponents (the original hand-made builds) — win% / avg length');
if (!ch2Only) console.log('build'.padEnd(10), enemies.map((e) => e.padStart(10)).join(''));
for (const [bn, parts] of ch2Only ? [] : Object.entries(PLAYER_BUILDS)) {
  const A = { name: bn, paint: 'rust', parts };
  const row = [];
  for (const eid of enemies) {
    const B = P.Opponents.fixed(eid);
    let wins = 0, dur = 0, lost = 0, ko = 0;
    for (let i = 0; i < N; i++) {
      const r = P.Sim.run({ seed: 1000 + i * 7, A, B });
      if (r.winner === 'A') wins++;
      if (r.reason === 'ko') ko++;
      dur += r.duration;
      lost += Object.values(r.final.A).filter((p) => p.destroyed).length;
    }
    row.push(`${pct(wins / N)}`.padStart(5) + `/${Math.round(dur / N)}s`.padStart(5));
    if (verbose) {
      const r = P.Sim.run({ seed: 42, A, B });
      console.log(`  ${bn} vs ${eid}: winner ${r.winner} by ${r.reason} at ${r.duration.toFixed(1)}s; dmg A ${r.stats.A.dmgDealt} B ${r.stats.B.dmgDealt}; ` +
        `A lost ${Object.values(r.final.A).filter((p) => p.destroyed).length}, KO rate ${Math.round((ko / N) * 100)}%, avg lost ${(lost / N).toFixed(1)}`);
    }
  }
  console.log(bn.padEnd(10), row.join(''));
}

if (!fixedOnly && !ch2Only) {
  // ---------- 2) rolled opponents: average over many loadouts, plus the spread between loadouts ----------
  const VARIANTS = 40, SEEDS = 10;
  console.log(`\nROLLED opponents (${VARIANTS} loadouts x ${SEEDS} fights) — avg win% [10th..90th percentile loadout]`);
  console.log('build'.padEnd(10), enemies.map((e) => e.padStart(14)).join(''));
  const variants = {};
  for (const b of bouts) variants[b.enemy] = Array.from({ length: VARIANTS }, (_, v) => P.Opponents.roll(b.enemy, b.tier, 50000 + v * 101));
  const econ = {};
  for (const [bn, parts] of Object.entries(PLAYER_BUILDS)) {
    const A = { name: bn, paint: 'rust', parts };
    const row = [];
    econ[bn] = {};
    for (const b of bouts) {
      const rates = [];
      let bills = 0, wins = 0;
      for (const B of variants[b.enemy]) {
        let w = 0;
        for (let i = 0; i < SEEDS; i++) {
          const r = P.Sim.run({ seed: 2000 + i * 13, A, B });
          if (r.winner === 'A') {
            w++;
            wins++;
            bills += repairBill(A, r);
          }
        }
        rates.push(w / SEEDS);
      }
      rates.sort((a, b) => a - b);
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      row.push(`${pct(avg)} [${pct(rates[Math.floor(VARIANTS * 0.1)])}..${pct(rates[Math.floor(VARIANTS * 0.9)])}]`.padStart(14));
      econ[bn][b.id] = wins ? bills / wins : null;
    }
    console.log(bn.padEnd(10), row.join(''));
  }

  // ---------- 3) economy: average repair bill after a WIN, and as a share of the purse ----------
  console.log(`\nREPAIR BILL after a win (rate ${P.REPAIR_RATE} of part price, no Repair Bay) — $bill (share of purse); entry fees: ${bouts.map((b) => '$' + b.fee).join(' ')}`);
  console.log('build'.padEnd(10), 'value'.padStart(6), enemies.map((e) => e.padStart(12)).join(''));
  for (const [bn, parts] of Object.entries(PLAYER_BUILDS)) {
    const A = { name: bn, paint: 'rust', parts };
    const row = bouts.map((b) => {
      const v = econ[bn][b.id];
      return (v == null ? '—' : `$${Math.round(v)} (${pct(v / b.reward)})`).padStart(12);
    });
    console.log(bn.padEnd(10), `$${partValue(A)}`.padStart(6), row.join(''));
  }
}

// ---------- 4) Chapter 2: team bouts vs rolled teams ----------
if (!fixedOnly) {
  const pil = (b, id) => Object.assign({}, b, { pilotFx: P.PILOTS_BY_ID[id].fx, unitTarget: P.PILOTS_BY_ID[id].unitTarget });
  const mk = (parts, name) => ({ name, paint: 'rust', parts });
  const up = (parts) => Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Object.assign({}, v, { lvl: P.PARTS[v.id].cat === 'module' ? 0 : Math.min(4, (v.lvl || 0) + 1) })]));
  const junk = { chassis: it('dumpster_frame'), head: it('bucket_head'), legs: it('scrap_stompers'), armR: it('rivet_gun'), armL: it('plunger_launcher') };
  const TEAMS = {
    'start(late+junk)': [mk(PLAYER_BUILDS.late, 'late'), pil(mk(junk, 'junk'), 'rosa')],
    'two(late+mid)': [mk(PLAYER_BUILDS.late, 'late'), pil(mk(PLAYER_BUILDS.mid, 'mid'), 'tony')],
    'three(l+m+m)': [mk(PLAYER_BUILDS.late, 'late'), pil(mk(PLAYER_BUILDS.mid, 'mid'), 'tony'), pil(mk(PLAYER_BUILDS.lateJunk, 'lj'), 'rosa')],
    'strong(l+l+l2)': [mk(PLAYER_BUILDS.late, 'late'), pil(mk(PLAYER_BUILDS.late, 'late'), 'grandma'), pil(mk(PLAYER_BUILDS.late2, 'l2'), 'mina')],
    'strong+1': [mk(up(PLAYER_BUILDS.late), 'late'), pil(mk(up(PLAYER_BUILDS.late), 'late'), 'grandma'), pil(mk(up(PLAYER_BUILDS.late2), 'l2'), 'mina')],
  };
  const ch2 = P.CHAPTER2.bouts;
  const VAR2 = 16, SEED2 = 6;
  console.log(`\nCHAPTER 2 team bouts (${VAR2} rolled teams x ${SEED2} fights) — avg win% / avg length (your extra mechs fill only as many slots as the bout allows)`);
  console.log('team'.padEnd(18), ch2.map((b) => (b.id + ` ${b.size}v${b.size}`).padStart(12)).join(''));
  for (const [tn, units] of Object.entries(TEAMS)) {
    const row = ch2.map((b) => {
      const A = units.slice(0, b.size);
      let w = 0, n = 0, dur = 0;
      for (let v = 0; v < VAR2; v++) {
        const B = P.TEAMS[b.team].units.slice(0, b.size).map((u, i) => {
          const x = P.Opponents.roll(u.enemy, b.tier, 80000 + v * 97 + i, { lvlBonus: u.lvl || 0, modDelta: u.mod || 0 });
          if (u.unitTarget) x.unitTarget = u.unitTarget;
          if (i > 0) x.boss = false;
          return x;
        });
        for (let s = 0; s < SEED2; s++) {
          const r = P.Sim.run({ seed: 9000 + s * 29 + v, A, B });
          if (r.winner === 'A') w++;
          dur += r.duration;
          n++;
        }
      }
      return `${pct(w / n)}/${Math.round(dur / n)}s`.padStart(12);
    });
    console.log(tn.padEnd(18), row.join(''));
  }
}

const s = P.Stats.compute({ parts: PLAYER_BUILDS.starter });
console.log('\nstarter stats:', { hp: s.hpTotal, armor: s.armor, acc: s.acc, eva: s.eva, speed: s.speed.toFixed(2), luck: s.luck, dps: s.dps.toFixed(1), weight: s.weight, cap: s.cap, syn: s.synergies.map((x) => x.name + ':' + x.count) });
// determinism check
const a1 = P.Sim.run({ seed: 7, A: { parts: PLAYER_BUILDS.mid }, B: { parts: P.ENEMIES.baron.parts, boss: true } });
const a2 = P.Sim.run({ seed: 7, A: { parts: PLAYER_BUILDS.mid }, B: { parts: P.ENEMIES.baron.parts, boss: true } });
console.log('deterministic:', JSON.stringify(a1.events) === JSON.stringify(a2.events), 'events:', a1.events.length);
