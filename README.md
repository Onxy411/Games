# Part-Time Pilot

A comedic auto-battling mech builder. You're a part-time worker at Bolt's Salvage who bolts a mech together
out of a dumpster and enters the underground Scrap Pit league. Combat is fully automated: you build, you
watch, you loot, you rebuild.

- **Chapter One: The Scrap Pit** — six one-on-one bouts ending in a boss fight against Baron Von Crusher.
- **Chapter Two: The Public Arena** — the underground champion goes on television: 2v2 and 3v3 team bouts,
  hired pilots, sponsors and fame, ending against the four-time champions, Team Apex.

Available in **English** and **Tiếng Việt** (Vietnamese): pick the language on the title screen or in the Menu.

## Launching

Any one of these:

1. **Windows build**: unzip `Part-Time-Pilot-win.zip` and run `Part-Time Pilot.exe` (no install needed).
2. **Double-click `Play.bat`** (Windows). If Node.js is installed it starts a tiny local server and opens
   your browser at http://localhost:8080; otherwise it opens `index.html` directly.
3. **`npm start`** (or `node server.js`) in this folder, then visit http://localhost:8080.
   `npm run serve` starts the server without opening a browser.
4. **Open `index.html`** directly in Chrome or Edge. No build step is needed: it's plain JavaScript.

The game runs at any 16:9 window size; fullscreen (F11) looks best. Save data lives in the browser's
localStorage (or the desktop app's own storage) and autosaves after every change. Fonts load from Google
Fonts; offline, it falls back to a monospace font.

## Building the Windows version

`npm run build:win` installs Electron into `desktop/` (first time only), copies the game in, and writes
`desktop/dist/Part-Time-Pilot-win.zip` (about 160 MB). Testers unzip it anywhere and run
`Part-Time Pilot.exe`. The exe is not code-signed, so Windows SmartScreen may say "Windows protected your
PC": click **More info → Run anyway**. Desktop saves live in `%APPDATA%\Part-Time Pilot` (separate from
browser saves). F11 toggles fullscreen.

## How to play

1. **Junkyard hub**: click a slot on the left (Chassis, Head, Legs, Arms, flexible Hardpoints, Modules) and
   pick a part on the right. Hovering a part previews it on the mech and shows stat deltas in the middle.
   Pick a paint job, watch for synergy badges (matching part tags unlock bonuses), and keep the Load under
   what your legs can carry.
2. **Enter the Pit**: the ladder shows a scouting report for every opponent (their parts, stats and damage
   types) so you can counter-build. Each opponent rolls a themed loadout for your run; it stays the same
   until you beat them.
3. **Battle**: fully automatic. Controls: pause (Space), speed 1x / 2x / 4x (keys 1 / 2 / 3), skip (S).
4. **Report**: payout (purse, bonuses, fees, wages), damage dealt and taken, per-part damage and destruction,
   per-weapon accuracy and damage, a cumulative-damage graph, and the repair bill. Winners claim an intact
   enemy part (salvage rights) and open loot crates.
5. **Between bouts**:
   - **Workbench**: repair damaged parts; tinker (+12% HP/damage per level); salvage spare parts into scrap;
     build **Prototypes** from blueprints.
   - **Facilities**: permanent upgrades — Repair Bay, Tinker Lab, Scouting Office, Sponsorship Office,
     Training Sim, Merch Stand, and (Chapter 2) Pit Crew. Level 1 is a real savings goal in Chapter 1;
     the higher levels pay off as the operation grows.
   - **Work a Shift**: scavenge one pile per day for wages, parts and the odd blueprint.
   - **Swap Meet**: buy, or sell (sortable). The free Junk Bin means you can never get stuck.
   - **Junk-o-Matic 3000**: feed it 3 spare parts and get 1 random part back, with live odds.
   - **Pit Exchange**: invest in silly ventures. Prices move once a day.
   - Press **M** any time to mute or unmute the music.

### Money
- **Damage carries over.** After a bout every surviving part keeps the damage it took and starts the next
  bout with that much less HP until you repair it. A full repair costs 15% of the part's value (tinker levels
  and prefixes included). Junk Bin parts are patched for free. A K.O.'d chassis is welded back to 25% HP.
- **Destroyed parts are gone for good** and must be replaced.
- **Entry fees** ($0–$40 in the Scrap Pit, $60–$150 in the Public Arena). If you can't pay, Marge covers it
  and your money goes negative ("Marge's tab"): you can't buy anything until a purse or a shift pays her back.
- A loss pays hazard pay that grows with the bout.

### Chapter 2: the Public Arena
- **Garage**: a second mech when Chapter 2 starts, a third bay after bout 3. Switch mechs with the tabs above
  "Your Garage". Parts bolted to any mech are in use.
- **Team Office**: hire pilots (signing bonus + a wage for every bout they fight). Each has a quirk that
  works like a passive (Sharpshooter, Iron Nerves, Mechanic, Focus Fire, Bully...). Gary and a humbled
  Baron Von Crusher join the pool later. Sign **sponsors**: pay per win plus a bonus for winning their way.
- **Lineup**: before a team bout, choose which mechs fight and who takes Point, Wing and Rear. Enemies
  usually go after the nearest mech.
- **Fame**: wins and stylish K.O.s raise it; it grows the gate share and merch income and brings bigger
  sponsors.
- The Scrap Pit stays open: Chapter 1 bouts are one-on-one with mech #1.

