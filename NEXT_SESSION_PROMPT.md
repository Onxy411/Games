# Prompt for the next session

Paste everything below the line into a new Claude Code session in this folder.

---

You're working on Part-Time Pilot (read `CLAUDE.md` and `README.md` first). We brainstormed a direction; implement it in two phases. Plan before coding, keep `npm run check` passing, and bump `Sim.VERSION` if sim rules change.

## Design intent (decisions already made)

- **Money should hurt early, then matter more later.** Players should feel the wallet in Chapter 1, and only really see why money matters when scope grows to national and global scale ("you'd wish you invested early"). Facilities and investments bought early should pay off later.
- **Add repair fees.** Destroyed parts are lost forever (keep that), and loot flow stays as it is (don't reduce drops). Add fees on top, such as paying to repair damaged parts and entry/upkeep costs, so money is a real pressure. Tune with `npm run balance` and the scripted run in `tools/smoke.js`.
- **Facilities** are the main money sink: permanent upgrades to the operation (repair bay, tinker lab, scouting office, pit crew, sponsorship office, training sim, etc.). Keep the Pit Exchange as flavor. Propose a short list with costs before building.
- **Random opponents, themed to their character.** Each of Gary, the Pickle Twins, Flambé, Ohm, Deacon keeps their identity (Gary = cheap/junky domestic, Flambé = fire/acid, Ohm = electric/freeze, Deacon = heavy melee/treads, Twins = harpoon/chaos). Their parts are rolled from a themed pool, scaled by tier, with rolled mods and tinker levels. Seed per run so replays stay deterministic (replays already store builds). The Baron stays a fixed core with a few rolled slots and keeps his phase-2 twist. Scouting still shows the build.
- **Player only builds; battles stay fully automatic.** In squad play the player also chooses who goes where, but never controls fights.
- **No banned parts or weight classes.** Don't add rules restrictions to the public league.

## Phase 1: Chapter 1 polish

1. Repair fees and other early money pressure.
2. Facilities screen with a first set of upgrades.
3. Themed random opponents for bouts 1 to 5 and the Baron's rolled slots.

## Phase 2: Chapter 2, "The Public Arena" (playable)

Underground champion goes public. Design it so the player can play it and we can see what opens up.
- **Team bouts** (2v2, then 3v3): your mech plus allies. This needs the sim to support more than two combatants; plan that change carefully and bump `Sim.VERSION`.
- **Hired pilots with names and quirks** (themed like the opponents, e.g. a targeting style or a passive trait) piloting your additional mechs. The player builds their mechs and assigns pilots; fights stay automatic.
- **A second (and later third) mech** with its own build, so spare parts become useful.
- **Sponsors** (per-win pay, optional bonus conditions), **fame/crowd hype** that raises ticket revenue, and a **pit crew**.
- New bout ladder, arenas, dialogue and announcer lines for the public league; Marge goes legit, and the Baron can return in a new role.
- Make `S.bouts()` (currently hard-wired to `P.CHAPTER1`) chapter-aware, and carry Chapter 1 progress, facilities and money into Chapter 2.

## Later chapters (do not build, but don't design against them)

Ch3 The Invasion (Vexmoor): a squadron of 3 to 5 mechs, map missions, permanent attrition, government funding and upkeep. Ch4 World War: alliances, multiple fronts, supply. Ch5/6: run the nation, then the galaxy. Early facilities and investments should scale into these, so money feels redundant at first and then expensive.

## How to work

Start with a short written plan for Phase 1 (what changes, in which files, and the numbers you propose), implement it, run `npm run check` and `npm run balance`, and show me the result in the browser (`part-time-pilot` preview). Then do the same for Phase 2. Ask me before big design forks, and flag anything that could break existing saves or replays.
