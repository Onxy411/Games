// Part-Time Pilot — Chapter 1 campaign data: opponents, bouts, arenas, dialogue, announcer lines.
// To add a chapter later: add a new CHAPTERS entry with its own bouts and arenas.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});

  const it = (id, lvl, mod) => ({ id, lvl: lvl || 0, mod: mod || null });

  P.ENEMIES = {
    gary: {
      pilot: 'Gary Plimpton', mech: 'The Lawn Ranger', title: 'Suburban Dad', paint: 'lawn',
      quote: "I just came here to mow. Please don't tell my wife.",
      parts: {
        chassis: it('dumpster_frame'), head: it('bucket_head'), legs: it('scrap_stompers'),
        armR: it('rivet_gun'), armL: it('plunger_launcher'),
      },
      lose: "Okay. Okay. I'm gonna go mow something that doesn't fight back.",
    },
    twins: {
      pilot: 'The Pickle Twins', mech: 'Bunk Bot 2000', title: 'Two Kids, One Cockpit', paint: 'pickle',
      quote: 'We are TWO kids in ONE mech! We have a HARPOON! We will reel you in like a big dumb fish!',
      parts: {
        chassis: it('dumpster_frame'), head: it('traffic_light'), legs: it('chicken_walkers'),
        armR: it('rivet_gun', 1), armL: it('harpoon_gun'), mount0: it('bottle_rockets'), module0: it('fuzzy_dice'),
      },
      lose: "Mom's gonna be so mad. You tell her. No, YOU tell her.",
    },
    flambe: {
      pilot: 'Madame Flambé', mech: 'Crème Brûlée-tron', title: 'Disgraced Pastry Chef', paint: 'flambe',
      quote: 'Ze Pit is my kitchen, chéri. Ze flamethrower is for ze brûlée. Ze acid is for ze vinaigrette. And you? You are ze main course.',
      parts: {
        chassis: it('boiler_frame'), head: it('traffic_light'), legs: it('scrap_stompers'),
        armR: it('flamethrower'), armL: it('acid_sprayer'), mount0: it('toaster_lobber'),
        module0: it('duct_tape'), module1: it('fuzzy_dice'),
      },
      lose: 'Overcooked... by an amateur. I need to lie down in a walk-in freezer.',
    },
    ohm: {
      pilot: 'Professor Ohm', mech: 'The Fridge of Science', title: 'Mad Scientist (Adjunct)', paint: 'ohm',
      quote: 'My fridge has a PhD and a freeze ray. You have a dumpster. Resistance is futile — I measured it.',
      parts: {
        chassis: it('fridge_frame'), head: it('cyclops_lens'), legs: it('leaf_blower_hover'),
        armR: it('freeze_ray'), armL: it('arc_welder'), mount0: it('tesla_coil'), mount1: it('emp_coil'),
        module0: it('duct_tape'),
      },
      lose: 'Fascinating. Painful, but fascinating. I shall write a paper about it. From the hospital.',
    },
    deacon: {
      pilot: 'Deacon Demo', mech: 'The Wrecking Sermon', title: 'Demolition Preacher', paint: 'deacon',
      quote: 'Lord, bless this wrecking ball, and all the things it is about to make flat.',
      parts: {
        chassis: it('fridge_frame', 1), head: it('gramophone_radar'), legs: it('bulldozer_treads'),
        armR: it('hydraulic_sledge', 1), armL: it('wrecking_ball'), mount0: it('landmine_dropper', 1), mount1: it('scrap_plating'),
        module0: it('duct_tape'),
      },
      lose: 'The Lord giveth, and the dumpster taketh away. Amen, I guess.',
    },
    baron: {
      pilot: 'Baron Von Crusher', mech: 'The Gilded Compactor', title: 'Owner of the Scrap Pit', paint: 'baron', boss: true,
      quote: 'I own this pit, these pipes, these lights, and the concession stand. Soon I shall own your scrap!',
      parts: {
        chassis: it('compactor_frame'), head: it('owl_optics'), legs: it('golden_treads'),
        armR: it('baron_blunderbuss'), armL: it('jackhammer'), mount0: it('swarm_pod'), mount1: it('bubble_shield'),
        module0: it('overclocked_reactor'), module1: it('duct_tape'),
      },
      phase2: 'LIMITER OFF! Do you have ANY idea what my insurance premiums are?!',
      lose: 'My... my beautiful compactor... I will be in my panic room. It is also gold.',
    },
  };

  // Themed loadout pools: every run rolls each opponent's build from these (see src/game/opponents.js).
  // One entry = a signature part they always bring. Repeats weight the pick. 'id@2' = only from tier 2 up.
  // null = the slot may stay empty. lvl shifts the tier's tinker budget for that pilot.
  P.ENEMY_POOLS = {
    // Gary: cheap, junky, domestic. Whatever was in the garage.
    gary: {
      lvl: 0,
      slots: {
        chassis: ['dumpster_frame'],
        head: ['bucket_head', 'bucket_head', 'traffic_light'],
        legs: ['scrap_stompers'],
        armR: ['rivet_gun', 'rivet_gun', 'hydraulic_claw@1'],
        armL: ['plunger_launcher', 'plunger_launcher', 'car_door_shield', 'rivet_gun'],
        mount0: [null, null, 'scrap_plating', 'smoke_mortar@1'],
        module0: [null, 'duct_tape', 'fuzzy_dice'],
      },
    },
    // The Pickle Twins: a harpoon, and chaos.
    // (the @4 entries are their public-league upgrades in Chapter 2)
    twins: {
      lvl: 0,
      slots: {
        chassis: ['dumpster_frame', 'fridge_frame@4', 'fridge_frame@4', 'fridge_frame@4'],
        head: ['traffic_light', 'traffic_light', 'bucket_head', 'cyclops_lens@4', 'lucky_cat@4', 'lucky_cat@4'],
        legs: ['chicken_walkers', 'chicken_walkers', 'pogo_stilts', 'spider_legs@4', 'spider_legs@4', 'spider_legs@4'],
        armR: ['rivet_gun', 'rivet_gun', 'scrap_shotgun', 'boxing_glove', 'plunger_launcher', 'nail_minigun@4', 'nail_minigun@4', 'nail_minigun@4'],
        armL: ['harpoon_gun'],
        mount0: ['bottle_rockets', 'bottle_rockets', 'smoke_mortar', 'disco_ball', 'swarm_pod@4', 'swarm_pod@4', 'mortar_pipe@4'],
        mount1: ['bottle_rockets@4', 'disco_ball@4', 'smoke_mortar@4'],
        module0: ['fuzzy_dice', 'fuzzy_dice', 'hamster_wheel', 'lucky_horseshoe', 'lucky_horseshoe@4'],
      },
    },
    // Madame Flambé: fire and acid.
    flambe: {
      lvl: -1,
      slots: {
        chassis: ['boiler_frame'],
        head: ['traffic_light', 'traffic_light', 'bucket_head', 'crt_monitor@2'],
        legs: ['scrap_stompers', 'scrap_stompers', 'chicken_walkers'],
        armR: ['flamethrower'],
        armL: ['acid_sprayer', 'acid_sprayer', 'acid_sprayer', 'hydraulic_claw', 'flamethrower@2'],
        mount0: ['toaster_lobber', 'toaster_lobber', 'smoke_mortar'],
        module0: ['duct_tape', 'duct_tape', 'napalm_injector@2'],
        module1: ['fuzzy_dice', 'duct_tape', 'targeting_chip@2'],
      },
    },
    // Professor Ohm: electricity and ice.
    ohm: {
      lvl: -1,
      slots: {
        chassis: ['fridge_frame'],
        head: ['cyclops_lens', 'cyclops_lens', 'crt_monitor@3'],
        legs: ['leaf_blower_hover', 'leaf_blower_hover', 'pogo_stilts'],
        armR: ['freeze_ray'],
        armL: ['arc_welder', 'arc_welder', 'laser_pointer@3'],
        mount0: ['tesla_coil'],
        mount1: ['emp_coil', 'emp_coil', 'smoke_mortar', 'bubble_shield@3'],
        module0: ['duct_tape', 'duct_tape', 'targeting_chip', 'coolant_tank@3'],
      },
    },
    // Deacon Demo: heavy melee on treads.
    deacon: {
      lvl: 1,
      slots: {
        chassis: ['fridge_frame', 'fridge_frame', 'fridge_frame', 'boiler_frame'],
        head: ['gramophone_radar'],
        legs: ['bulldozer_treads'],
        armR: ['hydraulic_sledge', 'hydraulic_sledge', 'jackhammer'],
        armL: ['wrecking_ball', 'wrecking_ball', 'wrecking_ball', 'hydraulic_claw', 'buzzsaw@3'],
        mount0: ['landmine_dropper', 'landmine_dropper', 'mortar_pipe'],
        mount1: ['scrap_plating', 'scrap_plating', 'mortar_pipe'],
        module0: ['duct_tape', 'duct_tape', 'gyro_stabilizer', 'scrap_magnet'],
      },
    },
    // Baron Von Crusher: the gilded core never changes; the rest is whatever he bought this week.
    baron: {
      lvl: -1,
      slots: {
        chassis: ['compactor_frame'],
        head: ['owl_optics'],
        legs: ['golden_treads'],
        armR: ['baron_blunderbuss'],
        armL: ['jackhammer', 'jackhammer', 'wrecking_ball', 'hydraulic_sledge'],
        mount0: ['swarm_pod', 'swarm_pod', 'gilded_rockets', 'mortar_pipe'],
        mount1: ['bubble_shield', 'bubble_shield', 'repair_drone'],
        module0: ['overclocked_reactor', 'overclocked_reactor', 'spite_engine', 'ammo_hopper@4'],
        module1: ['duct_tape', 'duct_tape', 'gyro_stabilizer'],
      },
    },
  };

  // Arena themes for the environment painter
  P.ARENAS = {
    pit: {
      name: 'The Scrap Pit', sign: 'SCRAP PIT',
      sky: ['#07060c', '#1b1420', '#4a2c22'], haze: '#d98a4a', wall: '#3a3138', floor: '#4a4038', floorFar: '#2a2428',
      light: '#ffb766', accent: '#e0733a', crowd: '#2a2230', props: 'tires',
    },
    furnace: {
      name: 'The Boiler Room', sign: 'BOILER ROOM',
      sky: ['#0b0406', '#2a0e0c', '#6a2412'], haze: '#ff5a24', wall: '#3a2420', floor: '#4b2e24', floorFar: '#2a1612',
      light: '#ff7a3a', accent: '#ff4a1a', crowd: '#2a1414', props: 'furnace',
    },
    lab: {
      name: 'Generator Hall', sign: 'GENERATOR HALL',
      sky: ['#03070c', '#0b1a26', '#14384a'], haze: '#4ad0ff', wall: '#1e2c36', floor: '#2a3a44', floorFar: '#131e26',
      light: '#8fe8ff', accent: '#3ab8ff', crowd: '#142028', props: 'lab',
    },
    demo: {
      name: 'The Demolition Yard', sign: 'DEMO YARD',
      sky: ['#07070a', '#1c1a14', '#4a3a1a'], haze: '#e8c040', wall: '#3a372e', floor: '#4a4436', floorFar: '#262218',
      light: '#ffd66a', accent: '#f2c23a', crowd: '#24221c', props: 'demo',
    },
    gold: {
      name: "The Baron's Colosseum", sign: 'BARON VON CRUSHER',
      sky: ['#07040c', '#1e0e2a', '#4a1e4a'], haze: '#e8b84a', wall: '#3a2244', floor: '#3e2c3c', floorFar: '#1e1222',
      light: '#ffd98a', accent: '#e8b84a', crowd: '#22142a', props: 'gold',
    },
  };

  // The long road (from the original pitch). Only Chapter One is playable in this prototype.
  P.ROADMAP = [
    { n: 1, title: 'The Scrap Pit', blurb: 'Part-time junkyard worker becomes underground champion.' },
    { n: 2, title: 'The Invasion', blurb: 'The Ironclad Republic of Vexmoor invades. Your nation needs its champion.' },
    { n: 3, title: 'World War Scrap', blurb: 'More nations pile in. Lead your alliance to victory.' },
    { n: 4, title: 'Leader of the World', blurb: 'You won the war. Surprise: now you run the planet.' },
    { n: 5, title: 'Close Encounters of the Junk Kind', blurb: 'Aliens. They want our salvage. Lead humanity.' },
    { n: 6, title: 'Galactic Scrap Lord', blurb: 'Your mech evolves. Maybe you ARE the mech now. Rule the galaxy.' },
  ];

  P.CHAPTER1 = {
    id: 'ch1',
    title: 'Chapter One: The Scrap Pit',
    bouts: [
      { id: 'f1', enemy: 'gary', arena: 'pit', title: 'Bout 1 — Lawn and Disorder', reward: 60, fee: 0, tier: 0 },
      { id: 'f2', enemy: 'twins', arena: 'pit', title: 'Bout 2 — Double Trouble', reward: 90, fee: 10, tier: 1 },
      { id: 'f3', enemy: 'flambe', arena: 'furnace', title: 'Bout 3 — Kitchen Inferno', reward: 120, fee: 15, tier: 1 },
      { id: 'f4', enemy: 'ohm', arena: 'lab', title: 'Bout 4 — Ohm Sweet Ohm', reward: 150, fee: 20, tier: 2 },
      { id: 'f5', enemy: 'deacon', arena: 'demo', title: 'Bout 5 — The Wrecking Sermon', reward: 190, fee: 25, tier: 2 },
      { id: 'boss', enemy: 'baron', arena: 'gold', title: 'Title Bout — The Baron', reward: 500, fee: 40, tier: 3, boss: true },
    ],
  };

  P.DIALOGUE = {
    intro: [
      { who: 'Marge', text: "Kid. You've been sweeping this junkyard for six months. Minimum wage. Zero dental." },
      { who: 'Marge', text: "Word is there's an underground mech league under the old subway. The Scrap Pit. Prize money. Loot. Glory. Mostly loot." },
      { who: 'Marge', text: "I want in. You're piloting. I'm 'management'." },
      { who: 'Marge', text: "I welded you a starter mech out of that dumpster. Don't tell the insurance people." },
      { who: 'Marge', text: 'There\'s a Bottle Rocket Pod in your parts bin. Select "Hardpoint 1" on the left and bolt it on before you go.' },
      { who: 'Marge', text: "Then hit ENTER THE PIT. Parts that get blown off stay blown off, so check the Swap Meet and Workbench between bouts." },
    ],
    afterWin: {
      f1: [{ who: 'Marge', text: 'Ha! First paycheck. Pick through his scrap — winners get salvage rights. Read your battle report, too.' }],
      f2: [{ who: 'Marge', text: "Next up is some fancy chef with a flamethrower. Armor won't help much against fire. Think fast, or think bigger." }],
      f3: [{ who: 'Marge', text: 'The Professor fights from range with lightning. Pick something fast or something that hits back from far away.' }],
      f4: [{ who: 'Marge', text: "The Deacon goes for legs and hits like a church bell. Treads don't trip. Just sayin'." }],
      f5: [{ who: 'Marge', text: "That's it. Only the Baron left. He owns this whole pit. Spend everything. Upgrade everything. Pray to the Rubber Duck." }],
    },
    afterLoss: [
      { who: 'Marge', text: "You look terrible. Here's some hazard pay. Fix the mech, work a shift, try again. Sell some junk if you have to." },
    ],
    noShift: [{ who: 'Marge', text: "You already worked today. Go fight something. That's also work, technically." }],
    ending: [
      { who: 'Chip', text: 'LADIES! GENTLEMEN! SENTIENT TOASTERS! WE HAVE A NEW! CHAMPION! OF THE SCRAP PIIIIT!' },
      { who: 'Baron Von Crusher', text: 'My compactor... my pit... my concession stand... I shall be in my panic room. It is ALSO gold.' },
      { who: 'Marge', text: "Kid. We're rich. Rich-ish. We can finally afford dental. And maybe a second dumpster." },
      { who: 'Chip', text: 'Folks, why is the emergency broadcast system playing the national anthem? At a MECH FIGHT? That is NOT part of the show—' },
      { who: 'General Brassbottom', text: 'ATTENTION, CHAMPION. At 0400 hours the Ironclad Republic of Vexmoor crossed our border with ten thousand war-mechs.' },
      { who: 'General Brassbottom', text: 'Our army is mostly golf carts. Your nation requires its strongest pilot. That, regrettably, is you.' },
      { who: 'Marge', text: "Kid... they're drafting you. Ask about dental." },
      { who: 'General Brassbottom', text: 'Dental is included.' },
      { who: 'Marge', text: "...Grab a wrench, kid. Turns out we weren't building a pit fighter. We were building a war machine." },
    ],
  };

  // Announcer: Chip Chatterbox. {a}=attacker {d}=defender {p}=part
  P.ANNOUNCER = {
    start: ['AND THEY ARE OFF!', 'Bolts are flying, folks!', 'Ding ding! Somebody call an insurance adjuster!', 'Let the scrapping begin!'],
    firstBlood: ['First blood! Well, first oil.', '{a} draws first! The crowd goes mild!', 'And {a} opens the account!'],
    crit: ['Right in the warranty!', 'CRITICAL! That one is going on the highlight reel!', 'OOF! {d} felt that in the firmware!', 'Bullseye! Or bolt-seye!'],
    destroy_arm: ["{d}'s {p} has left the building!", '{d} is down an arm! Somebody fetch a mop!', "There goes the {p}! That's gonna void something!"],
    destroy_head: ['{d} has LOST THEIR HEAD! Literally!', "{d}'s {p} pops off like a champagne cork!", 'Heads up! No, really, heads UP!'],
    destroy_legs: ["{d}'s {p} are scrap! Somebody get them a scooter!", '{d} is legless! The crowd does a little wave!', "That's it for the {p}! {d} is going nowhere fast!"],
    destroy_mount: ["{d}'s {p} goes flying into the cheap seats!", 'Hardpoint gone! {d} is traveling light now!', '{p}: deleted!'],
    limb: ['SNAP! That leg is going in the recycling!', '{d} is hopping on one leg! Adorable! Terrifying!', 'Leg off! {d} is wobbling like a shopping cart!'],
    stumble: ['{d} trips over their own ambition!', 'TIMBER!', '{d} hits the floor! Get up, get up!', 'Whoops! Gravity remains undefeated!'],
    burn: ['{d} is ON FIRE! That is not a metaphor!', 'Something smells like burnt toast and bad decisions!', 'Toasty! Toasty!'],
    rip: ['{a} just RIPPED OFF the {p}! Brutal!', 'The claw takes a souvenir!'],
    heal: ['The repair drone is working overtime! Unpaid, of course!', 'A little patch job mid-fight! Very professional!'],
    lucky: ["{d}'s {p} survives with one HP! Luck stat? Luck stat!", 'MIRACLE! The {p} holds together on pure vibes!'],
    block: ['{d} blocks with a car door! Window still works!'],
    disarm: ['{d} has no weapons left! Is... is it headbutting?', '{d} is fully disarmed! Time for some aggressive leaning!'],
    lowhp: ['{d} is hanging on by duct tape and prayer!', '{d} is smoking! And not in a cool way!'],
    phase: ['THE BARON HAS TAKEN OFF THE SAFETY LIMITER! IS THAT LEGAL?! (IT IS NOT.)'],
    jackpot: ['JACKPOT! The vending machine pays out!'],
    ko: ['K.O.! Somebody fetch a broom!', 'DOWN GOES {d}! DOWN GOES {d}!', "And that's the bout! {d} is now a lawn ornament!"],
    chamber: ['{a} spins the cylinder... and the house LOSES!', 'Lady Luck is riding shotgun with {a} tonight!'],
    corrode: ["{d}'s armor is melting! Smells like a battery factory in here!", 'That acid is eating {d} alive. Metaphorically. Mostly.'],
    freeze: ['{d} is FROZEN SOLID! Somebody bring a hair dryer!', 'Ice to meet you, {d}!'],
    jam: ["{d}'s {p} just blue-screened!", 'EMP! {d} is rebooting! Please hold!'],
    blind: ["{d} can't see a thing! Swinging at shadows!", 'Smoke bomb! Very dramatic! Very rude!'],
    pull: ['{a} reels in {d} like a prize marlin!', 'Harpoon! {d} is coming in whether they like it or not!'],
    mine: ['{d} found a landmine! The hard way!', 'KA-BOOM! Watch your step, {d}!'],
    phoenix: ['{d} RISES FROM THE ASHES! Is that even legal?!', 'The Phoenix Core fires! {d} refuses to stay down!'],
    golem: ['{d} is absorbing the wreckage! It keeps getting BIGGER!', 'The Scrap Golem eats debris for breakfast!'],
    mimic: ['{a} just photocopied their opponent\'s weapon! Copyright lawyers are on their way!', 'Mimic Module online! {a} is fighting fire with... the exact same fire!'],
    timeout: ["TIME! To the judges! (It's one guy named Earl.)", "That's time! Earl is checking his clipboard!"],
  };
})();
