// Part-Time Pilot — persistent game state (save/load, inventory, equipment, campaign progress, replays).
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const SAVE_KEY = 'ptp_save_v1';
  const REPLAY_KEY = 'ptp_replays_v1';
  const SETTINGS_KEY = 'ptp_settings_v1';
  const MAX_REPLAYS = 12;

  const S = (P.State = { d: null });

  S.settings = Object.assign({ sfx: 0.55, music: 0.45, speed: 1, shake: true, sort: 'rarity', lang: 'en' }, U.storage.get(SETTINGS_KEY) || {});
  S.saveSettings = () => U.storage.set(SETTINGS_KEY, S.settings);
  if (P.I18N) P.I18N.set(S.settings.lang);

  S.hasSave = () => !!U.storage.get(SAVE_KEY);
  S.save = function () {
    if (!S.d) return;
    if (S.d.mechs) S.syncCur();
    U.storage.set(SAVE_KEY, S.d);
  };
  S.load = function () {
    const d = U.storage.get(SAVE_KEY);
    if (!d || d.version !== 1) return false;
    S.d = d;
    S.sanitize();
    return true;
  };
  S.deleteSave = () => U.storage.remove(SAVE_KEY);

  S.newGame = function () {
    S.d = {
      version: 1,
      day: 1,
      runSeed: U.newSeed(),
      money: 80,
      scrap: 4,
      luckBonus: 0,
      nextUid: 1,
      inventory: [],
      equip: {},
      paint: 'rust',
      mechName: 'Rustbucket',
      campaign: { beaten: {}, complete: false, endingSeen: false },
      shop: { day: 0, stock: [] },
      shiftDay: 0,
      stats: { battles: 0, wins: 0, losses: 0, dmgDealt: 0, dmgTaken: 0, partsLost: 0, partsDestroyed: 0, moneyEarned: 0, crits: 0, repairsPaid: 0, feesPaid: 0, facilitySpend: 0 },
      flags: { introSeen: false },
      blueprints: {},
      holdings: {},
      costBasis: {},
      market: null,
      facilities: {},
      chapter: 'ch1',
      pilots: [],
      sponsors: [],
      fame: 0,
      lineup: [0, 1, 2],
    };
    S.ensureMarket();
    const give = (id, slot) => {
      const it = S.addItem({ id, lvl: 0, mod: null }, true);
      it.isNew = false;
      if (slot) S.d.equip[slot] = it.uid;
      return it;
    };
    give('dumpster_frame', 'chassis');
    give('bucket_head', 'head');
    give('scrap_stompers', 'legs');
    give('hydraulic_claw', 'armR');
    give('rivet_gun', 'armL');
    give('duct_tape', 'module0');
    S.addItem({ id: 'bottle_rockets', lvl: 0, mod: null }, true);
    S.addItem({ id: 'plunger_launcher', lvl: 0, mod: null }, true);
    S.ensureGarage();
    S.save();
  };

  S.sanitize = function () {
    const d = S.d;
    d.inventory = d.inventory.filter((it) => P.PARTS[it.id]);
    // saves from before Chapter 2 had one mech: it becomes mech #1 of the garage
    S.ensureGarage();
    d.chapter = P.CHAPTERS[d.chapter] ? d.chapter : 'ch1';
    d.pilots = d.pilots || [];
    d.sponsors = d.sponsors || [];
    d.fame = d.fame || 0;
    d.lineup = d.lineup || [0, 1, 2];
    d.pilots = d.pilots.filter((id) => P.PILOTS_BY_ID[id]);
    d.sponsors = d.sponsors.filter((c) => P.SPONSORS_BY_ID[c.id]);
    d.mechs.forEach((m, i) => {
      if (i !== d.cur) {
        for (const k in m.equip) if (!S.item(m.equip[k])) delete m.equip[k];
      }
      if (m.pilot && m.pilot !== 'you' && !d.pilots.includes(m.pilot)) m.pilot = null;
    });
    for (const k in d.equip) if (!S.item(d.equip[k])) delete d.equip[k];
    if (!d.equip.chassis) {
      const ch = d.inventory.find((i) => P.PARTS[i.id].cat === 'chassis');
      if (ch) d.equip.chassis = ch.uid;
      else d.equip.chassis = S.addItem({ id: 'dumpster_frame', lvl: 0, mod: null }, true).uid;
    }
    S.trimSlots();
    // saves from before the expansion
    d.blueprints = d.blueprints || {};
    d.holdings = d.holdings || {};
    d.costBasis = d.costBasis || {};
    // saves from before facilities / rolled opponents / repairs
    d.facilities = d.facilities || {};
    if (!d.runSeed) d.runSeed = U.newSeed();
    for (const k of ['repairsPaid', 'feesPaid', 'facilitySpend']) d.stats[k] = d.stats[k] || 0;
    for (const it of d.inventory) if (it.wear != null && !(it.wear > 0.001)) delete it.wear;
    for (const b of P.BLUEPRINTS) if (b.grant && d.campaign.beaten[b.grant]) d.blueprints[b.id] = true;
    S.ensureMarket();
  };

  // ---------- facilities ----------
  S.facLevel = (id) => (S.d && S.d.facilities && S.d.facilities[id]) || 0;
  // Current value of a facility effect (each facility owns its own fx keys).
  S.fx = function (key) {
    if (!S.d) return 0;
    let v = 0;
    for (const f of P.FACILITIES) {
      const lvl = S.facLevel(f.id);
      if (!lvl) continue;
      const fx = f.levels[lvl - 1].fx;
      if (fx[key] == null) continue;
      if (typeof fx[key] === 'number') v = Math.max(v, fx[key]);
      else if (fx[key]) v = fx[key];
    }
    return v;
  };
  S.nextFacilityLevel = function (id) {
    const f = P.FACILITIES_BY_ID[id];
    const lvl = S.facLevel(id);
    return f && lvl < f.levels.length ? f.levels[lvl] : null;
  };
  S.facilityOpen = (f) => !f.chapter || S.chapterOpen(f.chapter);
  S.buyFacility = function (id) {
    const next = S.nextFacilityLevel(id);
    if (!next || S.d.money < next.cost || !S.facilityOpen(P.FACILITIES_BY_ID[id])) return false;
    S.d.money -= next.cost;
    S.d.stats.facilitySpend += next.cost;
    S.d.facilities[id] = S.facLevel(id) + 1;
    S.save();
    return true;
  };
  S.tinkerOpts = () => ({ maxLvl: S.fx('maxLvl') || P.Stats.MAX_LVL, disc: S.fx('tinkerDisc') });

  // ---------- repairs ----------
  // Parts keep the damage they took (item.wear, 0..1) and start the next bout with that much less HP.
  S.repairDisc = () => S.fx('repairDisc');
  S.repairCost = (it) => P.Loot.repairCost(it, S.repairDisc());
  S.damaged = function (equippedOnly) {
    return S.d.inventory.filter((it) => (it.wear || 0) > 0.001 && (!equippedOnly || S.inUse(it.uid)));
  };
  S.repairBill = (equippedOnly) => S.damaged(equippedOnly).reduce((a, it) => a + S.repairCost(it), 0);
  // repair order: equipped first; chassis, legs, head, arms, hardpoints
  const REPAIR_ORDER = ['chassis', 'legs', 'head', 'arm', 'mount', 'module'];
  S.repairSort = (list) => list.slice().sort((a, b) => (S.inUse(a.uid) ? 0 : 1) - (S.inUse(b.uid) ? 0 : 1) || REPAIR_ORDER.indexOf(P.PARTS[a.id].cat) - REPAIR_ORDER.indexOf(P.PARTS[b.id].cat));
  // Repairs the given items in order with the cash on hand; the last one may only be partly fixed.
  // Returns { spent, fixed, partial }.
  S.repairMany = function (items) {
    const out = { spent: 0, fixed: 0, partial: false };
    for (const it of S.repairSort(items)) {
      const cost = S.repairCost(it);
      if (cost <= 0) {
        if (it.free) delete it.wear;
        continue;
      }
      const cash = Math.floor(S.d.money);
      if (cash <= 0) break;
      if (cash >= cost) {
        S.d.money -= cost;
        out.spent += cost;
        out.fixed++;
        delete it.wear;
      } else {
        // patch up what the money covers
        const full = P.Loot.price(it) * P.REPAIR_RATE * (1 - S.repairDisc());
        const fix = Math.min(it.wear, cash / Math.max(1, full));
        it.wear = Math.max(0, Math.round((it.wear - fix) * 1000) / 1000);
        if (it.wear <= 0.001) delete it.wear;
        S.d.money -= cash;
        out.spent += cash;
        out.partial = true;
        break;
      }
    }
    S.d.stats.repairsPaid += out.spent;
    S.save();
    return out;
  };
  S.repairItem = (uid) => S.repairMany([S.item(uid)].filter(Boolean));

  // ---------- blueprints ----------
  S.knowsBlueprint = (id) => !!S.d.blueprints[id];
  S.learnBlueprint = function (id) {
    if (!id || S.d.blueprints[id]) return false;
    S.d.blueprints[id] = true;
    S.save();
    return true;
  };
  // a random undiscovered blueprint (null if you know them all)
  S.randomUnknownBlueprint = function () {
    const left = P.BLUEPRINTS.filter((b) => !S.d.blueprints[b.id]);
    return left.length ? U.rng.pick(left).id : null;
  };
  S.craftPrototype = function (id) {
    const bp = P.BLUEPRINTS.find((b) => b.id === id);
    if (!bp || !S.knowsBlueprint(id) || S.d.scrap < bp.scrap || S.d.money < bp.money) return null;
    S.d.scrap -= bp.scrap;
    S.d.money -= bp.money;
    const it = S.addItem({ id, lvl: 0, mod: null });
    S.save();
    return it;
  };

  // ---------- the Pit Exchange ----------
  S.ensureMarket = function () {
    const d = S.d;
    if (!d.market) d.market = { prices: {}, hist: {} };
    for (const v of P.VENTURES) {
      if (d.market.prices[v.id] == null) {
        d.market.prices[v.id] = 100;
        d.market.hist[v.id] = [100];
      }
    }
  };
  S.ventureUnlocked = (v) => !v.unlock || !!S.d.campaign.beaten[v.unlock];
  S.holdingValue = (id) => (S.d.holdings[id] || 0) * S.d.market.prices[id];
  S.portfolioValue = () => P.VENTURES.reduce((a, v) => a + S.holdingValue(v.id), 0);
  S.invest = function (id, amount) {
    amount = Math.min(Math.floor(amount), Math.floor(S.d.money));
    if (amount <= 0) return false;
    S.d.money -= amount;
    S.d.holdings[id] = (S.d.holdings[id] || 0) + amount / S.d.market.prices[id];
    S.d.costBasis[id] = (S.d.costBasis[id] || 0) + amount;
    S.save();
    return true;
  };
  S.cashOut = function (id) {
    const v = Math.floor(S.holdingValue(id));
    if (!S.d.holdings[id]) return 0;
    S.d.money += v;
    S.d.holdings[id] = 0;
    S.d.costBasis[id] = 0;
    S.save();
    return v;
  };
  // Prices move once per day. Returns news headlines for the hub.
  S.marketStep = function () {
    const d = S.d;
    S.ensureMarket();
    const rng = U.rng;
    const luck = P.Stats.compute(S.build()).luck;
    const news = [];
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
    for (const v of P.VENTURES) {
      const old = d.market.prices[v.id];
      const roll = rng();
      let mult, kind = null;
      if (roll < v.crash[0]) {
        mult = v.crash[1] * (0.85 + rng() * 0.3);
        kind = 'crash';
      } else if (roll < v.crash[0] + v.boom[0]) {
        mult = v.boom[1] * (0.85 + rng() * 0.3);
        kind = 'boom';
      } else mult = 1 + v.drift + v.vol * gauss() + luck * 0.0006;
      const price = Math.max(3, Math.round(old * Math.max(0.05, mult) * 100) / 100);
      d.market.prices[v.id] = price;
      const h = d.market.hist[v.id];
      h.push(price);
      while (h.length > 30) h.shift();
      const held = (d.holdings[v.id] || 0) > 0;
      const pct = Math.round((price / old - 1) * 100);
      if (kind && S.ventureUnlocked(v)) news.push({ text: `${v.name} ${kind === 'boom' ? P.tc('ventures', v.id, 'boomNews', v.boomNews) : P.tc('ventures', v.id, 'crashNews', v.crashNews)} (${pct > 0 ? '+' : ''}${pct}%)`, good: kind === 'boom', held });
      else if (held && Math.abs(pct) >= 12) news.push({ text: P.t(pct > 0 ? '{name} up {p}%' : '{name} down {p}%', { name: v.name, p: Math.abs(pct) }), good: pct > 0, held });
    }
    d.pendingNews = news;
    return news;
  };

  // ---------- garage ----------
  // S.d.mechs holds every mech. The one open in the builder (S.d.cur) is mirrored in S.d.equip /
  // S.d.paint / S.d.mechName, so the Chapter 1 builder code keeps working unchanged.
  S.ensureGarage = function () {
    const d = S.d;
    if (!d.mechs || !d.mechs.length) d.mechs = [{ name: d.mechName, paint: d.paint, equip: d.equip, pilot: 'you' }];
    d.cur = U.clamp(d.cur || 0, 0, d.mechs.length - 1);
    d.mechs[d.cur].equip = d.equip;
  };
  S.syncCur = function () {
    const m = S.d.mechs[S.d.cur];
    m.equip = S.d.equip;
    m.paint = S.d.paint;
    m.name = S.d.mechName;
  };
  S.mechRec = function (i) {
    if (i === S.d.cur) S.syncCur();
    return S.d.mechs[i];
  };
  S.selectMech = function (i) {
    if (i === S.d.cur || !S.d.mechs[i]) return;
    S.syncCur();
    const m = S.d.mechs[i];
    S.d.cur = i;
    S.d.equip = m.equip;
    S.d.paint = m.paint;
    S.d.mechName = m.name;
    S.save();
  };
  S.addMech = function (name, parts) {
    S.syncCur();
    const m = { name, paint: 'rust', equip: {}, pilot: null };
    for (const [slot, id] of parts || []) m.equip[slot] = S.addItem({ id, lvl: 0, mod: null, free: true }, true).uid;
    S.d.mechs.push(m);
    S.save();
    return S.d.mechs.length - 1;
  };
  // Which mech (and slot) a part is bolted onto, across the whole garage.
  S.inUse = function (uid) {
    const d = S.d;
    for (let i = 0; i < d.mechs.length; i++) {
      const eq = i === d.cur ? d.equip : d.mechs[i].equip;
      for (const k in eq) if (eq[k] === uid) return { mech: i, slot: k };
    }
    return null;
  };
  // Take a part off whichever other mech it is on (so it can be moved to the current one).
  S.freeFromOthers = function (uid) {
    const u = S.inUse(uid);
    if (!u || u.mech === S.d.cur) return;
    if (u.slot === 'chassis') return false;
    delete S.d.mechs[u.mech].equip[u.slot];
    return true;
  };
  S.mechSlots = function (i) {
    const eq = i === S.d.cur ? S.d.equip : S.d.mechs[i].equip;
    const ch = S.item(eq.chassis);
    return P.slotsFor(ch ? ch.id : null);
  };

  // ---------- inventory ----------
  S.item = (uid) => (S.d ? S.d.inventory.find((i) => i.uid === uid) || null : null);
  S.addItem = function (item, silent) {
    const inst = { uid: S.d.nextUid++, id: item.id, lvl: item.lvl || 0, mod: item.mod || null, isNew: !silent };
    if (item.free) inst.free = true;
    S.d.inventory.push(inst);
    return inst;
  };
  S.removeItem = function (uid) {
    for (const k in S.d.equip) if (S.d.equip[k] === uid) delete S.d.equip[k];
    for (const m of S.d.mechs || []) for (const k in m.equip) if (m.equip[k] === uid) delete m.equip[k];
    S.d.inventory = S.d.inventory.filter((i) => i.uid !== uid);
  };
  S.slotOf = function (uid) {
    for (const k in S.d.equip) if (S.d.equip[k] === uid) return k;
    return null;
  };
  S.slots = function () {
    const ch = S.item(S.d.equip.chassis);
    return P.slotsFor(ch ? ch.id : null);
  };
  S.trimSlots = function () {
    const valid = new Set(S.slots());
    for (const k in S.d.equip) if (!valid.has(k)) delete S.d.equip[k];
  };

  // Equip uid into slotKey; swaps with the item's previous slot when possible.
  S.equip = function (slotKey, uid) {
    const it = S.item(uid);
    if (!it) return false;
    const def = P.PARTS[it.id];
    if (P.slotCat(slotKey) !== def.cat) return false;
    if (S.d.mechs && S.freeFromOthers(uid) === false) return false;
    const from = S.slotOf(uid);
    const occupant = S.d.equip[slotKey];
    if (from === slotKey) return true;
    if (from) {
      if (occupant) S.d.equip[from] = occupant;
      else delete S.d.equip[from];
    }
    S.d.equip[slotKey] = uid;
    if (slotKey === 'chassis') S.trimSlots();
    S.save();
    return true;
  };
  S.unequip = function (slotKey) {
    if (slotKey === 'chassis') return false;
    delete S.d.equip[slotKey];
    S.save();
    return true;
  };

  S.unlockedPaints = function () {
    return P.PAINTS.filter((p) => !p.enemyOnly && (!p.unlock || S.d.campaign.beaten[p.unlock])).map((p) => p.id);
  };

  // Build object for stats/sim/renderer. overrides: {slotKey: uid|null} for previews.
  S.build = function (overrides, mi) {
    const i = mi == null || !S.d.mechs ? (S.d.cur || 0) : mi;
    const rec = S.d.mechs ? S.mechRec(i) : { name: S.d.mechName, paint: S.d.paint, equip: S.d.equip, pilot: 'you' };
    const eq = Object.assign({}, i === (S.d.cur || 0) ? S.d.equip : rec.equip, overrides || {});
    if (overrides && overrides.chassis) {
      const ch = S.item(overrides.chassis);
      const valid = new Set(P.slotsFor(ch.id));
      for (const k in eq) if (!valid.has(k)) delete eq[k];
    }
    const parts = {};
    for (const k in eq) {
      if (!eq[k]) continue;
      const it = S.item(eq[k]);
      if (it) {
        parts[k] = { id: it.id, lvl: it.lvl, mod: it.mod };
        if (it.wear > 0.001) parts[k].wear = it.wear;
      }
    }
    const b = { name: rec.name, pilot: 'You', paint: rec.paint, bonusLuck: S.d.luckBonus, parts };
    const pil = rec.pilot && rec.pilot !== 'you' ? P.PILOTS_BY_ID[rec.pilot] : null;
    if (pil) {
      b.pilot = pil.name;
      b.pilotFx = U.deepCopy(pil.fx);
      if (pil.unitTarget) b.unitTarget = pil.unitTarget;
    }
    if (S.fx('pilotAcc')) b.bonusAcc = S.fx('pilotAcc');
    if (S.fx('pilotEva')) b.bonusEva = S.fx('pilotEva');
    if (S.fx('pitStop')) b.pitStop = S.fx('pitStop');
    return b;
  };
  S.stats = (overrides, mi) => P.Stats.compute(S.build(overrides, mi));
  S.luck = () => S.stats().luck;

  // ---------- campaign ----------
  // Chapters: S.d.chapter is the one the ladder opens on; earlier chapters stay open for rematches.
  S.chapterId = () => (S.d && S.d.chapter) || 'ch1';
  S.chapter = (ch) => P.CHAPTERS[ch || S.chapterId()];
  S.chapterOpen = (ch) => ch === 'ch1' || (ch === 'ch2' && !!S.d.ch2);
  S.bouts = (ch) => S.chapter(ch).bouts;
  S.allBouts = () => P.CHAPTER_ORDER.flatMap((c) => P.CHAPTERS[c].bouts);
  S.boutById = (id) => S.allBouts().find((b) => b.id === id) || null;
  S.chapterOf = (bout) => P.CHAPTER_ORDER.find((c) => P.CHAPTERS[c].bouts.includes(bout)) || 'ch1';
  S.beatenCount = (ch) => S.bouts(ch).filter((b) => S.d.campaign.beaten[b.id]).length;
  S.nextBout = (ch) => S.bouts(ch).find((b) => !S.d.campaign.beaten[b.id]) || null;
  S.boutStatus = function (id) {
    if (S.d.campaign.beaten[id]) return 'beaten';
    const b = S.boutById(id);
    const nb = S.nextBout(b ? S.chapterOf(b) : null);
    return nb && nb.id === id ? 'next' : 'locked';
  };
  S.tier = function () {
    if (S.chapterId() === 'ch2') return S.beatenCount('ch2') >= 3 ? 4 : 3;
    const n = S.beatenCount('ch1');
    return n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
  };
  // Who you are fighting: { name, sub, quote, lose, phase2 } for a 1v1 opponent or a team
  S.boutFoe = function (bout) {
    if (bout.team) {
      const t = P.TEAMS[bout.team];
      return { name: P.tc('teams', bout.team, 'name', t.name), sub: t.units.slice(0, bout.size).map((u) => P.ENEMIES[u.enemy].pilot).join(' · '), quote: P.tc('teams', bout.team, 'quote', t.quote), lose: P.tc('teams', bout.team, 'lose', t.lose) };
    }
    const e = P.ENEMIES[bout.enemy];
    return { name: e.pilot, sub: P.tc('enemies', bout.enemy, 'title', e.title), quote: P.tc('enemies', bout.enemy, 'quote', e.quote), lose: P.tc('enemies', bout.enemy, 'lose', e.lose), phase2: P.tc('enemies', bout.enemy, 'phase2', e.phase2) };
  };
  S.enemyBuild = (enemyId) => P.Opponents.fixed(enemyId);
  // The opponent's rolled loadout for a bout: fixed for the run until you beat them; rematches re-roll daily.
  S.boutBuild = function (bout, rematch) {
    const key = bout.id + (rematch ? ':day' + S.d.day : '');
    return P.Opponents.roll(bout.enemy, S.boutTier(bout, rematch), P.Opponents.seedFor(S.d.runSeed, key));
  };
  // free-play rematches (after the title bout) roll one tier tougher
  S.boutTier = (bout, rematch) => Math.min(6, bout.tier + (rematch && (bout.team ? S.d.campaign.complete2 : S.d.campaign.complete) ? 1 : 0));
  // A team bout's rolled opposing team: one build per unit (point first)
  S.boutTeam = function (bout, rematch) {
    const t = P.TEAMS[bout.team];
    const tier = S.boutTier(bout, rematch);
    return t.units.slice(0, bout.size).map((u, i) => {
      const key = bout.id + ':' + i + (rematch ? ':day' + S.d.day : '');
      const b = P.Opponents.roll(u.enemy, tier, P.Opponents.seedFor(S.d.runSeed, key), { lvlBonus: u.lvl || 0, modDelta: u.mod || 0 });
      if (u.unitTarget) b.unitTarget = u.unitTarget;
      if (i > 0) b.boss = false;
      return b;
    });
  };

  // ---------- Chapter 2: the Public Arena ----------
  S.startChapter2 = function () {
    const d = S.d;
    if (d.ch2) {
      d.chapter = 'ch2';
      S.save();
      return false;
    }
    d.ch2 = true;
    d.chapter = 'ch2';
    d.fame = Math.max(d.fame || 0, 10);
    // Marge welds a second mech out of whatever is lying around
    if (d.mechs.length < 2) S.addMech('Rustbucket II', [['chassis', 'dumpster_frame'], ['head', 'bucket_head'], ['legs', 'scrap_stompers'], ['armR', 'rivet_gun'], ['armL', 'plunger_launcher']]);
    d.lineup = [0, 1, 2];
    S.save();
    return true;
  };
  S.mechBays = () => (S.d.ch2 ? (S.d.campaign.beaten.p3 ? 3 : 2) : 1);
  S.pilotUnlocked = (pl) => !pl.unlock || !!S.d.campaign.beaten[pl.unlock];
  S.hirePilot = function (id) {
    const pl = P.PILOTS_BY_ID[id];
    if (!pl || S.d.pilots.includes(id) || !S.pilotUnlocked(pl) || S.d.money < pl.fee) return false;
    S.d.money -= pl.fee;
    S.d.pilots.push(id);
    S.d.stats.pilotSpend = (S.d.stats.pilotSpend || 0) + pl.fee;
    // fill the first mech that has nobody in the cockpit
    const empty = S.d.mechs.findIndex((m) => !m.pilot);
    if (empty >= 0) S.d.mechs[empty].pilot = id;
    S.save();
    return true;
  };
  S.firePilot = function (id) {
    S.d.pilots = S.d.pilots.filter((p) => p !== id);
    for (const m of S.d.mechs) if (m.pilot === id) m.pilot = null;
    S.save();
  };
  S.assignPilot = function (mi, id) {
    if (mi === 0) return false; // you always fly your own mech
    for (const m of S.d.mechs) if (id && m.pilot === id) m.pilot = null;
    S.d.mechs[mi].pilot = id || null;
    S.save();
    return true;
  };
  S.pilotName = (mi) => {
    const m = S.d.mechs[mi];
    if (!m || !m.pilot) return null;
    return m.pilot === 'you' ? P.t('You') : P.PILOTS_BY_ID[m.pilot].name;
  };
  S.mechReady = (mi) => {
    const m = S.mechRec(mi);
    return !!(m && m.pilot && m.equip.chassis && S.item(m.equip.chassis));
  };
  // The mechs that will fight a team bout, in position order (point, wing, rear)
  S.lineupFor = function (bout) {
    const seen = new Set();
    const out = [];
    for (const mi of S.d.lineup.concat(S.d.mechs.map((_, i) => i))) {
      if (out.length >= bout.size) break;
      if (seen.has(mi) || mi >= S.d.mechs.length || !S.mechReady(mi)) continue;
      seen.add(mi);
      out.push(mi);
    }
    return out;
  };
  S.setLineup = function (list) {
    S.d.lineup = list.slice();
    S.save();
  };
  S.wages = (lineup) => lineup.reduce((a, mi) => {
    const pl = P.PILOTS_BY_ID[S.d.mechs[mi].pilot];
    return a + (pl ? pl.wage : 0);
  }, 0);

  // sponsors
  S.sponsorSlots = () => 1 + S.facLevel('sponsors');
  S.sponsorOffers = function () {
    const rng = U.makeRng(U.hashStr(S.d.runSeed + ':sponsors:' + S.d.day));
    const active = new Set(S.d.sponsors.map((c) => c.id));
    const pool = P.SPONSORS.filter((s) => !active.has(s.id) && S.d.fame >= s.fame);
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  };
  S.signSponsor = function (id) {
    if (S.d.sponsors.length >= S.sponsorSlots() || S.d.sponsors.some((c) => c.id === id)) return false;
    S.d.sponsors.push({ id, left: P.SPONSORS_BY_ID[id].bouts });
    S.save();
    return true;
  };
  S.dropSponsor = function (id) {
    S.d.sponsors = S.d.sponsors.filter((c) => c.id !== id);
    S.save();
  };
  S.sponsorCondText = function (sp) {
    const c = P.SPONSOR_CONDS[sp.bonus.cond];
    return P.t(c.text, { n: sp.bonus.n });
  };
  // Did a bout meet a sponsor's bonus condition? ctx from S.boutContext
  S.sponsorMet = function (sp, ctx) {
    const b = sp.bonus, n = b.n || 0;
    if (!ctx.won) return false;
    switch (b.cond) {
      case 'win': return true;
      case 'ko': return ctx.ko;
      case 'fast': return ctx.duration < n;
      case 'noLoss': return ctx.lost === 0;
      case 'allStand': return ctx.allStand;
      case 'crits': return ctx.crits >= n;
      case 'parts': return ctx.parts >= n;
      case 'fire': return (ctx.dmg.fire || 0) + (ctx.dmg.burn || 0) >= n;
      case 'energy': return (ctx.dmg.energy || 0) >= n;
      case 'melee': return (ctx.dmg.melee || 0) >= n;
      default: return false;
    }
  };
  S.boutContext = function (sim, ids, lostCount) {
    const dmg = {};
    let crits = 0, parts = 0;
    for (const id of ids) {
      const st = sim.stats[id];
      crits += st.crits;
      parts += st.partsDestroyed;
      for (const w of Object.values(st.weapons)) dmg[w.type] = (dmg[w.type] || 0) + w.dmg;
    }
    const allStand = ids.every((id) => !sim.final[id].chassis || !sim.final[id].chassis.destroyed);
    return { won: sim.winner === 'A', ko: sim.reason === 'ko', duration: sim.duration, lost: lostCount, allStand, crits, parts, dmg };
  };
  // gate money from the crowd (Chapter 2): grows with fame
  S.fameMult = () => 1 + (S.d.fame || 0) / 50;
  S.gate = (bout, won) => (bout.team ? Math.round(bout.reward * 0.3 * ((S.d.fame || 0) / 50) * (won ? 1 : 0.5)) : 0);
  S.entryFee = (bout) => bout.fee || 0;
  // Marge's consolation money after a loss grows with the bout
  S.hazardPay = (bout) => 20 + 10 * (bout.tier || 0);

  S.ensureShop = function () {
    if (S.d.shop.day !== S.d.day || !S.d.shop.stock.length) {
      S.d.shop = { day: S.d.day, stock: P.Loot.shopStock(S.tier()).map((it) => Object.assign(it, { sold: false })) };
      S.save();
    }
    return S.d.shop.stock;
  };
  S.canShift = () => S.d.shiftDay !== S.d.day;
  // Sort one scavenging pile (once per day). Returns { res, got: [items], bp: blueprintId|null }.
  S.workShift = function (pile) {
    const res = P.Loot.scavenge(pile, S.luck(), S.tier());
    S.d.shiftDay = S.d.day;
    S.d.money += res.wage;
    S.d.stats.moneyEarned += res.wage;
    S.d.luckBonus += res.luckBonus;
    const got = res.items.map((it) => S.addItem(it));
    let bp = null;
    if (U.rng() < (res.blueprintChance || 0)) {
      bp = S.randomUnknownBlueprint();
      if (bp) S.learnBlueprint(bp);
    }
    S.save();
    return { res, got, bp };
  };

  // ---------- battle results ----------
  // Destroyed parts are removed for good; survivors keep their damage (wear). Returns lost count.
  function settleDamage(final, snap, res, mechLabel) {
    let lost = 0;
    for (const key in final) {
      const f = final[key];
      if (!f.destroyed || key === 'chassis') continue;
      const it = S.item(snap[key]);
      if (it) {
        res.lost.push({ name: P.itemName(it), id: it.id, slot: key, mech: mechLabel });
        S.removeItem(it.uid);
        lost++;
      }
    }
    const koWeld = S.fx('koWeld') || P.KO_WELD;
    const nightly = S.fx('nightly');
    for (const key in final) {
      const f = final[key];
      const it = S.item(snap[key]);
      if (!it) continue;
      let wear = f.destroyed ? (key === 'chassis' ? 1 - koWeld : 0) : 1 - f.hp / Math.max(1, f.max);
      wear = U.clamp(wear * (1 - nightly), 0, 1);
      if (wear > 0.001) {
        it.wear = Math.round(wear * 1000) / 1000;
        res.worn.push({ uid: it.uid, name: P.itemName(it), slot: key, wear: it.wear, mech: mechLabel });
      } else delete it.wear;
    }
    return lost;
  }
  function firstClear(bout, res) {
    const d = S.d;
    if (d.campaign.beaten[bout.id]) return;
    res.firstClear = true;
    d.campaign.beaten[bout.id] = true;
    const paint = P.PAINTS.find((p) => p.unlock === bout.id);
    if (paint) res.unlockPaint = paint;
    const bp = P.BLUEPRINTS.find((b) => b.grant === bout.id);
    if (bp && !d.blueprints[bp.id]) {
      d.blueprints[bp.id] = true;
      res.blueprint = bp.id;
    }
    const ven = P.VENTURES.find((v) => v.unlock === bout.id);
    if (ven) res.ventureUnlock = ven.name;
    const pil = P.PILOTS.filter((pl) => pl.unlock === bout.id);
    if (pil.length) res.pilotUnlock = pil.map((pl) => pl.name);
    if (bout.id === 'p3' && d.mechs.length < 3) {
      S.addMech('Rustbucket III', [['chassis', 'dumpster_frame'], ['head', 'bucket_head'], ['legs', 'scrap_stompers'], ['armR', 'hydraulic_claw'], ['armL', 'rivet_gun']]);
      res.newBay = true;
    }
    if (bout.boss && !bout.team) d.campaign.complete = true;
    if (bout.boss && bout.team) d.campaign.complete2 = true;
  }
  function tally(sim, ids, res) {
    const d = S.d;
    d.stats.battles++;
    for (const id of ids) {
      d.stats.dmgDealt += sim.stats[id].dmgDealt;
      d.stats.dmgTaken += sim.stats[id].dmgTaken;
      d.stats.partsDestroyed += sim.stats[id].partsDestroyed;
      d.stats.crits += sim.stats[id].crits;
    }
    d.stats.partsLost += res.lost.length;
    d.day++;
    S.marketStep();
    S.save();
  }

  // Team bout result. lineup: mech indexes in position order; snaps: their equip snapshots;
  // enemyBuilds: the rolled opposing team (for salvage).
  S.applyTeamBattle = function (bout, sim, lineup, snaps, isRematch, enemyBuilds) {
    const d = S.d;
    const won = sim.winner === 'A';
    const res = { team: true, won, money: 0, purse: 0, bonus: 0, merch: 0, gate: 0, sponsors: [], wages: 0, fee: 0, fame: 0, lost: [], worn: [], salvage: [], salvagePicks: 1, crates: 0, unlockPaint: null, firstClear: false, blueprint: null, ventureUnlock: null };
    const myIds = P.Sim.unitsOf(sim, 'A');
    const foeIds = P.Sim.unitsOf(sim, 'B');
    let lost = 0;
    lineup.forEach((mi, pos) => {
      lost += settleDamage(sim.final[myIds[pos]], snaps[pos], res, S.mechRec(mi).name);
    });
    const ctx = S.boutContext(sim, myIds, lost);
    const luck = P.Stats.compute(S.build(null, 0)).luck;
    res.fee = S.entryFee(bout);
    res.wages = S.wages(lineup);
    if (won) {
      res.purse = isRematch ? Math.round(bout.reward * 0.5) : bout.reward;
      res.bonus = Math.round(res.purse * S.fx('purse'));
      res.crates = 1 + (U.rng() < luck / 100 ? 1 : 0) + (bout.size >= 3 ? 1 : 0);
      // salvage from every wrecked enemy mech, pooled
      const pool = [];
      foeIds.forEach((id, j) => {
        if (enemyBuilds[j]) pool.push(...P.Loot.salvageOptions(enemyBuilds[j], sim.final[id], luck, !!bout.boss && j === 0, null, 5));
      });
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(U.rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      res.salvage = pool.slice(0, 3 + (U.rng() < luck / 100 ? 1 : 0) + S.fx('salvageExtra'));
      res.salvagePicks = Math.min(res.salvage.length, S.fx('salvagePicks') || 1);
      if (!res.salvage.length) {
        res.scrapSweep = 10 + bout.tier * 4;
        d.scrap += res.scrapSweep;
      }
      firstClear(bout, res);
      d.stats.wins++;
    } else {
      res.purse = S.hazardPay(bout);
      d.stats.losses++;
    }
    // the crowd and the merch stand (both grow with fame), and the sponsors
    res.gate = S.gate(bout, won);
    const merch = S.fx('merch');
    res.merch = merch ? Math.round(merch * (won ? 1.5 : 1) * S.fameMult()) : 0;
    for (const c of d.sponsors) {
      const sp = P.SPONSORS_BY_ID[c.id];
      const pay = won ? sp.pay : 0;
      const bonus = S.sponsorMet(sp, ctx) ? sp.bonus.pay : 0;
      res.sponsors.push({ id: sp.id, name: sp.name, pay, bonus, met: !!bonus });
      c.left--;
    }
    const ended = d.sponsors.filter((c) => c.left <= 0).map((c) => P.SPONSORS_BY_ID[c.id].name);
    if (ended.length) res.sponsorsEnded = ended;
    d.sponsors = d.sponsors.filter((c) => c.left > 0);
    const sponsorTotal = res.sponsors.reduce((a, s) => a + s.pay + s.bonus, 0);
    // fame: wins and style raise it, losses dent it
    const fame0 = d.fame;
    if (won) d.fame += 6 + (ctx.ko ? 3 : 0) + (ctx.duration < 40 ? 2 : 0) + Math.floor(ctx.parts / 4) + (bout.boss ? 5 : 0);
    else d.fame -= 3;
    d.fame = U.clamp(d.fame, 0, 100);
    res.fame = d.fame - fame0;
    res.money = res.purse + res.bonus + res.gate + res.merch + sponsorTotal;
    d.money += res.money - res.fee - res.wages;
    d.stats.moneyEarned += res.money;
    d.stats.feesPaid += res.fee;
    d.stats.wagesPaid = (d.stats.wagesPaid || 0) + res.wages;
    res.repairBill = S.repairBill(true);
    tally(sim, myIds, res);
    return res;
  };
  // equipSnap: {slotKey: uid} captured when the battle started.
  // enemyBuild: the (rolled) build the opponent actually used, for salvage.
  S.applyBattle = function (bout, sim, equipSnap, isRematch, enemyBuild) {
    const d = S.d;
    const won = sim.winner === 'A';
    const res = { won, money: 0, purse: 0, bonus: 0, merch: 0, fee: 0, lost: [], worn: [], salvage: [], salvagePicks: 1, crates: 0, unlockPaint: null, firstClear: false, blueprint: null, ventureUnlock: null };
    // Destroyed parts are gone for good (chassis just gets welded back together)
    for (const key in sim.final.A) {
      const f = sim.final.A[key];
      if (!f.destroyed || key === 'chassis') continue;
      const uid = equipSnap[key];
      const it = S.item(uid);
      if (it) {
        res.lost.push({ name: P.itemName(it), id: it.id, slot: key });
        S.removeItem(uid);
      }
    }
    // Survivors keep their damage. A K.O.'d chassis is welded back together, but only partly.
    const koWeld = S.fx('koWeld') || P.KO_WELD;
    const nightly = S.fx('nightly');
    for (const key in sim.final.A) {
      const f = sim.final.A[key];
      const it = S.item(equipSnap[key]);
      if (!it) continue;
      let wear = f.destroyed ? (key === 'chassis' ? 1 - koWeld : 0) : 1 - f.hp / Math.max(1, f.max);
      wear = U.clamp(wear * (1 - nightly), 0, 1);
      if (wear > 0.001) {
        it.wear = Math.round(wear * 1000) / 1000;
        res.worn.push({ uid: it.uid, name: P.itemName(it), slot: key, wear: it.wear });
      } else delete it.wear;
    }
    const luck = P.Stats.compute(S.build()).luck;
    res.fee = S.entryFee(bout);
    if (won) {
      res.purse = isRematch ? Math.round(bout.reward * 0.5) : bout.reward;
      res.bonus = Math.round(res.purse * S.fx('purse'));
      res.crates = 1 + (U.rng() < luck / 100 ? 1 : 0);
      enemyBuild = enemyBuild || S.boutBuild(bout, isRematch);
      res.salvage = P.Loot.salvageOptions(enemyBuild, sim.final.B, luck, !!bout.boss, null, S.fx('salvageExtra'));
      res.salvagePicks = Math.min(res.salvage.length, S.fx('salvagePicks') || 1);
      if (!res.salvage.length) {
        // everything got blown off: sweep the debris up as scrap instead
        res.scrapSweep = 5 + bout.tier * 3;
        d.scrap += res.scrapSweep;
      }
      if (!d.campaign.beaten[bout.id]) {
        res.firstClear = true;
        d.campaign.beaten[bout.id] = true;
        const paint = P.PAINTS.find((p) => p.unlock === bout.id);
        if (paint) res.unlockPaint = paint;
        const bp = P.BLUEPRINTS.find((b) => b.grant === bout.id);
        if (bp && !d.blueprints[bp.id]) {
          d.blueprints[bp.id] = true;
          res.blueprint = bp.id;
        }
        const ven = P.VENTURES.find((v) => v.unlock === bout.id);
        if (ven) res.ventureUnlock = ven.name;
        if (bout.boss) d.campaign.complete = true;
      }
      d.stats.wins++;
    } else {
      res.purse = S.hazardPay(bout);
      d.stats.losses++;
    }
    const merch = S.fx('merch');
    res.merch = merch ? Math.round(merch * (won ? 1.5 : 1)) : 0;
    res.money = res.purse + res.bonus + res.merch;
    d.money += res.money - res.fee;
    d.stats.moneyEarned += res.money;
    d.stats.feesPaid += res.fee;
    res.repairBill = S.repairBill(true);
    d.stats.battles++;
    d.stats.dmgDealt += sim.stats.A.dmgDealt;
    d.stats.dmgTaken += sim.stats.A.dmgTaken;
    d.stats.partsLost += res.lost.length;
    d.stats.partsDestroyed += sim.stats.A.partsDestroyed;
    d.stats.crits += sim.stats.A.crits;
    d.day++;
    S.marketStep();
    S.save();
    return res;
  };

  // ---------- replays ----------
  S.replays = () => U.storage.get(REPLAY_KEY) || [];
  S.addReplay = function (rep) {
    const list = S.replays();
    list.unshift(rep);
    while (list.length > MAX_REPLAYS) list.pop();
    if (!U.storage.set(REPLAY_KEY, list)) {
      list.length = Math.max(1, Math.floor(list.length / 2));
      U.storage.set(REPLAY_KEY, list);
    }
  };
  S.deleteReplay = function (id) {
    U.storage.set(REPLAY_KEY, S.replays().filter((r) => r.id !== id));
  };

  // Replay file = everything needed to re-simulate the bout deterministically.
  S.makeReplay = function (bout, seed, A, B, sim, arena) {
    return {
      format: 'part-time-pilot-replay',
      version: 1,
      simVersion: P.Sim.VERSION,
      id: 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      date: new Date().toISOString(),
      boutId: bout ? bout.id : null,
      title: bout ? bout.title : 'Exhibition',
      arena: arena || 'pit',
      seed,
      A,
      B,
      result: { winner: sim.winner, reason: sim.reason, duration: sim.duration, dmgA: (sim.teamStats || sim.stats).A.dmgDealt, dmgB: (sim.teamStats || sim.stats).B.dmgDealt },
    };
  };
  S.validateReplay = function (rep) {
    if (!rep || rep.format !== 'part-time-pilot-replay') return P.t('Not a Part-Time Pilot replay file.');
    const list = (x) => (Array.isArray(x) ? x : [x]);
    if (typeof rep.seed !== 'number' || !rep.A || !rep.B || !list(rep.A).every((b) => b && b.parts) || !list(rep.B).every((b) => b && b.parts)) return P.t('Replay is missing data.');
    for (const b of list(rep.A).concat(list(rep.B))) {
      for (const k in b.parts) {
        const it = b.parts[k];
        if (it && !P.PARTS[it.id]) return P.t('Replay uses an unknown part: {id}', { id: it.id });
      }
      if (!b.parts.chassis) return P.t('Replay mech has no chassis.');
    }
    if (rep.arena && !P.ARENAS[rep.arena]) rep.arena = 'pit';
    return null;
  };
  S.replaySideName = (x) => (Array.isArray(x) ? x.map((b) => b.name).join(' + ') : x.name);
  // Human-readable event log (export alongside / instead of a replay)
  S.eventLogText = function (rep, sim) {
    // unit names: A, A1, A2 / B, B1, B2 (team replays store arrays of builds)
    const nm = {};
    for (const side of ['A', 'B']) (Array.isArray(rep[side]) ? rep[side] : [rep[side]]).forEach((b, i) => (nm[i ? side + i : side] = b.name || (side === 'A' ? 'Player' : 'Enemy')));
    const teamNm = { A: S.replaySideName(rep.A), B: S.replaySideName(rep.B) };
    const pn = (side, key) => (sim.partNames[side] && sim.partNames[side][key]) || key;
    const lines = [`PART-TIME PILOT — battle log`, `${rep.title} · seed ${rep.seed} · ${rep.date}`, `${teamNm.A} vs ${teamNm.B}`, ''];
    for (const e of sim.events) {
      const ts = e.t.toFixed(2).padStart(6) + 's  ';
      const other = (s) => (s === 'A' ? 'B' : 'A');
      switch (e.type) {
        case 'hit':
          lines.push(ts + `${nm[e.src]} hits ${nm[e.dst]}'s ${pn(e.dst, e.part)} for ${e.dmg} ${e.dtype}${e.crit ? ' (CRIT)' : ''} → ${e.hp} HP left`);
          break;
        case 'miss':
          lines.push(ts + `${nm[e.src]} misses (${e.reason})`);
          break;
        case 'destroy':
          lines.push(ts + `*** ${nm[e.dst]}'s ${pn(e.dst, e.part)} DESTROYED (${e.how})`);
          break;
        case 'limb':
          lines.push(ts + `${nm[e.dst]} loses a leg (${e.n})`);
          break;
        case 'stumble':
          lines.push(ts + `${nm[e.dst]} falls over`);
          break;
        case 'burn':
          lines.push(ts + `${nm[e.dst]}'s ${pn(e.dst, e.part)} catches fire`);
          break;
        case 'heal':
          lines.push(ts + `${nm[e.dst]} repairs ${pn(e.dst, e.part)} +${e.amt} (${e.why})`);
          break;
        case 'absorb':
          lines.push(ts + `${nm[e.dst]}'s shield absorbs ${e.amt}`);
          break;
        case 'block':
          lines.push(ts + `${nm[e.dst]} blocks with ${pn(e.dst, e.part)}`);
          break;
        case 'phase':
          lines.push(ts + `${nm[e.dst]} enters PHASE 2`);
          break;
        case 'disarm':
          lines.push(ts + `${nm[e.dst]} is disarmed`);
          break;
        case 'end':
          lines.push(ts + `END — ${teamNm[e.winner]} wins by ${e.reason === 'ko' ? 'K.O.' : "judges' decision"}`);
          break;
        default:
          break;
      }
      void other;
    }
    const ts = sim.teamStats || sim.stats;
    lines.push('', `Damage dealt: ${teamNm.A} ${ts.A.dmgDealt} / ${teamNm.B} ${ts.B.dmgDealt}`);
    return lines.join('\n');
  };
})();