### Rules worth knowing
- Every part has its own HP. Parts at 0 HP break off visibly and stop working:
  - Losing a **leg** throws a biped off balance: slower, easier to hit, and it keeps falling over. A Gyro
    Stabilizer or Jump Jets compensate. Spider legs shrug off the first lost leg. Treads and hover never trip.
  - Losing the **head** wrecks accuracy and targeting. Losing an **arm or hardpoint** loses that weapon or
    utility. With no weapons left, a mech resorts to a desperate headbutt.
  - A **chassis** at 0 HP means K.O. In team bouts the rest of the team fights on.
- **Luck** raises crit chance, loot rarity, the odds of an extra salvage pick or crate, and the chance a
  killing blow leaves a part at 1 HP.
- **Heads decide targeting**: random, weapons-first, legs-first, weakest-part, or chassis-first.

## What's in the game

- **79 parts**, including 9 blueprint-only **Prototypes**, random loot prefixes, 7 tag synergies, tinkering.
- **Two chapters**: 6 Scrap Pit opponents across 5 themed arenas (the Baron has a second phase), and 6 team
  bouts in 3 televised arenas (the Metro Dome, Channel 6 Studio B, Apex Arena).
- **Themed random opponents**: every opponent rolls a loadout from a themed pool, scaled by tier (tinker
  levels and prefixes). Free-play rematches roll one tier tougher.
- **9 hireable pilots**, **10 sponsors**, **7 facilities** with 3 levels each.
- **Presentation**: crisp pixel art, layered lighting and depth of field, an announcer (Chip Chatterbox),
  story dialog, procedural sound effects and procedural music.
- **Replays**: every bout is saved as a tiny deterministic replay (seed + builds, about 1 KB; team bouts
  store every mech). Watch, export or import replays as JSON. The report also exports a text battle log.

## Project layout

```
index.html, styles.css      page shell + UI styling
server.js, Play.bat          zero-dependency local server / launcher
desktop/                     Electron wrapper used to build the Windows .exe (npm run dist)
src/core/util.js             RNG (seeded), colors, DOM helpers, storage
src/core/i18n.js             P.t() for UI strings, P.tc() for content, language switch
src/data/sprites*.js         ASCII pixel-art templates (paint-swappable palette letters)
src/data/parts*.js           parts, rarities, loot mods, synergies, paints, slots, Prototypes, ventures
src/data/campaign.js         Chapter 1: opponents, themed loadout pools, bouts, arenas, dialog, announcer
src/data/facilities.js       facilities and repair constants
src/data/chapter2.js         Chapter 2: teams, bouts, arenas, pilots, sponsors, story, roadmap
src/data/lang_vi*.js         Vietnamese UI strings and content
src/game/stats.js            build -> combat stats (shared by builder UI and sim)
src/game/loot.js             loot tables, shop, scavenging, salvage, repair cost, crafting recipes
src/game/opponents.js        themed random opponent loadouts
src/game/state.js            save/load, garage of mechs, chapters, money, facilities, pilots, sponsors, results
src/battle/sim.js            deterministic battle simulation (1v1 and teams) -> event log + frames
src/render/*.js              renderer core, sprite compiler, mech assembly/animation, VFX, environments
src/audio/*.js               WebAudio sound effects and procedural music
src/ui/ui.js                 dialogs, tooltips, toasts, modals, item cards
src/scenes/*.js              title + endings, hub (builder/shop/shift/ladder/replays), hub_stations
                             (workbench, facilities, team office, Junk-o-Matic, Pit Exchange), battle + report
tools/smoke.js               headless checks + scripted Chapter 1 and Chapter 2 campaigns (npm run check)
tools/balance.js             headless win-rate and economy tables (npm run balance)
tools/i18n_keys.js           lists every translatable UI string; `node tools/i18n_keys.js vi` shows gaps
```

### Extending it
- **New part**: add an entry to `PARTS` in `src/data/parts.js` (or `parts_ext.js`). Set `blueprint: true,
  noLoot: true` and add it to `BLUEPRINTS` to make it a craft-only Prototype. If it's visible, add an ASCII
  sprite. Weapons choose a `vfx` already handled in `render/fx.js` and `scenes/battle.js`.
- **New opponent**: add it to `ENEMIES` and give it a themed pool in `ENEMY_POOLS` (`'id@3'` = only from
  tier 3 up), then use it in a bout (1v1) or a team in `P.TEAMS`.
- **New chapter**: add a chapter object to `P.CHAPTERS` / `P.CHAPTER_ORDER`; `S.bouts(ch)` and the ladder
  are chapter-aware.
- **Text**: wrap UI strings in `P.t('English text', vars)` and add the Vietnamese entry to
  `src/data/lang_vi.js`; content (parts, story, announcer...) goes in `lang_vi_content.js` by id.
  `npm run check` fails if a translation is missing.
- **Balance**: run `npm run balance` (or `npm run balance ch2`) after changing numbers, and `npm run check`
  before committing.
- **Replays**: if you change sim rules, bump `Sim.VERSION` in `src/battle/sim.js`. 1v1 replays from v2 still
  re-simulate identically on v3 (`Sim.COMPAT`).

## Known limitations
- The art is procedural, template-based placeholder pixel art. The music is procedural and fairly simple.
- Replays re-simulate from seed + builds, so they're only exact on compatible sim versions. There's no
  online sharing; you share the exported JSON file.
- The battle camera is fixed and mechs are fairly small on very small windows.
- Chapters 3–6 (the Vexmoor invasion and beyond) are only teased in the Chapter 2 ending.
