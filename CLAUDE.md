# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Part-Time Pilot: a comedic auto-battling mech builder. It is a zero-dependency browser game in plain JavaScript (no bundler, no modules, no build step). Chapters One ("The Scrap Pit") and Two ("The Public Arena", team bouts) are playable; later chapters are teased in `P.ROADMAP`. See `README.md` for the player-facing feature list.

## Commands

```
npm run serve      # node server.js --no-open  -> http://localhost:8080 (npm start also opens a browser)
npm run check      # tools/smoke.js: data integrity, sim invariants, scripted full-campaign run
npm run balance    # tools/balance.js: headless win-rate tables
```

There is no linter and no test runner. `npm run check` is the only test; it is a single script with no per-test filter. The preview server is configured in `.claude/launch.json` as `part-time-pilot`.

## Architecture

**Globals, not modules.** Every file is an IIFE that attaches to `window.PTP` (`P`). Load order is defined by the `<script>` tags in `index.html`: core, data, rules (stats, loot, state, sim), presentation (render, audio, ui), then scenes, then `main.js`. A new file must be added to `index.html`, and, if it is headless-safe, to the hard-coded file lists in `tools/smoke.js` and `tools/balance.js` (they load files into a `vm` context, so they only load the data, rules and sim layers, never render, audio, ui or scenes, and `balance.js` also skips `state.js`). Code in those layers must not touch the DOM.

**Layering.**
- `src/data/*`: pure data (parts, mods, synergies, rarities, enemies, bouts, arenas, dialogue, announcer lines, Pit Exchange ventures, sprites as ASCII templates). `*_ext.js` files are expansion content that extends the base tables.
- `src/game/stats.js`: turns a build (slot -> `{id, lvl, mod}`) into combat stats. Shared by the builder UI and the sim, so changes affect both.
- `src/game/loot.js`: rarity weights, loot/shop/scavenge rolls, salvage, Junk-o-Matic fusion, price formulas.
- `src/game/state.js`: save/load (localStorage), inventory, equipment, money/scrap, ventures, and `S.applyResult` for battle outcomes. `S.bouts()` reads `P.CHAPTER1` directly, so a new chapter needs that hook repointed.
- `src/battle/sim.js`: deterministic simulation that produces an event log and frames. The renderer and the report only consume its output.
- `src/scenes/*`: `title`, `hub` (builder, shop, shifts, ladder, replays), `hub_stations` (workbench, Junk-o-Matic, Pit Exchange), `battle` (playback and report). `main.js` owns `Game.go(scene, params)` and the frame loop; scenes expose `enter/update/render/exit`.

**Determinism and replays.** Bouts are saved as seed + both builds (~1 KB) and re-simulated on playback. Anything that changes sim rules, RNG draw order, or stats math can break old replays, so bump `Sim.VERSION` in `src/battle/sim.js` (older replays then show a warning). Use the seeded RNG from `util.js` inside the sim, never `Math.random`.

**Adding content** (see README "Extending it" for the full recipe): parts go in `PARTS`; blueprint-only prototypes also need `blueprint: true, noLoot: true` and an entry in `BLUEPRINTS` (the smoke test enforces this); opponents go in `ENEMIES` plus a bout in the chapter list; weapons need a `vfx` already handled in `render/fx.js` and `scenes/battle.js`. The smoke test validates part rarity/category/sprite/tag references and that every enemy part fits its slot category (`P.slotCat`).

## Economy, Chapter 2 and i18n (added 2026-11-24)

- New files: `src/core/i18n.js` (`P.t(text, vars)` for UI strings, `P.tc(group, id, field, fallback)` for content), `src/data/facilities.js`, `src/data/chapter2.js` (teams, Ch2 ladder, pilots, sponsors, new endings, roadmap), `src/game/opponents.js` (themed rolled opponents from `P.ENEMY_POOLS`).
- Parts keep damage as `item.wear` (starts the next bout with less HP); `S.repairMany` pays to fix it. Builds only carry `wear` when > 0, so old replays re-simulate identically.
- Garage: `S.d.mechs[]`; the mech open in the builder is mirrored in `S.d.equip/paint/mechName` (`S.selectMech`, `S.syncCur`). Use `S.inUse(uid)` (any mech) for spare-part checks, `S.slotOf(uid)` only for the open mech.
- Chapters: `S.bouts(ch)`, `S.chapterId()`, `P.CHAPTERS`. Team bouts have `team` + `size`; `S.boutTeam`, `S.lineupFor`, `S.applyTeamBattle`.
- Sim v3: `Sim.run` accepts arrays of builds (team bouts). Unit ids A, A1, A2 / B, B1, B2. 1v1 stays bit-identical to v2 (`Sim.COMPAT`).
- `npm run balance ch2` prints only the Chapter 2 team table.
- Vietnamese: `src/data/lang_vi.js` (UI strings keyed by English text) and `lang_vi_content.js` (content by id). Every new player-facing string must go through `P.t()` (or `T()` in tables that are translated where drawn) and get a Vietnamese entry: `npm run check` fails otherwise (`node tools/i18n_keys.js vi` lists gaps). Pixelify Sans/Silkscreen lack Vietnamese glyphs, so `html[lang=vi]` and `P.canvasFont()` switch to VT323/Tiny5.
- Windows build: `desktop/` holds the Electron wrapper; see README.

## Notes

- Fonts load from Google Fonts; offline falls back to monospace.
- Run `npm run balance` after changing combat or part numbers, and `npm run check` before finishing any change.
