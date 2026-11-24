// Part-Time Pilot — parts, rarities, modifiers, synergies, paints.
// Add a new part by adding an entry to PARTS (and a sprite to sprites.js if it is visible).
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});

  P.RARITY = {
    common: { name: 'Common', color: '#c9c3b3', weight: 60, scrap: 3 },
    uncommon: { name: 'Uncommon', color: '#76d672', weight: 28, scrap: 6 },
    rare: { name: 'Rare', color: '#62b2ff', weight: 10, scrap: 12 },
    epic: { name: 'Epic', color: '#cc86ff', weight: 2.2, scrap: 24 },
    legendary: { name: 'Legendary', color: '#ffb347', weight: 0.35, scrap: 40 },
  };
  P.RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  // Random prefixes rolled on looted parts. hp/dmg/cd are fractions, luck/crit flat.
  P.MODS = {
    rusty: { name: 'Rusty', hp: -0.1, dmg: -0.1, price: 0.6, weight: 30, desc: '-10% HP & damage. Smells like a basement.' },
    polished: { name: 'Polished', dmg: 0.12, price: 1.3, weight: 22, weaponOnly: true, desc: '+12% damage.' },
    reinforced: { name: 'Reinforced', hp: 0.25, price: 1.3, weight: 22, needsHp: true, desc: '+25% HP.' },
    turbo: { name: 'Turbo', cd: -0.12, price: 1.4, weight: 16, weaponOnly: true, desc: '-12% cooldown.' },
    lucky: { name: 'Lucky', luck: 5, price: 1.3, weight: 14, desc: '+5 Luck.' },
    haunted: { name: 'Haunted', crit: 8, luck: 3, price: 1.5, weight: 7, desc: '+8% crit, +3 Luck. Hums at night.' },
    golden: { name: 'Golden', hp: 0.15, dmg: 0.15, luck: 5, price: 3, weight: 2, desc: '+15% HP & damage, +5 Luck. Ostentatious.' },
  };

  // Damage types: ballistic, melee, explosive, energy, fire
  P.DMG_TYPES = {
    ballistic: { name: 'Ballistic', color: '#ffe7a0', armor: 1.0 },
    melee: { name: 'Melee', color: '#ffffff', armor: 1.0 },
    explosive: { name: 'Explosive', color: '#ffa143', armor: 0.7 },
    energy: { name: 'Energy', color: '#6ff2ff', armor: 0.5 },
    fire: { name: 'Fire', color: '#ff6b2d', armor: 0.25 },
    burn: { name: 'Burn', color: '#ff9440', armor: 0 },
    self: { name: 'Self', color: '#9a9a9a', armor: 0 },
  };

  P.CATS = {
    chassis: { name: 'Chassis', icon: '▣' },
    head: { name: 'Head', icon: '◉' },
    legs: { name: 'Legs', icon: '⟂' },
    arm: { name: 'Arm', icon: '✦' },
    mount: { name: 'Hardpoint', icon: '▲' },
    module: { name: 'Module', icon: '◆' },
  };

  P.TARGETING = {
    random: 'Swings wildly at whatever it sees.',
    weapons: 'Prioritises enemy weapons (disarm).',
    legs: 'Prioritises enemy legs (topple).',
    weakest: 'Prioritises the most damaged part.',
    core: 'Prioritises the enemy chassis.',
  };

  const W = (o) => o;

  P.PARTS = {
    // ============================== CHASSIS ==============================
    dumpster_frame: {
      cat: 'chassis', name: 'Dumpster Frame', rarity: 'common', price: 60, weight: 30, hp: 120, armor: 2,
      chassis: { mounts: 1, modules: 1 }, tags: ['junk'], sprite: 'ch_dumpster',
      desc: 'A dumpster with a windshield. The lid still squeaks.',
    },
    fridge_frame: {
      cat: 'chassis', name: 'Fridge Frame', rarity: 'uncommon', price: 160, weight: 36, hp: 140, armor: 3,
      chassis: { mounts: 2, modules: 1 }, passive: { burnImmune: true }, tags: ['appliance'], sprite: 'ch_fridge',
      desc: 'Two hardpoints and a crisper drawer. Too cold to catch fire: immune to burning.',
    },
    boiler_frame: {
      cat: 'chassis', name: 'Boiler Frame', rarity: 'uncommon', price: 170, weight: 44, hp: 165, armor: 3,
      chassis: { mounts: 1, modules: 2 }, passive: { dmg: { fire: 0.15 } }, tags: ['pyro'], sprite: 'ch_boiler', glow: '#ff8a2a',
      desc: 'An old furnace. Tough, toasty, two module bays. Fire damage +20%.',
    },
    arcade_frame: {
      cat: 'chassis', name: 'Arcade Cabinet', rarity: 'rare', price: 260, weight: 32, hp: 125, armor: 2,
      chassis: { mounts: 1, modules: 3 }, passive: { luck: 6 }, tags: ['lucky'], sprite: 'ch_arcade', glow: '#ff5ad0', special: 'screen',
      desc: 'INSERT COIN. Three module bays and +6 Luck. Plays a jingle on crits.',
    },
    vault_frame: {
      cat: 'chassis', name: 'Bank Vault Frame', rarity: 'epic', price: 480, weight: 62, hp: 230, armor: 6,
      chassis: { mounts: 2, modules: 2 }, tags: [], sprite: 'ch_vault',
      desc: 'Stolen from a bank that was already being robbed. Extremely heavy, extremely armored.',
    },
    compactor_frame: {
      cat: 'chassis', name: 'Gilded Compactor', rarity: 'legendary', price: 900, weight: 66, hp: 240, armor: 5,
      chassis: { mounts: 2, modules: 2, big: 12 }, tags: ['demolition'], sprite: 'ch_compactor', noLoot: true,
      desc: "The Baron's personal garbage truck. Gold-plated. Smells faintly of victory and old yogurt.",
    },

    // ============================== HEADS ==============================
    bucket_head: {
      cat: 'head', name: 'Bucket Head', rarity: 'common', price: 20, weight: 4, hp: 25, armor: 0,
      head: { acc: 0, crit: 0, target: 'random' }, tags: ['junk'], sprite: 'hd_bucket', glow: '#ff5a3a', junkBin: true,
      desc: 'A bucket with a hole drilled in it. The hole is the sensor.',
    },
    traffic_light: {
      cat: 'head', name: 'Traffic Light', rarity: 'common', price: 45, weight: 5, hp: 30, armor: 0,
      head: { acc: 4, crit: 4, luck: 2, target: 'random' }, tags: ['junk'], sprite: 'hd_traffic', special: 'traffic',
      desc: 'Shows its mood: green is fine, yellow is worried, red is very worried.',
    },
    cyclops_lens: {
      cat: 'head', name: 'Cyclops Lens', rarity: 'uncommon', price: 110, weight: 5, hp: 30, armor: 1,
      head: { acc: 10, crit: 2, target: 'weapons' }, tags: [], sprite: 'hd_cyclops', glow: '#5ff3ff',
      desc: 'One big eye trained to spot guns and remove them.',
    },
    gramophone_radar: {
      cat: 'head', name: 'Gramophone Radar', rarity: 'uncommon', price: 100, weight: 6, hp: 32, armor: 0,
      head: { acc: 6, crit: 2, target: 'legs' }, tags: ['demolition'], sprite: 'hd_gramophone',
      desc: 'Listens for the creak of tired knees. Aims for legs.',
    },
    crt_monitor: {
      cat: 'head', name: 'CRT Monitor', rarity: 'uncommon', price: 120, weight: 7, hp: 34, armor: 0,
      head: { acc: 8, crit: 3, target: 'core' }, tags: ['appliance'], sprite: 'hd_crt', glow: '#7dff8a', special: 'crt',
      desc: 'Displays emoticons. Aims for the enemy chassis to end things quickly.',
    },
    owl_optics: {
      cat: 'head', name: 'Owl Optics', rarity: 'rare', price: 220, weight: 5, hp: 34, armor: 1,
      head: { acc: 15, crit: 8, target: 'weakest' }, tags: [], sprite: 'hd_owl', glow: '#ffd24a',
      desc: 'Twin telescopes. Finds the weakest part and keeps poking it.',
    },
    lucky_cat: {
      cat: 'head', name: 'Lucky Cat', rarity: 'rare', price: 200, weight: 5, hp: 30, armor: 0,
      head: { acc: 2, crit: 6, luck: 12, target: 'random' }, tags: ['lucky'], sprite: 'hd_cat',
      desc: 'A ceramic waving cat. +12 Luck. Accuracy is a matter of fortune.',
    },
    rubber_duck: {
      cat: 'head', name: 'Rubber Duck Commander', rarity: 'legendary', price: 520, weight: 3, hp: 42, armor: 1,
      head: { acc: 12, crit: 14, luck: 15, target: 'weakest' }, tags: ['lucky'], sprite: 'hd_duck', special: 'duck',
      desc: 'Nobody knows where it came from. Everybody follows its orders. Quack.',
    },

    // ============================== LEGS ==============================
    scrap_stompers: {
      cat: 'legs', name: 'Scrap Stompers', rarity: 'common', price: 50, weight: 14, hp: 80, armor: 1,
      legs: { type: 'biped', limbs: 2, speed: 1.0, eva: 6, cap: 100 }, tags: ['junk'], sprite: 'lg_stomper', junkBin: true,
      desc: 'Two legs. Losing one makes you wobble and fall over a lot.',
    },
    chicken_walkers: {
      cat: 'legs', name: 'Chicken Walkers', rarity: 'uncommon', price: 140, weight: 12, hp: 70, armor: 0,
      legs: { type: 'biped', limbs: 2, speed: 1.35, eva: 14, cap: 85 }, tags: [], sprite: 'lg_chicken',
      desc: 'Reverse-jointed and fast. Great for kiting. Bad for dignity.',
    },
    pogo_stilts: {
      cat: 'legs', name: 'Pogo Stilts', rarity: 'uncommon', price: 120, weight: 9, hp: 55, armor: 0,
      legs: { type: 'pogo', limbs: 2, speed: 1.2, eva: 24, cap: 72 }, tags: ['lucky'], sprite: 'lg_pogo',
      desc: 'Very hard to hit. Very hard to stop bouncing.',
    },
    bulldozer_treads: {
      cat: 'legs', name: 'Bulldozer Treads', rarity: 'uncommon', price: 170, weight: 22, hp: 140, armor: 3,
      legs: { type: 'treads', limbs: 1, speed: 0.62, eva: 0, cap: 170, stable: true }, tags: ['demolition'],
      sprite: 'lg_treads_a', spriteFrames: ['lg_treads_a', 'lg_treads_b'],
      desc: 'Slow, sturdy, never trips. Carries heavy builds.',
    },
    spider_legs: {
      cat: 'legs', name: 'Spider Legs', rarity: 'rare', price: 260, weight: 16, hp: 105, armor: 1,
      legs: { type: 'quad', limbs: 4, speed: 1.1, eva: 10, cap: 125 }, tags: [], sprite: 'lg_spider',
      desc: 'Four legs. Can lose two before it starts to care.',
    },
    leaf_blower_hover: {
      cat: 'legs', name: 'Leaf Blower Hover', rarity: 'rare', price: 240, weight: 10, hp: 62, armor: 0,
      legs: { type: 'hover', limbs: 1, speed: 1.3, eva: 16, cap: 92, stable: true }, tags: ['appliance'], sprite: 'lg_hover', glow: '#7fe7ff',
      desc: 'Six leaf blowers in a trench coat. Never trips — until it crashes.',
    },
    golden_treads: {
      cat: 'legs', name: 'Golden Treads', rarity: 'epic', price: 520, weight: 26, hp: 170, armor: 5,
      legs: { type: 'treads', limbs: 1, speed: 0.72, eva: 2, cap: 260, stable: true }, tags: [],
      sprite: 'lg_bigtreads_a', spriteFrames: ['lg_bigtreads_a', 'lg_bigtreads_b'], fixedPaint: { P: '#e8b84a' }, noLoot: true,
      desc: 'Bulldozer treads, dipped in gold. The Baron does not do subtle.',
    },

    // ============================== ARMS ==============================
    rivet_gun: {
      cat: 'arm', name: 'Rivet Gun', rarity: 'common', price: 40, weight: 8, hp: 35, armor: 0, tags: ['junk'], sprite: 'ar_rivet', junkBin: true,
      weapon: W({ type: 'ballistic', vfx: 'bullet', dmg: 6, cd: 0.75, range: [0, 330], opt: 150, acc: 5 }),
      desc: 'Pneumatic rivet gun. Reliable, accurate, slightly illegal.',
    },
    hydraulic_claw: {
      cat: 'arm', name: 'Hydraulic Claw', rarity: 'common', price: 50, weight: 10, hp: 45, armor: 1, tags: ['junk'], sprite: 'ar_claw', junkBin: true,
      weapon: W({ type: 'melee', vfx: 'claw', dmg: 13, cd: 1.5, reach: 62, rip: 0.3 }),
      desc: 'Melee. 30% chance to rip off an enemy part that is below 30% HP.',
    },
    plunger_launcher: {
      cat: 'arm', name: 'Plunger Launcher', rarity: 'common', price: 35, weight: 6, hp: 30, armor: 0, tags: ['junk'], sprite: 'ar_plunger', junkBin: true,
      weapon: W({ type: 'ballistic', vfx: 'plunger', dmg: 3, cd: 2.4, range: [0, 300], opt: 170, slow: 2.5 }),
      desc: 'Sticks a plunger on the enemy, slowing its movement and weapons for 2.5s.',
    },
    car_door_shield: {
      cat: 'arm', name: 'Car Door Shield', rarity: 'common', price: 45, weight: 12, hp: 90, armor: 4, tags: ['junk'], sprite: 'ar_door',
      utility: { kind: 'block', chance: 0.35 },
      desc: 'No weapon. 35% chance to intercept hits aimed at other parts. Window still rolls down.',
    },
    buzzsaw: {
      cat: 'arm', name: 'Buzzsaw Arm', rarity: 'uncommon', price: 110, weight: 9, hp: 38, armor: 0, tags: [],
      sprite: 'ar_saw_a', spriteFrames: ['ar_saw_a', 'ar_saw_b'],
      weapon: W({ type: 'melee', vfx: 'saw', dmg: 4, cd: 0.32, reach: 60, pierce: 0.5 }),
      desc: 'Melee. Very fast. Ignores half of the target armor.',
    },
    scrap_shotgun: {
      cat: 'arm', name: 'Scrap Shotgun', rarity: 'uncommon', price: 120, weight: 9, hp: 36, armor: 0, tags: [], sprite: 'ar_shotgun',
      weapon: W({ type: 'ballistic', vfx: 'pellet', dmg: 3, pellets: 5, cd: 1.6, range: [0, 240], opt: 80, falloff: true }),
      desc: 'Five pellets loaded with bolts, nails and regret. Weak at range.',
    },
    flamethrower: {
      cat: 'arm', name: 'Flamethrower', rarity: 'uncommon', price: 130, weight: 10, hp: 38, armor: 0, tags: ['pyro'], sprite: 'ar_flamer', glow: '#ff9a2a',
      weapon: W({ type: 'fire', vfx: 'flame', dmg: 2.6, burst: 3, burstGap: 0.14, cd: 1.4, range: [0, 110], opt: 70, burn: 0.25 }),
      desc: 'Short range. Mostly ignores armor. Sets parts on fire.',
    },
    arc_welder: {
      cat: 'arm', name: 'Arc Welder', rarity: 'uncommon', price: 125, weight: 8, hp: 36, armor: 0, tags: ['sparky'], sprite: 'ar_welder', glow: '#8fd8ff',
      weapon: W({ type: 'energy', vfx: 'arc', dmg: 7, cd: 1.0, range: [0, 125], opt: 80, chain: 1 }),
      desc: 'Short-range electric arc that jumps to a second part.',
    },
    boxing_glove: {
      cat: 'arm', name: 'Spring Glove', rarity: 'uncommon', price: 100, weight: 8, hp: 40, armor: 1, tags: [], sprite: 'ar_glove',
      weapon: W({ type: 'melee', vfx: 'glove', dmg: 8, cd: 1.6, reach: 78, knock: 46, stagger: 0.25 }),
      desc: 'BOING. Knocks enemies back and sometimes knocks them over.',
    },
    jackhammer: {
      cat: 'arm', name: 'Jackhammer', rarity: 'rare', price: 210, weight: 14, hp: 46, armor: 1, tags: ['demolition'], sprite: 'ar_drill',
      weapon: W({ type: 'melee', vfx: 'drill', dmg: 15, cd: 1.6, reach: 60, pierce: 1, coreBonus: 0.4, bias: 'core' }),
      desc: 'Melee. Ignores armor and deals +40% to chassis.',
    },
    laser_pointer: {
      cat: 'arm', name: 'Laser Pointer XL', rarity: 'rare', price: 230, weight: 7, hp: 34, armor: 0, tags: ['sparky'], sprite: 'ar_laser', glow: '#ff3a4a',
      weapon: W({ type: 'energy', vfx: 'laser', dmg: 11, cd: 1.4, range: [0, 430], opt: 230, acc: 20 }),
      desc: 'Do not point at eyes. Points at everything else. Very accurate.',
    },
    wrecking_ball: {
      cat: 'arm', name: 'Wrecking Ball', rarity: 'rare', price: 220, weight: 18, hp: 55, armor: 2, tags: ['demolition'], sprite: 'ar_wrecker',
      weapon: W({ type: 'melee', vfx: 'ball', dmg: 22, cd: 2.4, reach: 86, splash: 0.5, knock: 22, stagger: 0.15 }),
      desc: 'Long reach, slow swing, splashes a second part.',
    },
    baron_blunderbuss: {
      cat: 'arm', name: "Baron's Blunderbuss", rarity: 'epic', price: 480, weight: 12, hp: 60, armor: 1, tags: [], sprite: 'ar_blunder', noLoot: true,
      weapon: W({ type: 'ballistic', vfx: 'pellet', dmg: 3, pellets: 6, cd: 1.7, range: [0, 260], opt: 90, falloff: true }),
      desc: 'A shotgun with a family crest. Fires gold-plated buckshot.',
    },

    // ============================== HARDPOINT MOUNTS ==============================
    bottle_rockets: {
      cat: 'mount', name: 'Bottle Rocket Pod', rarity: 'common', price: 70, weight: 10, hp: 40, armor: 0, tags: [], sprite: 'mt_rockets',
      weapon: W({ type: 'explosive', vfx: 'rocket', dmg: 6, burst: 3, burstGap: 0.18, cd: 4.2, range: [30, 440], opt: 200, splash: 0.5 }),
      desc: 'Three bottle rockets per volley. Each splashes a nearby part.',
    },
    mortar_pipe: {
      cat: 'mount', name: 'Mortar Pipe', rarity: 'uncommon', price: 150, weight: 14, hp: 42, armor: 1, tags: ['demolition'], sprite: 'mt_mortar',
      weapon: W({ type: 'explosive', vfx: 'mortar', dmg: 24, cd: 5.0, range: [90, 440], opt: 220, acc: -10, splash: 0.5, bias: 'top' }),
      desc: 'Lobbed shell. Huge damage, needs distance, likes heads and hardpoints.',
    },
    toaster_lobber: {
      cat: 'mount', name: 'Toaster Lobber', rarity: 'uncommon', price: 130, weight: 9, hp: 38, armor: 0, tags: ['appliance', 'pyro'], sprite: 'mt_toaster', glow: '#ff7a2a',
      weapon: W({ type: 'explosive', vfx: 'toast', dmg: 7, burst: 2, burstGap: 0.25, cd: 3.0, range: [40, 320], opt: 150, burn: 0.3 }),
      desc: 'Launches flaming toast. 30% chance to set the part on fire.',
    },
    tesla_coil: {
      cat: 'mount', name: 'Tesla Coil', rarity: 'rare', price: 240, weight: 12, hp: 42, armor: 0, tags: ['sparky'], sprite: 'mt_tesla', glow: '#8fe1ff',
      weapon: W({ type: 'energy', vfx: 'tesla', dmg: 11, cd: 3.0, range: [0, 230], opt: 140, chain: 2 }),
      desc: 'Lightning that chains to two more parts.',
    },
    dish_cannon: {
      cat: 'mount', name: 'Satellite Dish Cannon', rarity: 'epic', price: 420, weight: 16, hp: 48, armor: 0, tags: ['sparky', 'appliance'], sprite: 'mt_dish', glow: '#b6f5ff',
      weapon: W({ type: 'energy', vfx: 'bigbeam', dmg: 34, cd: 6.5, charge: 1.4, range: [0, 440], opt: 260, acc: 10 }),
      desc: 'Charges for 1.4s, then fires a beam that gets 400 channels of pain.',
    },
    vending_cannon: {
      cat: 'mount', name: 'Vending Cannon', rarity: 'epic', price: 380, weight: 16, hp: 55, armor: 1, tags: ['appliance', 'lucky'], sprite: 'mt_vending',
      weapon: W({ type: 'ballistic', vfx: 'can', dmg: 10, cd: 2.2, range: [0, 360], opt: 170, vending: true }),
      desc: 'Fires random items: soda (damage), hot coffee (burn), snacks (heals you), or a JACKPOT. Luck helps.',
    },
    gilded_rockets: {
      cat: 'mount', name: 'Gilded Rocket Rack', rarity: 'epic', price: 460, weight: 12, hp: 60, armor: 1, tags: [], sprite: 'mt_goldrockets', noLoot: true,
      weapon: W({ type: 'explosive', vfx: 'rocket', dmg: 6, burst: 3, burstGap: 0.15, cd: 4.5, range: [30, 440], opt: 200, splash: 0.5 }),
      desc: 'Three rockets with tiny gold nosecones.',
    },
    jump_jets: {
      cat: 'mount', name: 'Jump Jets', rarity: 'uncommon', price: 140, weight: 8, hp: 36, armor: 0, tags: [], sprite: 'mt_jets', layer: 'back',
      utility: { kind: 'jets', eva: 12 },
      desc: '+12 Evasion. Keeps you mobile if you lose a leg (hop hop hop).',
    },
    repair_drone: {
      cat: 'mount', name: 'Repair Drone', rarity: 'rare', price: 230, weight: 6, hp: 30, armor: 0, tags: [], sprite: 'mt_dock', glow: '#7dff9a',
      utility: { kind: 'repair', amount: 5, interval: 2.5 },
      desc: 'Repairs the most damaged part for 5 HP every 2.5s. Cannot reattach lost parts.',
    },
    bubble_shield: {
      cat: 'mount', name: 'Bubble Shield', rarity: 'rare', price: 250, weight: 9, hp: 34, armor: 0, tags: ['sparky'], sprite: 'mt_bubble', glow: '#7fd9ff',
      utility: { kind: 'shield', cap: 30, regen: 2 },
      desc: 'Absorbs up to 30 damage, regenerates 2/s when not hit for a moment.',
    },
    scrap_plating: {
      cat: 'mount', name: 'Scrap Plating', rarity: 'common', price: 60, weight: 18, hp: 70, armor: 3, tags: ['junk'], sprite: 'mt_plating',
      utility: { kind: 'plating', armor: 2, chassisHp: 30 },
      desc: '+2 Armor to the whole mech and +30 chassis HP. Heavy.',
    },
    disco_ball: {
      cat: 'mount', name: 'Disco Decoy', rarity: 'uncommon', price: 120, weight: 5, hp: 28, armor: 0, tags: ['lucky'], sprite: 'mt_disco', glow: '#ffffff',
      utility: { kind: 'decoy', chance: 0.14 }, passive: { luck: 5 },
      desc: '14% of incoming ranged shots get dazzled and miss. +5 Luck.',
    },

    // ============================== MODULES (internal, no HP) ==============================
    duct_tape: {
      cat: 'module', name: 'Duct Tape Roll', rarity: 'common', price: 30, weight: 1, tags: ['junk'], passive: { hpMult: 0.1 },
      desc: '+10% HP on all parts. The universal fix.',
    },
    targeting_chip: {
      cat: 'module', name: 'Targeting Chip', rarity: 'common', price: 60, weight: 1, tags: [], passive: { acc: 12 },
      desc: '+12 Accuracy.',
    },
    fuzzy_dice: {
      cat: 'module', name: 'Fuzzy Dice', rarity: 'common', price: 50, weight: 1, tags: ['lucky'], passive: { luck: 5, crit: 4 }, trinket: 'tr_dice',
      desc: '+5 Luck, +4% crit. Hangs from the windshield.',
    },
    gyro_stabilizer: {
      cat: 'module', name: 'Gyro Stabilizer', rarity: 'uncommon', price: 120, weight: 4, tags: [], passive: { stable: true, eva: 2 },
      desc: 'Never trip over. Halves penalties from losing legs.',
    },
    coolant_tank: {
      cat: 'module', name: 'Coolant Tank', rarity: 'uncommon', price: 110, weight: 5, tags: ['sparky'], passive: { cd: { energy: -0.2 } },
      desc: 'Energy weapons recharge 20% faster.',
    },
    ammo_hopper: {
      cat: 'module', name: 'Ammo Hopper', rarity: 'uncommon', price: 110, weight: 5, tags: [], passive: { dmg: { ballistic: 0.2 } },
      desc: 'Ballistic damage +20%.',
    },
    lucky_horseshoe: {
      cat: 'module', name: 'Lucky Horseshoe', rarity: 'uncommon', price: 100, weight: 2, tags: ['lucky'], passive: { luck: 10 }, trinket: 'tr_shoe',
      desc: '+10 Luck. Better loot, more crits, the occasional miracle.',
    },
    hamster_wheel: {
      cat: 'module', name: 'Hamster Wheel', rarity: 'uncommon', price: 90, weight: 3, tags: [], passive: { speed: 0.15, eva: 4 }, trinket: 'tr_wheel',
      desc: '+15% Speed, +4 Evasion. His name is Gerald. He is doing his best.',
    },
    scrap_magnet: {
      cat: 'module', name: 'Scrap Magnet', rarity: 'uncommon', price: 100, weight: 4, tags: ['junk'], passive: { magnet: 15 },
      desc: 'When you destroy an enemy part, absorb the scrap: heal 15 chassis HP.',
    },
    overclocked_reactor: {
      cat: 'module', name: 'Overclocked Reactor', rarity: 'rare', price: 220, weight: 6, tags: [], passive: { cd: { all: -0.15 }, reactor: true },
      desc: 'All weapons 15% faster. Chassis takes 1 damage every 3s. It is fine.',
    },
    spite_engine: {
      cat: 'module', name: 'Spite Engine', rarity: 'rare', price: 200, weight: 4, tags: [], passive: { spite: 0.08 },
      desc: '+8% damage for every part you have lost this fight.',
    },
    napalm_injector: {
      cat: 'module', name: 'Napalm Injector', rarity: 'rare', price: 210, weight: 4, tags: ['pyro'], passive: { dmg: { fire: 0.3 }, napalm: 0.3 },
      desc: 'Fire damage +30%. Explosives have a 30% chance to set parts on fire.',
    },
  };

  for (const id in P.PARTS) P.PARTS[id].id = id;

  // ============================== SYNERGIES ==============================
  // Counted from tags on equipped parts. "Trigger Happy" counts ballistic weapons instead of tags.
  P.SYNERGIES = {
    junk: {
      name: 'Junk Pride', color: '#c7a56a',
      tiers: [
        { n: 3, desc: '+10% HP on all parts', fx: { hpMult: 0.1 } },
        { n: 5, desc: '+20% HP on all parts, +5 Luck', fx: { hpMult: 0.2, luck: 5 } },
      ],
    },
    pyro: {
      name: 'Pyromaniac', color: '#ff7a3a',
      tiers: [
        { n: 2, desc: 'Fire damage +15%', fx: { dmg: { fire: 0.15 } } },
        { n: 3, desc: 'Fire damage +25%, immune to burning', fx: { dmg: { fire: 0.25 }, burnImmune: true } },
      ],
    },
    sparky: {
      name: 'Live Wire', color: '#6fe0ff',
      tiers: [
        { n: 2, desc: 'Energy cooldowns -10%', fx: { cd: { energy: -0.1 } } },
        { n: 3, desc: 'Energy cooldowns -15%, energy damage +15%', fx: { cd: { energy: -0.15 }, dmg: { energy: 0.15 } } },
      ],
    },
    appliance: {
      name: 'Kitchen Nightmare', color: '#f0f0e0',
      tiers: [
        { n: 2, desc: '+8% HP on all parts', fx: { hpMult: 0.08 } },
        { n: 3, desc: '+8% HP, explosive damage +25%, +1 Armor', fx: { hpMult: 0.08, dmg: { explosive: 0.25 }, armor: 1 } },
      ],
    },
    lucky: {
      name: 'Feeling Lucky', color: '#7dff8a',
      tiers: [
        { n: 2, desc: '+8 Luck', fx: { luck: 8 } },
        { n: 3, desc: '+20 Luck, +5% crit', fx: { luck: 20, crit: 5 } },
      ],
    },
    demolition: {
      name: 'Demolition Crew', color: '#f2c23a',
      tiers: [
        { n: 2, desc: 'Melee & explosive damage +15%', fx: { dmg: { melee: 0.15, explosive: 0.15 } } },
        { n: 3, desc: 'Melee & explosive +15%, splash +25%, knockback +50%', fx: { dmg: { melee: 0.15, explosive: 0.15 }, splash: 0.25, knock: 0.5 } },
      ],
    },
    gunslinger: {
      name: 'Trigger Happy', color: '#ffe7a0', countWeaponType: 'ballistic',
      tiers: [{ n: 3, desc: 'Ballistic cooldowns -20%', fx: { cd: { ballistic: -0.2 } } }],
    },
  };

  // ============================== PAINTS ==============================
  P.PAINTS = [
    { id: 'rust', name: 'Rust Bucket', P: '#b8642f', S: '#6f7d5c' },
    { id: 'hazard', name: 'Hazard Yellow', P: '#d9a723', S: '#34343c' },
    { id: 'teal', name: 'Junkyard Teal', P: '#2f948a', S: '#d8b86a' },
    { id: 'hotrod', name: 'Hot Rod Red', P: '#c2362f', S: '#e6dccb' },
    { id: 'navy', name: 'Night Shift Navy', P: '#3b5592', S: '#e0a234' },
    { id: 'lawn', name: 'Lawn Ranger Green', P: '#5b9c3f', S: '#e8e4d4', unlock: 'f1' },
    { id: 'pickle', name: 'Pickle Purple', P: '#7d4fb0', S: '#9cc93c', unlock: 'f2' },
    { id: 'flambe', name: 'Crème Brûlée', P: '#e2d3b0', S: '#c8642a', unlock: 'f3' },
    { id: 'ohm', name: 'Lab Coat Frost', P: '#cfe3ea', S: '#3a8fe0', unlock: 'f4' },
    { id: 'deacon', name: 'Demolition Grey', P: '#686b73', S: '#e8b820', unlock: 'f5' },
    { id: 'baron', name: 'Gilded Tyrant', P: '#6a2f8c', S: '#e8b84a', unlock: 'boss' },
  ];
  P.PAINTS_BY_ID = {};
  for (const p of P.PAINTS) P.PAINTS_BY_ID[p.id] = p;

  // ============================== SLOTS ==============================
  P.slotCat = function (key) {
    if (key === 'armL' || key === 'armR') return 'arm';
    if (key.startsWith('mount')) return 'mount';
    if (key.startsWith('module')) return 'module';
    return key;
  };
  P.slotLabel = function (key) {
    const t = P.t || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => v[k]) : s));
    if (key === 'chassis') return t('Chassis');
    if (key === 'head') return t('Head');
    if (key === 'legs') return t('Legs');
    if (key === 'armR') return t('Right Arm');
    if (key === 'armL') return t('Left Arm');
    if (key.startsWith('mount')) return t('Hardpoint {n}', { n: Number(key.slice(5)) + 1 });
    if (key.startsWith('module')) return t('Module {n}', { n: Number(key.slice(6)) + 1 });
    return key;
  };
  // Slot list for a given chassis id
  P.slotsFor = function (chassisId) {
    const def = P.PARTS[chassisId];
    const mounts = def ? def.chassis.mounts : 0;
    const modules = def ? def.chassis.modules : 0;
    const keys = ['chassis', 'head', 'legs', 'armR', 'armL'];
    for (let i = 0; i < mounts; i++) keys.push('mount' + i);
    for (let i = 0; i < modules; i++) keys.push('module' + i);
    return keys;
  };

  P.itemName = function (item) {
    const def = P.PARTS[item.id];
    if (!def) return '???';
    let n = P.partName ? P.partName(item.id) : def.name;
    if (item.mod && P.MODS[item.mod]) n = P.t ? P.t('{mod} {name}', { mod: P.modName(item.mod), name: n }) : P.MODS[item.mod].name + ' ' + n;
    if (item.lvl) n += ' +' + item.lvl;
    return n;
  };
})();
