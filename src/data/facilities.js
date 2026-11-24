// Part-Time Pilot — Facilities: permanent upgrades to the operation, and the main money sink.
// Level 1 is a real savings goal in Chapter 1; levels 2-3 are priced for Chapter 2 and beyond, where
// the same upgrade covers more mechs, more pilots and bigger purses ("should've invested early").
// Each level's fx replaces the previous level's (they are written cumulatively).
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});

  P.FACILITIES = [
    {
      id: 'repair_bay', name: 'Repair Bay', icon: '🔧',
      blurb: 'A real lift, real tools, and a guy named Sal who only swears at the machines.',
      later: 'Every mech you field gets repaired here: two or three in Chapter 2, a whole squadron in Chapter 3.',
      levels: [
        { cost: 270, desc: 'Repairs cost 20% less.', fx: { repairDisc: 0.2 } },
        { cost: 900, desc: "Repairs cost 35% less. A K.O.'d chassis is welded back to 50% HP instead of 25%.", fx: { repairDisc: 0.35, koWeld: 0.5 } },
        { cost: 2700, desc: 'Repairs cost 50% less. Night shift patches 25% of all damage for free after every bout.', fx: { repairDisc: 0.5, koWeld: 0.5, nightly: 0.25 } },
      ],
    },
    {
      id: 'tinker_lab', name: 'Tinker Lab', icon: '🧪',
      blurb: 'Oscilloscopes, a soldering station, and a fire extinguisher that has seen things.',
      later: 'Spare parts become second and third mechs in Chapter 2. Cheaper tinkering scales with your whole garage.',
      levels: [
        { cost: 330, desc: 'Tinkering costs 25% less scrap.', fx: { tinkerDisc: 0.25 } },
        { cost: 1100, desc: 'Tinkering costs 40% less scrap. Parts can be tinkered to +4.', fx: { tinkerDisc: 0.4, maxLvl: 4 } },
        { cost: 3000, desc: 'Tinkering costs 50% less scrap. Parts can be tinkered to +5.', fx: { tinkerDisc: 0.5, maxLvl: 5 } },
      ],
    },
    {
      id: 'scouting', name: 'Scouting Office', icon: '🔭',
      blurb: 'A desk, a corkboard with red string, and a bookie who owes Marge a favor.',
      later: 'Team bouts in Chapter 2 have more to read. Extra salvage adds up when you are fielding three mechs.',
      levels: [
        { cost: 220, desc: "Bookie's odds: the ladder shows your win chance over 40 simulated bouts with your current build.", fx: { odds: true } },
        { cost: 820, desc: 'Bookie\'s odds, plus one extra part to choose from after every win.', fx: { odds: true, salvageExtra: 1 } },
        { cost: 2400, desc: 'Bookie\'s odds, an extra salvage option, and salvage rights take TWO parts.', fx: { odds: true, salvageExtra: 1, salvagePicks: 2 } },
      ],
    },
    {
      id: 'sponsors', name: 'Sponsorship Office', icon: '🤝',
      blurb: 'Business cards, a fax machine, and a framed photo of a celebrity Marge definitely met.',
      later: 'Chapter 2 is televised: every level lets you hold one more sponsor contract (1 without the office).',
      levels: [
        { cost: 450, desc: 'Purses are 10% bigger. Chapter 2: 2 sponsor slots.', fx: { purse: 0.1 } },
        { cost: 1350, desc: 'Purses are 20% bigger. Chapter 2: 3 sponsor slots.', fx: { purse: 0.2 } },
        { cost: 3750, desc: 'Purses are 30% bigger. Chapter 2: 4 sponsor slots.', fx: { purse: 0.3 } },
      ],
    },
    {
      id: 'training', name: 'Training Sim', icon: '🕹',
      blurb: 'An arcade cabinet wired to a dentist chair. Very educational. Mostly safe.',
      later: 'In Chapter 2 every pilot you hire trains here too, so the bonus applies to your whole team.',
      levels: [
        { cost: 380, desc: 'Pilot skill: +3 Accuracy, +2 Evasion.', fx: { pilotAcc: 3, pilotEva: 2 } },
        { cost: 1200, desc: 'Pilot skill: +6 Accuracy, +4 Evasion.', fx: { pilotAcc: 6, pilotEva: 4 } },
        { cost: 3300, desc: 'Pilot skill: +10 Accuracy, +6 Evasion.', fx: { pilotAcc: 10, pilotEva: 6 } },
      ],
    },
    {
      id: 'merch', name: 'Merch Stand', icon: '🧢',
      blurb: 'Bootleg T-shirts of your own mech. Technically you are bootlegging yourself.',
      later: 'Chapter 2 has real crowds: merch income grows with your fame.',
      levels: [
        { cost: 300, desc: 'Earns $10 every bout ($15 on a win).', fx: { merch: 10 } },
        { cost: 1050, desc: 'Earns $25 every bout ($37 on a win).', fx: { merch: 25 } },
        { cost: 3000, desc: 'Earns $60 every bout ($90 on a win).', fx: { merch: 60 } },
      ],
    },
    {
      id: 'pit_crew', name: 'Pit Crew', icon: '🏁', chapter: 'ch2',
      blurb: 'Three cousins, one air wrench, matching jumpsuits. The jumpsuits were the expensive part.',
      later: 'Every mech in the lineup gets a pit stop. In Chapter 3 the crew follows your squadron into the field.',
      levels: [
        { cost: 750, desc: 'Once per bout, when a mech\'s chassis drops below 35%, the crew bolts on 15% of its HP.', fx: { pitStop: 0.15 } },
        { cost: 2000, desc: 'Pit stop restores 25% chassis HP.', fx: { pitStop: 0.25 } },
        { cost: 5000, desc: 'Pit stop restores 35% chassis HP.', fx: { pitStop: 0.35 } },
      ],
    },
  ];
  P.FACILITIES_BY_ID = {};
  for (const f of P.FACILITIES) P.FACILITIES_BY_ID[f.id] = f;

  // How much a full repair costs, as a fraction of a part's price (tinker levels and mods included).
  P.REPAIR_RATE = 0.15;
  // A K.O.'d chassis is welded back to this fraction of its HP for free.
  P.KO_WELD = 0.25;
})();
