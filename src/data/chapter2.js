// Part-Time Pilot — Chapter 2: The Public Arena. The underground champion goes on television.
// Team bouts (2v2, then 3v3), hired pilots, sponsors, fame. Pure data; rules live in state.js / sim.js.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});

  // ---------------- new opponents (rolled from themed pools like Chapter 1) ----------------
  Object.assign(P.ENEMIES, {
    doug: {
      pilot: 'Doug Hedgeworth', mech: 'The Hedge Fund', title: "Gary's Neighbor", paint: 'hedge',
      quote: 'Gary said this would be fun. Gary says a lot of things.',
      lose: 'I am going to have a very long talk with Gary.',
    },
    mom: {
      pilot: 'Mama Pickle', mech: 'The Minivan', title: 'Soccer Mom, Retired Mech Racer', paint: 'minivan',
      quote: "You hurt my babies' feelings last season. Now you deal with ME.",
      lose: "Fine. Everybody in the van. We're getting ice cream and we are NOT talking about it.",
    },
    pierre: {
      pilot: 'Pierre Brûlé', mech: 'Le Petit Four', title: 'Sous-Chef, Professional Sidekick', paint: 'flambe',
      quote: 'Oui, chef! Yes, chef! I will set him on fire, chef!',
      lose: 'Chef is going to make me scrub ze grill. With my tongue.',
    },
    ampere: {
      pilot: 'Dr. Ampere', mech: 'Thesis Defense', title: 'Grad Student, Year Nine', paint: 'grad',
      quote: 'If I win, my advisor finally signs my dissertation. No pressure.',
      lose: 'Another year of grad school. Wonderful. Fantastic.',
    },
    igorina: {
      pilot: 'Igorina', mech: 'Lab Assistant 9000', title: 'Lab Assistant (Unpaid)', paint: 'grad',
      quote: 'Yes, Professor. Right away, Professor. Shield is charged, Professor.',
      lose: 'The Professor will want a full incident report. In triplicate.',
    },
    brother: {
      pilot: 'Brother Bulldozer', mech: 'The Collection Plate', title: 'Choir Tenor, Demolition Enthusiast', paint: 'choir',
      quote: 'The Lord loves a cheerful giver. I am about to give you a LOT.',
      lose: 'Forgive me, for I have dented.',
    },
    sister: {
      pilot: 'Sister Mortarina', mech: 'Hallelujah Howitzer', title: 'Choir Alto, Artillery Officer', paint: 'choir',
      quote: 'We sing on Sundays. On weekdays we shell.',
      lose: 'That was not in the hymnal.',
    },
    vance: {
      pilot: 'Vance Steel', mech: 'APEX-1 Paragon', title: 'Captain of Team Apex', paint: 'apex', boss: true,
      quote: 'Team Apex has won four championships, six product endorsements and one very lucrative lawsuit. You are a rounding error.',
      phase2: 'Apex protocol engaged. Please hold for our legal department.',
      lose: 'This is... this is going to tank our quarterly numbers.',
    },
    nova: {
      pilot: 'Nova Kilowatt', mech: 'APEX-2 Voltage', title: 'Apex Energy Specialist', paint: 'apex',
      quote: 'My mech runs on our sponsor\'s energy drink. So do I. I have not slept since March.',
      lose: 'I need... another can... of TurboMax...',
    },
    tank: {
      pilot: 'Tank Tankerton', mech: 'APEX-3 Bulwark', title: 'Apex Defensive Coordinator', paint: 'apex',
      quote: 'I am the wall. Walls do not have feelings. Walls have contracts.',
      lose: 'Walls... can... fall...',
    },
  });

  Object.assign(P.ENEMY_POOLS, {
    doug: {
      lvl: 0,
      slots: {
        chassis: ['dumpster_frame', 'dumpster_frame', 'fridge_frame'],
        head: ['traffic_light', 'gramophone_radar'],
        legs: ['scrap_stompers', 'chicken_walkers'],
        armR: ['buzzsaw', 'buzzsaw', 'hydraulic_claw'],
        armL: ['car_door_shield', 'car_door_shield', 'rivet_gun'],
        mount0: ['scrap_plating', 'smoke_mortar'],
        mount1: ['bottle_rockets', 'scrap_plating'],
        module0: ['duct_tape', 'hamster_wheel'],
      },
    },
    mom: {
      lvl: 0,
      slots: {
        chassis: ['fridge_frame', 'fridge_frame', 'vault_frame@5'],
        head: ['traffic_light', 'lucky_cat', 'owl_optics@5'],
        legs: ['bulldozer_treads'],
        armR: ['hydraulic_sledge', 'hydraulic_sledge', 'harpoon_gun'],
        armL: ['car_door_shield', 'wrecking_ball@5'],
        mount0: ['mortar_pipe', 'disco_ball', 'swarm_pod@5'],
        mount1: ['scrap_plating', 'repair_drone', 'bubble_shield@5'],
        module0: ['lucky_horseshoe', 'duct_tape'],
        module1: ['fuzzy_dice', 'duct_tape'],
      },
    },
    pierre: {
      lvl: 0,
      slots: {
        chassis: ['boiler_frame'],
        head: ['traffic_light', 'crt_monitor'],
        legs: ['chicken_walkers', 'scrap_stompers'],
        armR: ['flamethrower'],
        armL: ['flamethrower', 'acid_sprayer', 'boxing_glove'],
        mount0: ['toaster_lobber', 'toaster_lobber', 'mortar_pipe'],
        module0: ['napalm_injector', 'duct_tape'],
        module1: ['fuzzy_dice', 'coolant_tank'],
      },
    },
    ampere: {
      lvl: 0,
      slots: {
        chassis: ['fridge_frame', 'arcade_frame'],
        head: ['cyclops_lens', 'crt_monitor'],
        legs: ['leaf_blower_hover', 'pogo_stilts'],
        armR: ['laser_pointer', 'arc_welder'],
        armL: ['arc_welder', 'arc_welder', 'rivet_gun'],
        mount0: ['tesla_coil', 'dish_cannon@6'],
        mount1: ['emp_coil', 'bottle_rockets'],
        module0: ['targeting_chip', 'duct_tape'],
        module1: ['duct_tape', 'coolant_tank'],
        module2: ['lucky_horseshoe', 'targeting_chip'],
      },
    },
    igorina: {
      lvl: -1,
      slots: {
        chassis: ['fridge_frame'],
        head: ['cyclops_lens', 'owl_optics'],
        legs: ['leaf_blower_hover', 'spider_legs'],
        armR: ['freeze_ray'],
        armL: ['car_door_shield', 'plunger_launcher'],
        mount0: ['bubble_shield', 'emp_coil'],
        mount1: ['repair_drone', 'scrap_plating'],
        module0: ['duct_tape', 'gyro_stabilizer'],
      },
    },
    brother: {
      lvl: 1,
      slots: {
        chassis: ['fridge_frame', 'fridge_frame', 'fridge_frame', 'vault_frame@6'],
        head: ['gramophone_radar', 'crt_monitor'],
        legs: ['bulldozer_treads'],
        armR: ['wrecking_ball', 'hydraulic_sledge'],
        armL: ['hydraulic_claw', 'hydraulic_claw', 'wrecking_ball'],
        mount0: ['landmine_dropper', 'scrap_plating'],
        mount1: ['scrap_plating', 'landmine_dropper'],
        module0: ['scrap_magnet', 'gyro_stabilizer', 'spite_engine'],
      },
    },
    sister: {
      lvl: 0,
      slots: {
        chassis: ['fridge_frame', 'boiler_frame'],
        head: ['gramophone_radar', 'owl_optics'],
        legs: ['bulldozer_treads', 'spider_legs'],
        armR: ['jackhammer', 'scrap_shotgun'],
        armL: ['rivet_gun', 'nail_minigun'],
        mount0: ['mortar_pipe'],
        mount1: ['smoke_mortar', 'mortar_pipe', 'mortar_pipe', 'swarm_pod@6'],
        module0: ['ammo_hopper', 'duct_tape'],
        module1: ['duct_tape', 'gyro_stabilizer'],
      },
    },
    vance: {
      lvl: -2,
      slots: {
        chassis: ['vault_frame'],
        head: ['owl_optics'],
        legs: ['spider_legs'],
        armR: ['laser_pointer', 'nail_minigun'],
        armL: ['boomerang_saw', 'jackhammer'],
        mount0: ['junk_railgun'],
        mount1: ['scrap_plating', 'scrap_plating', 'bubble_shield'],
        module0: ['targeting_chip', 'overclocked_reactor'],
        module1: ['duct_tape', 'gyro_stabilizer'],
      },
    },
    nova: {
      lvl: -3,
      slots: {
        chassis: ['arcade_frame', 'fridge_frame'],
        head: ['cyclops_lens'],
        legs: ['leaf_blower_hover'],
        armR: ['arc_welder', 'laser_pointer'],
        armL: ['freeze_ray', 'arc_welder'],
        mount0: ['dish_cannon', 'tesla_coil'],
        mount1: ['emp_coil', 'emp_coil', 'bottle_rockets'],
        module0: ['coolant_tank'],
        module1: ['duct_tape', 'targeting_chip'],
        module2: ['lucky_horseshoe', 'duct_tape'],
      },
    },
    tank: {
      lvl: -2,
      slots: {
        chassis: ['vault_frame'],
        head: ['gramophone_radar', 'crt_monitor'],
        legs: ['bulldozer_treads'],
        armR: ['wrecking_ball', 'hydraulic_sledge'],
        armL: ['car_door_shield'],
        mount0: ['scrap_plating'],
        mount1: ['landmine_dropper', 'smoke_mortar'],
        module0: ['duct_tape', 'gyro_stabilizer'],
        module1: ['scrap_magnet', 'duct_tape'],
      },
    },
  });

  // Paints worn by the new teams. Some can be won; the rest are enemy-only.
  P.PAINTS.push(
    { id: 'minivan', name: 'Soccer Mom Beige', P: '#cdb894', S: '#7a2a3a', unlock: 'p2' },
    { id: 'studio', name: 'Prime Time Blue', P: '#2a6fd0', S: '#f2f2f2', unlock: 'p4' },
    { id: 'apex', name: 'Apex Platinum', P: '#e6ecef', S: '#19b2a8', unlock: 'boss2' },
    { id: 'hedge', name: 'Hedge Green', P: '#3f6b2a', S: '#8a6a3a', enemyOnly: true },
    { id: 'grad', name: 'Lab Grant White', P: '#e0e6da', S: '#5aa04a', enemyOnly: true },
    { id: 'choir', name: 'Choir Robes', P: '#2a2238', S: '#f0ead8', enemyOnly: true },
  );
  for (const p of P.PAINTS) P.PAINTS_BY_ID[p.id] = p;

  // ---------------- teams ----------------
  // units[0] is the point mech. unitTarget = how that pilot picks which of your mechs to attack.
  P.TEAMS = {
    lawn: {
      name: "Gary's Lawn Brigade", quote: "We're a TEAM now. We have matching polo shirts.", lose: "Okay, the polo shirts did not help.",
      units: [{ enemy: 'gary', lvl: 3 }, { enemy: 'doug', lvl: 2 }],
    },
    pickles: {
      name: 'The Pickle Family', quote: 'MOM IS HERE. MOM HAS A HARPOON TOO.', lose: 'Everybody in the van.',
      units: [{ enemy: 'mom', unitTarget: 'weakest', lvl: 4 }, { enemy: 'twins', lvl: 5 }],
    },
    kitchen: {
      name: 'The Kitchen Brigade', quote: 'Tonight ze special is YOU. Flambéed. With a side of acid.', lose: 'Ze kitchen is closed.',
      units: [{ enemy: 'flambe' }, { enemy: 'pierre', unitTarget: 'focus' }],
    },
    science: {
      name: 'Department of Applied Violence', quote: 'Three scientists. One hypothesis: you lose.', lose: 'Hypothesis rejected. Funding also rejected.',
      units: [{ enemy: 'ohm', lvl: -2 }, { enemy: 'ampere', lvl: -2 }, { enemy: 'igorina', unitTarget: 'weakest', lvl: -2 }],
    },
    choir: {
      name: 'The Demolition Congregation', quote: 'Let us all rise... and fall... on YOU.', lose: 'Go in peace. Mostly in pieces.',
      units: [{ enemy: 'deacon', lvl: 4, mod: -0.2 }, { enemy: 'brother', unitTarget: 'lead', lvl: 4, mod: -0.2 }, { enemy: 'sister', lvl: 4, mod: -0.2 }],
    },
    apex: {
      name: 'Team Apex', quote: 'Four-time champions. Brought to you by TurboMax.', lose: 'Our sponsors will be in touch. With lawyers.',
      units: [{ enemy: 'vance', unitTarget: 'focus', mod: -0.25 }, { enemy: 'tank', unitTarget: 'lead', mod: -0.25 }, { enemy: 'nova', unitTarget: 'weakest', mod: -0.25 }],
    },
  };

  // ---------------- arenas ----------------
  Object.assign(P.ARENAS, {
    dome: {
      name: 'The Metro Dome', sign: 'METRO DOME',
      sky: ['#05070f', '#101a33', '#26315a'], haze: '#7aa6ff', wall: '#262c44', floor: '#3a3f52', floorFar: '#1c2030',
      light: '#fff1c8', accent: '#3a8fff', crowd: '#1c2034', props: 'stadium',
    },
    studio: {
      name: 'Channel 6 Studio B', sign: 'CHANNEL 6 LIVE',
      sky: ['#07040a', '#22101e', '#4a1838'], haze: '#ff5aa8', wall: '#2e1a2c', floor: '#3a2a38', floorFar: '#1e1220',
      light: '#ffd8f0', accent: '#ff3a8a', crowd: '#24142a', props: 'stadium',
    },
    apex: {
      name: 'Apex Arena', sign: 'APEX ARENA',
      sky: ['#020809', '#0a2226', '#124a4a'], haze: '#3affe0', wall: '#16302f', floor: '#2a3c3c', floorFar: '#122222',
      light: '#e8fffb', accent: '#19d2c0', crowd: '#10221f', props: 'stadium',
    },
  });

  P.CHAPTER2 = {
    id: 'ch2',
    title: 'Chapter Two: The Public Arena',
    short: 'The Public Arena',
    bouts: [
      { id: 'p1', team: 'lawn', size: 2, arena: 'dome', title: 'Bout 1 — Opening Night', reward: 320, fee: 60, tier: 4 },
      { id: 'p2', team: 'pickles', size: 2, arena: 'dome', title: 'Bout 2 — Family Feud', reward: 400, fee: 70, tier: 5 },
      { id: 'p3', team: 'kitchen', size: 2, arena: 'studio', title: 'Bout 3 — Kitchen Nightmares, Live', reward: 480, fee: 80, tier: 5 },
      { id: 'p4', team: 'science', size: 3, arena: 'studio', title: 'Bout 4 — Peer Review', reward: 620, fee: 100, tier: 4 },
      { id: 'p5', team: 'choir', size: 3, arena: 'dome', title: 'Bout 5 — Hymns of Destruction', reward: 780, fee: 120, tier: 6 },
      { id: 'boss2', team: 'apex', size: 3, arena: 'apex', title: 'Championship — Team Apex', reward: 1600, fee: 150, tier: 5, boss: true },
    ],
  };
  P.CHAPTER1.short = 'The Scrap Pit';
  P.CHAPTERS = { ch1: P.CHAPTER1, ch2: P.CHAPTER2 };
  P.CHAPTER_ORDER = ['ch1', 'ch2'];

  // ---------------- hired pilots ----------------
  // fx is merged into the mech like a passive. unitTarget = which enemy mech they go after.
  // fee = signing bonus (once), wage = paid every bout they fight.
  P.PILOTS = [
    { id: 'rosa', name: 'Rosa "Rivets" Ramirez', title: 'Retired Riveter', quirk: 'Sharpshooter', fee: 260, wage: 25,
      desc: '+10 Accuracy, +4% crit.', fx: { acc: 10, crit: 4 }, bio: 'Thirty years on the assembly line. Has never missed a rivet. Has never missed a mech.' },
    { id: 'tony', name: 'Big Tony Two-Tons', title: 'Forklift Champion (3x)', quirk: 'Iron Nerves', fee: 220, wage: 20,
      desc: 'Never trips. +8% HP on all parts.', fx: { stable: true, hpMult: 0.08 }, bio: 'Once drove a forklift through a hurricane. Says it was "breezy".' },
    { id: 'ziggy', name: 'Ziggy Zoom', title: 'Pizza Delivery Legend', quirk: 'Lead Foot', fee: 200, wage: 20,
      desc: '+20% speed, +6 Evasion.', fx: { speed: 0.2, eva: 6 }, bio: 'Thirty minutes or less. Thirty seconds or less, in a mech.' },
    { id: 'grandma', name: 'Grandma Gearheart', title: 'Knits. Welds.', quirk: 'Mechanic', fee: 320, wage: 30,
      desc: 'Patches the most damaged part for 4 HP every 4 seconds.', fx: { mechanic: 4 }, bio: 'Brings cookies to every bout. Fixes your mech with a crochet hook and spite.' },
    { id: 'sarge', name: 'Sergeant Sprocket', title: 'Drill Instructor (Retired)', quirk: 'Focus Fire', fee: 260, wage: 25,
      desc: 'Always attacks whatever your lead mech is attacking. +5 Accuracy.', fx: { acc: 5 }, unitTarget: 'focus', bio: 'Yells "FOCUS!" at everything. Including toast.' },
    { id: 'mina', name: 'Mina "The Shark" Okafor', title: 'Former Pit Bookie', quirk: 'Bully', fee: 300, wage: 30,
      desc: 'Goes after the most damaged enemy mech. +8% damage.', fx: { dmg: { all: 0.08 } }, unitTarget: 'weakest', bio: 'Knows the odds on everything. Likes them best when they are 100 to 0.' },
    { id: 'lou', name: 'Lucky Lou', title: 'Professional Scratch-Card Enthusiast', quirk: 'Lucky Charm', fee: 240, wage: 25,
      desc: '+15 Luck.', fx: { luck: 15 }, bio: 'Has a four-leaf clover tattoo, a rabbit foot and a horseshoe. Lost all three. Still lucky.' },
    { id: 'gary_p', name: 'Gary Plimpton', title: 'Suburban Dad (On the Clock)', quirk: 'Lawn Order', fee: 120, wage: 12, unlock: 'p1',
      desc: '+2 Armor. Cheap. Very polite.', fx: { armor: 2 }, bio: 'His wife found out. She says this counts as a hobby. He is thrilled.' },
    { id: 'baron_p', name: 'Baron Von Crusher', title: 'Humbled Ex-Owner', quirk: 'Limiter Off', fee: 900, wage: 80, unlock: 'p3',
      desc: 'Below 50% chassis HP: +25% weapon speed, +30% speed, +10% damage. +10% HP.', fx: { phase2: true, hpMult: 0.1 },
      bio: 'Lost the pit, the compactor and the concession stand. Kept the monocle. Needs the money. Do not tell anyone.' },
  ];
  P.PILOTS_BY_ID = {};
  for (const p of P.PILOTS) P.PILOTS_BY_ID[p.id] = p;

  // ---------------- sponsors ----------------
  // pay = per win. bonus = extra pay when the condition is met on a win. bouts = contract length.
  // fame = how famous you need to be before they call.
  P.SPONSOR_CONDS = {
    win: { text: 'win' },
    ko: { text: 'win by knockout' },
    fast: { text: 'win in under {n} seconds' },
    noLoss: { text: 'win without losing a single part' },
    allStand: { text: 'win with every one of your mechs still standing' },
    crits: { text: 'land {n}+ critical hits' },
    parts: { text: 'destroy {n}+ enemy parts' },
    fire: { text: 'deal {n}+ fire damage' },
    energy: { text: 'deal {n}+ energy damage' },
    melee: { text: 'deal {n}+ melee damage' },
  };
  P.SPONSORS = [
    { id: 'bolts', name: "Bolt's Salvage & Sundries", pay: 30, bonus: { cond: 'win', pay: 20 }, bouts: 4, fame: 0, blurb: "Marge sponsors you. She's also docking it from your paycheck." },
    { id: 'pickleade', name: 'Pickle-Ade', pay: 45, bonus: { cond: 'ko', pay: 90 }, bouts: 3, fame: 0, blurb: 'The Pickle Twins went big. It tastes like pickles. And lemonade. At the same time.' },
    { id: 'lawncare', name: "Gary's Lawn Care LLC", pay: 35, bonus: { cond: 'noLoss', pay: 110 }, bouts: 4, fame: 0, blurb: 'Gary would like you to stay in one piece. He is a worrier.' },
    { id: 'foodtruck', name: "Flambé's Flaming Food Truck", pay: 55, bonus: { cond: 'fire', n: 120, pay: 130 }, bouts: 3, fame: 10, blurb: 'Set things on fire. Ze brand demands it.' },
    { id: 'bowling', name: 'Lucky Strike Lanes', pay: 50, bonus: { cond: 'crits', n: 8, pay: 110 }, bouts: 3, fame: 10, blurb: 'Strikes! Spares! Critical structural failures!' },
    { id: 'fusion', name: 'Ohm Cold Fusion Labs', pay: 70, bonus: { cond: 'energy', n: 200, pay: 150 }, bouts: 3, fame: 20, blurb: 'Science! Lasers! Liability waivers!' },
    { id: 'demo', name: 'Deacon Demolition & Sons', pay: 70, bonus: { cond: 'parts', n: 8, pay: 140 }, bouts: 3, fame: 20, blurb: 'Every part you knock off is a testimonial.' },
    { id: 'turbomax', name: 'TurboMax Energy Drink', pay: 90, bonus: { cond: 'fast', n: 35, pay: 220 }, bouts: 3, fame: 35, blurb: "Team Apex's sponsor wants a backup plan. Be fast. Be loud. Be caffeinated." },
    { id: 'megamart', name: 'MegaMart', pay: 120, bonus: { cond: 'allStand', pay: 180 }, bouts: 4, fame: 50, blurb: 'Family values. Low prices. No mechs left behind.' },
    { id: 'gold_ins', name: 'Von Crusher Gold Insurance', pay: 140, bonus: { cond: 'melee', n: 250, pay: 160 }, bouts: 3, fame: 60, blurb: 'The Baron sold his monocle collection and started an insurance company. Coverage not guaranteed.' },
  ];
  P.SPONSORS_BY_ID = {};
  for (const s of P.SPONSORS) P.SPONSORS_BY_ID[s.id] = s;

  // ---------------- story ----------------
  // Chapter 1's ending now takes you public; the Vexmoor invasion is the Chapter 2 finale.
  P.DIALOGUE.ending = [
    { who: 'Chip', text: 'LADIES! GENTLEMEN! SENTIENT TOASTERS! WE HAVE A NEW! CHAMPION! OF THE SCRAP PIIIIT!' },
    { who: 'Baron Von Crusher', text: 'My compactor... my pit... my concession stand... I shall be in my panic room. It is ALSO gold.' },
    { who: 'Marge', text: "Kid. We're rich. Rich-ish. We can finally afford dental. And maybe a second dumpster." },
    { who: 'Chip', text: "Folks, why are there TV cameras in the pit? Who let the guy in the very shiny suit in? Earl, did you sell the broadcast rights again?" },
    { who: 'Commissioner Hayes', text: 'Gloria Hayes, National Mech League. The underground is out. Television is in. We would like to offer you a spot in the Public Arena.' },
    { who: 'Commissioner Hayes', text: 'Team bouts. Prime time. Sponsors. Your face on a lunchbox. The league pays a purse, the crowd pays the bills.' },
    { who: 'Marge', text: '...Does the league have dental?' },
    { who: 'Commissioner Hayes', text: 'Dental AND vision.' },
    { who: 'Marge', text: "Kid, we're going legit. Get a second mech ready. And a haircut." },
  ];
  P.DIALOGUE.ch2intro = [
    { who: 'Marge', text: 'Welcome to the big leagues, kid. I bought a headset. I am now your "Team Manager". It says so on the headset.' },
    { who: 'Marge', text: "League rules: team bouts. Two mechs a side to start, three later. I welded you a second frame out of the old dumpster's cousin." },
    { who: 'Marge', text: 'You pilot the first mech. The second one needs a pilot. Open the TEAM OFFICE to hire one. They want a signing bonus AND a wage. Welcome to payroll.' },
    { who: 'Marge', text: 'Sponsors pay you to win, and extra if you win their way. Fame fills the seats, and seats pay. Keep the crowd happy.' },
    { who: 'Marge', text: "Repairs, wages, entry fees... it adds up fast with two mechs. Good thing we've been investing in the garage. Right? RIGHT?" },
  ];
  P.DIALOGUE.afterWin.p1 = [{ who: 'Marge', text: "First televised win! Gary says he'll pilot for us if we ever need him. He's cheap. Check the Team Office." }];
  P.DIALOGUE.afterWin.p2 = [{ who: 'Marge', text: 'Mama Pickle sends her regards and a casserole. Next up: Flambé brought backup. Fire is going to be a theme.' }];
  P.DIALOGUE.afterWin.p3 = [
    { who: 'Marge', text: "That's two-on-two handled. From here on it's three-on-three. I built a third mech bay out of the old concession stand." },
    { who: 'Marge', text: "Also... the Baron called. He's broke. He wants a job. He's expensive, but he still has that limiter switch." },
  ];
  P.DIALOGUE.afterWin.p4 = [{ who: 'Marge', text: "The Deacon brought his whole choir. They hit like a pipe organ falling down the stairs. Bring something sturdy up front." }];
  P.DIALOGUE.afterWin.p5 = [{ who: 'Marge', text: "That's it. Team Apex. Four-time champions with a corporate budget. We have duct tape and attitude. Spend it all." }];
  P.DIALOGUE.ending2 = [
    { who: 'Chip', text: 'UNBELIEVABLE! THE JUNKYARD UNDERDOGS HAVE TAKEN DOWN TEAM APEX! THE CROWD IS ON ITS FEET! SOMEBODY THREW A LUNCHBOX!' },
    { who: 'Vance Steel', text: 'Our quarterly numbers... our endorsements... I am going to have to fly COACH.' },
    { who: 'Marge', text: 'National champions, kid. We have dental, vision, AND a parking spot.' },
    { who: 'Chip', text: 'Folks, why is the emergency broadcast system playing the national anthem? At the CHAMPIONSHIP? That is NOT part of the show—' },
    { who: 'General Brassbottom', text: 'ATTENTION, CHAMPIONS. At 0400 hours the Ironclad Republic of Vexmoor crossed our border with ten thousand war-mechs.' },
    { who: 'General Brassbottom', text: 'Our army is mostly golf carts. Your nation requires its strongest team. That, regrettably, is you.' },
    { who: 'Marge', text: "Kid... they're drafting the whole team. Ask about funding." },
    { who: 'General Brassbottom', text: 'Funding is included. Upkeep is not.' },
    { who: 'Marge', text: "...Grab a wrench, kid. Turns out we weren't building a pit fighter. We were building an army." },
  ];

  P.ROADMAP.length = 0;
  P.ROADMAP.push(
    { n: 1, title: 'The Scrap Pit', blurb: 'Part-time junkyard worker becomes underground champion.' },
    { n: 2, title: 'The Public Arena', blurb: 'Team bouts on prime-time TV. Pilots, sponsors, and a crowd to please.' },
    { n: 3, title: 'The Invasion', blurb: 'The Ironclad Republic of Vexmoor invades. Command a squadron, fight map missions, mind the upkeep.' },
    { n: 4, title: 'World War Scrap', blurb: 'More nations pile in. Alliances, multiple fronts, supply lines.' },
    { n: 5, title: 'Leader of the Nation', blurb: 'You won the war. Surprise: now you run the country.' },
    { n: 6, title: 'Galactic Scrap Lord', blurb: 'Aliens want our salvage. Your mech evolves. Rule the galaxy.' },
  );

  // Announcer lines for team bouts
  Object.assign(P.ANNOUNCER, {
    teamKo: ['{d} is DOWN! But the team fights on!', "{d} is out of the fight! It's a numbers game now!", '{d} has been sent to the bench! Permanently! For today!'],
    focus: ['{a} is calling the shots! Everybody on {d}!', 'Focus fire on {d}! That is TEAMWORK, folks!'],
    pit: ['PIT STOP! The crew slaps a fresh plate on {d}!', 'The pit crew sprints in! {d} is back in business!'],
    mechanic: ['{d} gets a quick patch-up from the cockpit!'],
    tvStart: ['LIVE from the Public Arena! Brought to you by our sponsors!', 'And we are LIVE! Wave to the cameras, folks!', 'Welcome back to prime time scrapping!'],
  });
})();
