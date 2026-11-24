// Part-Time Pilot — expansion content: new weapons, blueprint-only Prototype parts,
// blueprint list and Pit Exchange ventures.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});

  // ---- new damage types ----
  Object.assign(P.DMG_TYPES, {
    acid: { name: 'Acid', color: '#a8ff3a', armor: 0.5 },
    cryo: { name: 'Cryo', color: '#cfeeff', armor: 0.6 },
    sonic: { name: 'Sonic', color: '#ff9ae0', armor: 0 },
    emp: { name: 'EMP', color: '#d8dcff', armor: 0.3 },
    gravity: { name: 'Gravity', color: '#c08aff', armor: 0 },
  });

  // ---- Prototype rarity: only obtainable from blueprints ----
  P.RARITY.prototype = { name: 'Prototype', color: '#ff6ad5', weight: 0, scrap: 30 };
  if (!P.RARITY_ORDER.includes('prototype')) P.RARITY_ORDER.push('prototype');

  const NEW = {
    // ============================== NEW WEAPONS (lootable) ==============================
    nail_minigun: {
      cat: 'arm', name: 'Nail Minigun', rarity: 'rare', price: 240, weight: 12, hp: 40, armor: 0, tags: [], sprite: 'ar_minigun',
      weapon: { type: 'ballistic', vfx: 'nail', dmg: 2.6, cd: 0.5, range: [0, 300], opt: 150, acc: -4, spinup: { min: 0.35, steps: 10 } },
      desc: 'Spins up: fires faster the longer it keeps shooting (up to ~3x). Neighbours hate it.',
    },
    harpoon_gun: {
      cat: 'arm', name: 'Harpoon Gun', rarity: 'uncommon', price: 110, weight: 10, hp: 40, armor: 0, tags: [], sprite: 'ar_harpoon',
      weapon: { type: 'ballistic', vfx: 'harpoon', dmg: 12, cd: 2.4, range: [0, 320], opt: 190, pull: 55 },
      desc: 'Reels the enemy in close. Best friend of every melee build. Terrible for actual fishing.',
    },
    acid_sprayer: {
      cat: 'arm', name: 'Acid Sprayer', rarity: 'uncommon', price: 130, weight: 9, hp: 38, armor: 0, tags: [], sprite: 'ar_acid', glow: '#a8ff3a',
      weapon: { type: 'acid', vfx: 'acid', dmg: 3, burst: 3, burstGap: 0.12, cd: 1.5, range: [0, 120], opt: 75, corrode: 0.4 },
      desc: 'Short range. Each hit may melt 1 point of the enemy\'s armor for the rest of the bout.',
    },
    boomerang_saw: {
      cat: 'arm', name: 'Boomerang Saw', rarity: 'rare', price: 220, weight: 9, hp: 40, armor: 0, tags: [], sprite: 'ar_boomer',
      weapon: { type: 'melee', vfx: 'boomerang', thrown: true, dmg: 8, cd: 2.1, range: [0, 240], opt: 120, ret: true, pierce: 0.3 },
      desc: 'Thrown saw blade that cuts on the way out AND on the way back. Melee damage at range.',
    },
    hydraulic_sledge: {
      cat: 'arm', name: 'Hydraulic Sledge', rarity: 'uncommon', price: 140, weight: 16, hp: 52, armor: 2, tags: ['demolition'], sprite: 'ar_sledge',
      weapon: { type: 'melee', vfx: 'hammer', dmg: 26, cd: 2.8, reach: 64, stagger: 0.3, critTopple: true },
      desc: 'Slow. Enormous. Critical hits always knock the target flat. BONK.',
    },
    freeze_ray: {
      cat: 'arm', name: 'Freeze Ray', rarity: 'rare', price: 230, weight: 9, hp: 36, armor: 0, tags: [], sprite: 'ar_freeze', glow: '#cfeeff',
      weapon: { type: 'cryo', vfx: 'cryo', dmg: 5, cd: 1.2, range: [0, 260], opt: 150, frost: 1 },
      desc: 'Builds frost. Four quick hits freeze the target solid for a moment: it can\'t act and takes +25% damage.',
    },
    junk_railgun: {
      cat: 'mount', name: 'Junkyard Railgun', rarity: 'epic', price: 440, weight: 18, hp: 46, armor: 0, tags: ['sparky'], sprite: 'mt_rail', glow: '#7fd0ff',
      weapon: { type: 'energy', vfx: 'rail', dmg: 24, cd: 5.5, charge: 0.9, range: [0, 460], opt: 280, acc: 15, pierceN: 2, pierce: 0.5 },
      desc: 'Charges, then fires a slug clean THROUGH the enemy, hitting three parts. Ignores half of armor.',
    },
    bagpipe_blaster: {
      cat: 'mount', name: 'Bagpipe Blaster', rarity: 'rare', price: 200, weight: 11, hp: 44, armor: 0, tags: [], sprite: 'mt_bagpipe',
      weapon: { type: 'sonic', vfx: 'sonic', dmg: 3, cd: 3.2, range: [0, 260], opt: 150, hitsAll: true, stagger: 0.12 },
      desc: 'Hits EVERY enemy part at once, ignoring armor. Violates several noise ordinances.',
    },
    landmine_dropper: {
      cat: 'mount', name: 'Landmine Dropper', rarity: 'uncommon', price: 140, weight: 12, hp: 40, armor: 1, tags: ['demolition'], sprite: 'mt_mines',
      weapon: { type: 'explosive', vfx: 'mine', dmg: 25, cd: 4.0, range: [30, 360], opt: 160, mine: true, stagger: 0.5 },
      desc: 'Lobs mines in front of the enemy. Whoever walks over one loses some leg and probably falls over.',
    },
    emp_coil: {
      cat: 'mount', name: 'EMP Coil', rarity: 'rare', price: 230, weight: 10, hp: 36, armor: 0, tags: [], sprite: 'mt_emp', glow: '#d8dcff',
      weapon: { type: 'emp', vfx: 'emp', dmg: 5, cd: 6.0, range: [0, 300], opt: 160, jam: 2.2 },
      desc: 'Jams a random enemy weapon or gadget for 2 seconds.',
    },
    swarm_pod: {
      cat: 'mount', name: 'Micro-Missile Swarm', rarity: 'rare', price: 260, weight: 13, hp: 44, armor: 0, tags: [], sprite: 'mt_swarm',
      weapon: { type: 'explosive', vfx: 'swarm', dmg: 3, burst: 8, burstGap: 0.07, cd: 5.0, range: [40, 440], opt: 220, acc: 25, homing: true },
      desc: 'Eight tiny homing missiles. Mostly ignores evasion. Overkill is underrated.',
    },
    smoke_mortar: {
      cat: 'mount', name: 'Smoke Mortar', rarity: 'common', price: 60, weight: 7, hp: 34, armor: 0, tags: ['junk'], sprite: 'mt_smoke',
      weapon: { type: 'explosive', vfx: 'smoke', dmg: 2, cd: 6.0, range: [40, 400], opt: 200, blind: 4 },
      desc: 'Smothers the enemy in smoke: -30 accuracy for 4 seconds. Also great for dramatic entrances.',
    },

    // ============================== PROTOTYPES (blueprint-only) ==============================
    gamblers_revolver: {
      cat: 'arm', name: "Gambler's Revolver", rarity: 'prototype', price: 300, weight: 7, hp: 44, armor: 1, tags: ['lucky'], sprite: 'ar_revolver', noLoot: true, blueprint: true,
      weapon: { type: 'ballistic', vfx: 'revolver', dmg: 8, cd: 1.1, range: [0, 340], opt: 170, acc: 8, chambers: true },
      desc: 'Every shot spins the cylinder: blank, normal, ricochet, GOLDEN BULLET, explosive round or FAN THE HAMMER. Luck loads better rounds.',
    },
    rocket_skates: {
      cat: 'legs', name: 'Rocket Skates', rarity: 'prototype', price: 300, weight: 8, hp: 72, armor: 0, tags: [], sprite: 'lg_skates', glow: '#ffb04a', noLoot: true, blueprint: true,
      legs: { type: 'biped', limbs: 2, speed: 2.0, eva: 22, cap: 85, rush: 14 },
      desc: 'Absurdly fast. Whenever it closes in, it slams into the enemy for 14 damage plus knockback (every 3s).',
    },
    phoenix_core: {
      cat: 'module', name: 'Phoenix Core', rarity: 'prototype', price: 320, weight: 3, tags: ['pyro'], trinket: 'tr_feather', noLoot: true, blueprint: true,
      passive: { phoenix: true },
      desc: 'Once per bout, when your chassis would be destroyed, rise again at 40% HP in a fire nova that scorches every enemy part.',
    },
    mimic_module: {
      cat: 'module', name: 'Mimic Module', rarity: 'prototype', price: 320, weight: 2, tags: [], trinket: 'tr_mimic', noLoot: true, blueprint: true,
      passive: { mimic: true },
      desc: 'At the bell, scans the opponent and builds a holographic copy of their best weapon (80% damage).',
    },
    black_hole: {
      cat: 'mount', name: 'Pocket Black Hole', rarity: 'prototype', price: 340, weight: 14, hp: 48, armor: 0, tags: ['sparky'], sprite: 'mt_blackhole', glow: '#b07aff', noLoot: true, blueprint: true,
      weapon: { type: 'gravity', vfx: 'blackhole', dmg: 4, cd: 7.5, charge: 0.8, range: [0, 400], opt: 200, hitsAll: true, pull: 45, ripAll: 0.3 },
      desc: 'Yanks the enemy closer, damages every part and can tear off any part below 35% HP.',
    },
    golem_frame: {
      cat: 'chassis', name: 'Scrap Golem Frame', rarity: 'prototype', price: 360, weight: 46, hp: 150, armor: 3, tags: ['junk'], sprite: 'ch_golem', glow: '#7dff8a', noLoot: true, blueprint: true,
      chassis: { mounts: 3, modules: 1 }, passive: { golem: true },
      desc: 'THREE hardpoints. Absorbs every part destroyed in the bout (anyone\'s): +6 max chassis HP and +0.5 armor each, up to 10 times.',
    },
    dejavu_visor: {
      cat: 'head', name: 'Déjà Vu Visor', rarity: 'prototype', price: 300, weight: 4, hp: 36, armor: 1, tags: [], sprite: 'hd_dejavu', glow: '#ff7ae0', noLoot: true, blueprint: true,
      head: { acc: 12, crit: 6, target: 'weakest', adapt: true },
      desc: 'Has seen this fight before. Every hit you take from a weapon makes that weapon easier to dodge (+6 evasion each, max +30).',
    },
    ditto_arm: {
      cat: 'arm', name: 'Ditto Arm', rarity: 'prototype', price: 300, weight: 6, hp: 40, armor: 0, tags: [], sprite: 'ar_ditto', glow: '#b9a4ff', noLoot: true, blueprint: true,
      mirror: true,
      desc: 'A holographic arm that copies the weapon on your OTHER arm at 85% damage. Two of anything!',
    },
    lottery_engine: {
      cat: 'module', name: 'Lottery Engine', rarity: 'prototype', price: 280, weight: 3, tags: ['lucky'], trinket: 'tr_slot', noLoot: true, blueprint: true,
      passive: { lottery: true },
      desc: 'Every 9s it pulls a lever: overdrive, free shield, patch-up, turbo, nothing... or JACKPOT (all of it). Luck rigs the odds.',
    },
  };
  for (const id in NEW) {
    NEW[id].id = id;
    P.PARTS[id] = NEW[id];
  }

  // Blueprints: first clears grant the first six, the rest only drop randomly.
  P.BLUEPRINTS = [
    { id: 'gamblers_revolver', scrap: 18, money: 60, grant: 'f1' },
    { id: 'rocket_skates', scrap: 22, money: 80, grant: 'f2' },
    { id: 'phoenix_core', scrap: 26, money: 100, grant: 'f3' },
    { id: 'mimic_module', scrap: 28, money: 110, grant: 'f4' },
    { id: 'black_hole', scrap: 32, money: 130, grant: 'f5' },
    { id: 'golem_frame', scrap: 36, money: 150, grant: 'boss' },
    { id: 'dejavu_visor', scrap: 24, money: 90 },
    { id: 'ditto_arm', scrap: 26, money: 100 },
    { id: 'lottery_engine', scrap: 20, money: 70 },
  ];

  // The Pit Exchange. Prices start at 100 and move once per day (after every bout).
  // r = drift + vol * noise; crash/boom = [chance, multiplier].
  P.VENTURES = [
    { id: 'yard', name: "Bolt's Salvage & Sundries", risk: 1, drift: 0.03, vol: 0.035, crash: [0.03, 0.8], boom: [0.04, 1.3],
      blurb: "Marge's own junkyard. Steady. She'd better not lose your money.", boomNews: 'found a vintage car in the compactor!', crashNews: 'got audited by a raccoon.' },
    { id: 'lawn', name: "Gary's Lawn Care LLC", risk: 1, drift: 0.035, vol: 0.03, crash: [0.02, 0.85], boom: [0.03, 1.25], unlock: 'f1',
      blurb: 'Boring. Reliable. Gary is very proud.', boomNews: 'landed the cemetery contract!', crashNews: 'mowed the mayor\'s prize petunias.' },
    { id: 'lemon', name: 'Pickle Twins Lemonade Empire', risk: 2, drift: 0.04, vol: 0.1, crash: [0.06, 0.55], boom: [0.07, 1.7], unlock: 'f2',
      blurb: 'Volatile, as their mother keeps saying.', boomNews: 'went viral with Pickle-Ade!', crashNews: 'were caught putting pickles in the lemonade.' },
    { id: 'truck', name: "Flambé's Flaming Food Truck", risk: 3, drift: 0.06, vol: 0.14, crash: [0.1, 0.3], boom: [0.08, 2.0], unlock: 'f3',
      blurb: 'Five-star reviews. Occasionally on fire.', boomNews: 'won "Best Crème Brûlée on Wheels"!', crashNews: 'caught fire. Again.' },
    { id: 'fusion', name: 'Ohm Cold Fusion Labs', risk: 4, drift: -0.02, vol: 0.18, crash: [0.12, 0.4], boom: [0.09, 2.8], unlock: 'f4',
      blurb: 'Mostly explosions. Possibly the future.', boomNews: 'achieved fusion for 0.3 seconds!', crashNews: 'fused the lab to the parking lot.' },
    { id: 'scrapcoin', name: 'ScrapCoin', risk: 5, drift: 0.0, vol: 0.38, crash: [0.12, 0.2], boom: [0.1, 2.6],
      blurb: 'A digital currency backed by vibes and one rusty bolt.', boomNews: 'TO THE MOON!', crashNews: 'rug-pulled by a guy named Steve.' },
    { id: 'arena', name: 'Scrap Pit Arena Holdings', risk: 2, drift: 0.05, vol: 0.07, crash: [0.05, 0.6], boom: [0.06, 1.6], unlock: 'boss',
      blurb: "You beat the owner. Now buy the place. The concession stand is included.", boomNews: 'sold out a doubleheader!', crashNews: 'had a mech fall through the floor.' },
  ];
})();
