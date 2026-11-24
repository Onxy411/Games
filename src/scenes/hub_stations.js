// Part-Time Pilot — hub stations: Workbench (tinker / salvage / prototype blueprints),
// the Junk-o-Matic 3000 (3 parts in, 1 random part out) and the Pit Exchange (investing).
// These extend the Hub scene object defined in hub.js.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const h = U.h;
  const UI = P.UI;
  const S = P.State;
  const Hub = P.Scenes.hub;
  const MECH_X = 157, MECH_Y = 108;
  const rarIdx = (it) => P.RARITY_ORDER.indexOf(P.PARTS[it.id].rarity);

  // =====================================================================================
  // WORKBENCH
  // =====================================================================================
  Hub.openWorkbench = function (startTab) {
    const m = UI.modal(P.t('Workbench'), { cls: 'wide' });
    let tab = startTab || (S.repairBill(true) > 0 ? 'repair' : 'tinker');
    const head = h('div', { class: 'modal-sub' });
    const tabs = h('div', { class: 'tabs' });
    const tools = h('div', { class: 'tool-row' });
    const list = h('div', { class: 'item-grid' });
    m.body.append(head, tabs, tools, list);
    const known = () => P.BLUEPRINTS.filter((b) => S.knowsBlueprint(b.id)).length;

    const salvageMany = async (items, label) => {
      if (!items.length) return;
      const total = items.reduce((a, it) => a + P.Loot.salvageValue(it), 0);
      if (!(await UI.confirm(P.t('Salvage {n} part(s) ({label}) for ⚙ {total} scrap?', { n: items.length, label, total }), P.t('Salvage them')))) return;
      for (const it of items) S.removeItem(it.uid);
      S.d.scrap += total;
      S.save();
      P.SFX.play('break');
      UI.toast(P.t('Salvaged {n} parts → +⚙{total}', { n: items.length, total }), 'good');
      draw();
      this.refresh();
    };
    // spare copies: keep the best copy of each part (equipped ones count as kept)
    const duplicates = () => {
      const groups = {};
      for (const it of S.d.inventory) (groups[it.id] = groups[it.id] || []).push(it);
      const dupes = [];
      for (const id in groups) {
        const g = groups[id];
        if (g.length < 2) continue;
        const equipped = g.filter((it) => S.inUse(it.uid));
        const spare = g.filter((it) => !S.inUse(it.uid)).sort((a, b) => (b.lvl || 0) - (a.lvl || 0) || (b.mod ? 1 : 0) - (a.mod ? 1 : 0));
        dupes.push(...(equipped.length ? spare : spare.slice(1)));
      }
      return dupes.filter((it) => !it.free);
    };

    const draw = () => {
      head.innerHTML = '';
      const disc = S.repairDisc();
      const blurb = {
        repair: P.t('Parts keep their damage between bouts and start the next fight with less HP. A full repair costs {rate} of the part\'s value{disc}. Junk Bin parts are patched for free.', { rate: U.pct(P.REPAIR_RATE), disc: disc ? P.t(' (Repair Bay: -{d})', { d: U.pct(disc) }) : '' }),
        tinker: P.t('Tinkering adds +12% HP and damage per level (max +{n}).', { n: S.tinkerOpts().maxLvl }) + (S.fx('tinkerDisc') ? ' ' + P.t('Tinker Lab: -{d} scrap.', { d: U.pct(S.fx('tinkerDisc')) }) : ''),
        salvage: P.t('Break spare parts down into scrap. Scrap pays for tinkering and Prototype crafting.'),
        blueprints: P.t('Prototypes are one-of-a-kind parts you can ONLY build from blueprints. Find blueprints in first wins, loot crates, the Mystery Tarp and Junk-o-Matic jackpots.'),
      }[tab];
      head.append(h('span', { class: 'npc' }, blurb), h('span', { class: 'chips-inline' }, h('span', { class: 'chip scrap' }, '⚙ ', h('b', null, S.d.scrap)), UI.moneyChip()));
      tabs.innerHTML = '';
      const nDmg = S.damaged(false).length;
      for (const [k, label] of [['repair', P.t('Repair') + (nDmg ? ` (${nDmg})` : '')], ['tinker', P.t('Tinker')], ['salvage', P.t('Salvage')], ['blueprints', P.t('Prototype Blueprints ({n}/{max})', { n: known(), max: P.BLUEPRINTS.length })]]) {
        tabs.appendChild(UI.button(label, () => {
          tab = k;
          draw();
        }, tab === k ? 'tab on' : 'tab'));
      }
      tools.innerHTML = '';
      list.innerHTML = '';
      list.className = 'item-grid';
      if (tab === 'repair') {
        const dmg = S.repairSort(S.damaged(false));
        const eq = dmg.filter((it) => S.inUse(it.uid));
        const sum = (arr) => arr.reduce((a, it) => a + S.repairCost(it), 0);
        const doRepair = (items) => {
          const r = S.repairMany(items);
          if (!r.spent && !r.fixed) {
            if (items.some((it) => it.free)) draw();
            return P.SFX.play(S.d.money <= 0 ? 'ui_bad' : 'clank');
          }
          P.SFX.play('clank');
          UI.toast(r.partial ? P.t('Patched up what {v} could buy.', { v: U.fmtMoney(r.spent) }) : P.t('Repaired for {v}.', { v: U.fmtMoney(r.spent) }), 'good');
          this.fx.spark(MECH_X, MECH_Y - 25, 18, ['#ffd25a', '#ffffff'], 80, { up: 30, glow: true });
          draw();
          this.refresh();
        };
        const cash = Math.floor(S.d.money);
        const btn = (label, items) => {
          const cost = sum(items);
          const free = items.some((it) => it.free);
          return UI.button(cost > cash && cash > 0 ? P.t('{label}: patch with {v}', { label, v: U.fmtMoney(cash) }) : `${label} (${U.fmtMoney(cost)})`, () => doRepair(items), cost && cash > 0 ? 'small primary' : 'small', (cost && cash > 0) || (free && !cost) ? null : { disabled: true });
        };
        tools.appendChild(h('div', { class: 'bulk-row' }, btn(P.t('Repair equipped'), eq), btn(P.t('Repair everything'), dmg)));
        if (!dmg.length) list.appendChild(h('div', { class: 'empty-note' }, P.t("Nothing to fix. Everything is in mint condition (for junk).")));
        for (const it of dmg) {
          const cost = S.repairCost(it);
          const use = S.inUse(it.uid);
          list.appendChild(UI.itemCard(it, {
            cls: use ? 'equipped' : '',
            sub: `${use ? (S.d.mechs.length > 1 ? '#' + (use.mech + 1) + ' ' : '') + P.slotLabel(use.slot) : P.t('spare')} · ${P.t('{w} damaged', { w: U.pct(it.wear) })}`,
            right: UI.button(cost ? (cash >= cost ? P.t('Repair {v}', { v: U.fmtMoney(cost) }) : P.t('Patch {v}', { v: U.fmtMoney(Math.max(0, cash)) })) : P.t('Free patch'), () => doRepair([it]), 'small' + (cost && cash > 0 ? ' primary' : ''), !cost || cash > 0 ? null : { disabled: true }),
          }));
        }
      } else if (tab === 'tinker') {
        tools.appendChild(UI.sortBar(draw));
        const items = UI.sortItems(S.d.inventory.filter((i) => P.PARTS[i.id].cat !== 'module')).sort((a, b) => (!!S.slotOf(b.uid)) - (!!S.slotOf(a.uid)));
        const topts = S.tinkerOpts();
        for (const it of items) {
          const cost = P.Loot.tinkerCost(it, topts);
          const can = cost != null && S.d.scrap >= cost;
          list.appendChild(UI.itemCard(it, {
            cls: S.slotOf(it.uid) ? 'equipped' : '',
            right: cost == null ? h('span', { class: 'badge-eq' }, P.t('MAX')) : UI.button(`+1 (⚙${cost})`, () => {
              if (!can) return P.SFX.play('ui_bad');
              S.d.scrap -= cost;
              it.lvl = (it.lvl || 0) + 1;
              S.save();
              P.SFX.play('clank');
              UI.toast(P.t('{name} tinkered to +{n}', { name: P.partName(it.id), n: it.lvl }), 'good');
              this.fx.spark(MECH_X, MECH_Y - 25, 20, ['#9fe8ff', '#ffffff'], 90, { up: 30, glow: true });
              draw();
              this.refresh();
            }, can ? 'small primary' : 'small', can ? null : { disabled: true }),
          }));
        }
      } else if (tab === 'salvage') {
        tools.appendChild(UI.sortBar(draw));
        const spare = S.d.inventory.filter((i) => !S.inUse(i.uid));
        const commons = spare.filter((i) => P.PARTS[i.id].rarity === 'common' && !i.free);
        const dupes = duplicates();
        const freebies = spare.filter((i) => i.free);
        const bulk = h('div', { class: 'bulk-row' });
        const sum = (arr) => arr.reduce((a, it) => a + P.Loot.salvageValue(it), 0);
        bulk.append(
          UI.button(P.t('Salvage all Commons ({n}, +⚙{v})', { n: commons.length, v: sum(commons) }), () => salvageMany(commons, P.t('all spare Commons')), 'small', commons.length ? null : { disabled: true }),
          UI.button(P.t('Salvage duplicates ({n}, +⚙{v})', { n: dupes.length, v: sum(dupes) }), () => salvageMany(dupes, P.t('spare copies — your best copy of each is kept')), 'small', dupes.length ? null : { disabled: true }),
          UI.button(P.t('Toss Junk Bin freebies ({n})', { n: freebies.length }), () => salvageMany(freebies, P.t('free junk, worth nothing')), 'small ghost', freebies.length ? null : { disabled: true }),
        );
        tools.appendChild(bulk);
        if (!spare.length) list.appendChild(h('div', { class: 'empty-note' }, P.t('No spare parts. Equipped parts cannot be salvaged.')));
        for (const it of UI.sortItems(spare)) {
          const val = P.Loot.salvageValue(it);
          list.appendChild(UI.itemCard(it, {
            right: UI.button(P.t('Salvage (+⚙{v})', { v: val }), async () => {
              if (rarIdx(it) >= 2 && !(await UI.confirm(P.t('Break down {name} for {v} scrap?', { name: P.itemName(it), v: val }), P.t('Salvage')))) return;
              S.removeItem(it.uid);
              S.d.scrap += val;
              S.save();
              P.SFX.play('break');
              draw();
              this.refresh();
            }, 'small'),
          }));
        }
      } else {
        list.className = 'bp-grid';
        for (const bp of P.BLUEPRINTS) {
          const def = P.PARTS[bp.id];
          if (!S.knowsBlueprint(bp.id)) {
            const how = bp.grant ? P.t('Reward for your first win against {name}.', { name: S.boutFoe(S.boutById(bp.grant)).name }) : P.t('Random find: loot crates, the Mystery Tarp, Lost & Found, Junk-o-Matic jackpots.');
            list.appendChild(h('div', { class: 'bp-tile unknown' },
              h('div', { class: 'bp-q' }, '?'),
              h('div', { class: 'bp-body' }, h('div', { class: 'bp-name' }, P.t('Undiscovered {cat} Prototype', { cat: P.catName(def.cat) })), h('div', { class: 'bp-how' }, how))));
            continue;
          }
          const can = S.d.scrap >= bp.scrap && S.d.money >= bp.money;
          const owned = S.d.inventory.filter((i) => i.id === bp.id).length;
          const tile = h('div', { class: 'bp-tile' },
            h('img', { class: 'bp-icon', src: P.Pixel.icon(bp.id, S.d.paint) }),
            h('div', { class: 'bp-body' },
              h('div', { class: 'bp-name' }, P.partName(bp.id), h('span', { class: 'bp-cat' }, ' · ' + P.catName(def.cat))),
              h('div', { class: 'bp-desc' }, P.partDesc(bp.id)),
              h('div', { class: 'bp-stats dim' }, P.Stats.itemSummary({ id: bp.id, lvl: 0 }) + (owned ? ' · ' + P.t('you own {n}', { n: owned }) : ''))),
            UI.button(h('span', null, P.t('Build'), h('small', null, `⚙${bp.scrap} + ${U.fmtMoney(bp.money)}`)), () => {
              if (!can) return P.SFX.play('ui_bad');
              const it = S.craftPrototype(bp.id);
              if (!it) return;
              P.SFX.play('jackpot');
              UI.toast(P.t('Built a {name}! Find it in your Parts Bin.', { name: P.partName(bp.id) }), 'good');
              this.fx.spark(MECH_X, MECH_Y - 25, 30, ['#ff6ad5', '#ffffff', '#ffd76a'], 110, { up: 40, glow: true });
              draw();
              this.refresh();
            }, can ? 'primary' : '', can ? null : { disabled: true }));
          UI.attachTip(tile, () => UI.itemTipHtml({ id: bp.id, lvl: 0, mod: null }));
          list.appendChild(tile);
        }
      }
    };
    draw();
  };

  // =====================================================================================
  // FACILITIES
  // =====================================================================================
  const facName = (f) => P.tc('facilities', f.id, 'name', f.name);
  const facLevelDesc = (f, i) => {
    const tr = P.tc('facilities', f.id, 'levels', null);
    return (tr && tr[i]) || f.levels[i].desc;
  };
  Hub.openFacilities = function () {
    const m = UI.modal(P.t('Facilities'), { cls: 'wide' });
    const head = h('div', { class: 'modal-sub' });
    const grid = h('div', { class: 'fac-grid' });
    m.body.append(head, grid);
    const draw = () => {
      head.innerHTML = '';
      head.append(
        h('span', { class: 'npc' }, 'Marge: ', h('i', null, P.t('"Prize money comes and goes. A garage is forever. Well, until the bank finds out about it."'))),
        h('span', { class: 'chips-inline' }, UI.moneyChip()));
      grid.innerHTML = '';
      for (const f of P.FACILITIES) {
        const lvl = S.facLevel(f.id);
        const open = S.facilityOpen(f);
        const next = S.nextFacilityLevel(f.id);
        const can = open && next && S.d.money >= next.cost;
        const pips = h('span', { class: 'fac-pips' }, f.levels.map((_, i) => h('i', { class: i < lvl ? 'on' : '' })));
        const tile = h('div', { class: 'fac-tile' + (lvl ? ' owned' : '') + (lvl === f.levels.length ? ' maxed' : '') },
          h('div', { class: 'fac-head' }, h('span', { class: 'fac-icon' }, f.icon), h('div', { class: 'fac-name' }, facName(f), pips)),
          h('div', { class: 'fac-blurb dim' }, P.tc('facilities', f.id, 'blurb', f.blurb)),
          lvl ? h('div', { class: 'fac-now' }, h('b', null, P.t('Now:') + ' '), facLevelDesc(f, lvl - 1)) : h('div', { class: 'fac-now dim' }, P.t('Not built yet.')),
          next ? h('div', { class: 'fac-next' }, h('b', null, P.t('Level {n}:', { n: lvl + 1 }) + ' '), facLevelDesc(f, lvl)) : h('div', { class: 'fac-next maxed' }, P.t('Fully upgraded.')),
          h('div', { class: 'fac-later' }, h('b', null, P.t('Later:') + ' '), P.tc('facilities', f.id, 'later', f.later)),
          !open ? h('div', { class: 'fac-locked dim' }, '🔒 ' + P.t('Opens in Chapter 2.')) : next ? UI.button(h('span', null, lvl ? P.t('Upgrade') : P.t('Build'), h('small', null, U.fmtMoney(next.cost))), async () => {
            if (!can) return P.SFX.play('ui_bad');
            if (!(await UI.confirm(P.t('{what} for {cost}?', { what: (lvl ? P.t('Upgrade') : P.t('Build')) + ' ' + facName(f), cost: U.fmtMoney(next.cost) }), lvl ? P.t('Upgrade') : P.t('Build')))) return;
            if (!S.buyFacility(f.id)) return;
            P.SFX.play('jackpot');
            UI.toast(P.t('{name} is now level {n}!', { name: facName(f), n: S.facLevel(f.id) }), 'good');
            this.fx.spark(MECH_X, MECH_Y - 25, 26, ['#ffd76a', '#ffffff', '#9fe8ff'], 100, { up: 40, glow: true });
            draw();
            this.refresh();
          }, 'fac-buy ' + (can ? 'primary' : ''), can ? null : { disabled: true }) : null);
        grid.appendChild(tile);
      }
    };
    draw();
  };

  // =====================================================================================
  // TEAM OFFICE (Chapter 2): hire pilots, sign sponsors, check fame. The Pit Exchange lives here too.
  // =====================================================================================
  Hub.openTeamOffice = function (startTab) {
    const m = UI.modal(P.t('Team Office'), { cls: 'wide' });
    let tab = startTab || (S.d.mechs.some((x) => !x.pilot) ? 'pilots' : 'sponsors');
    const head = h('div', { class: 'modal-sub' });
    const tabs = h('div', { class: 'tabs' });
    const body = h('div', { class: 'office-body' });
    m.body.append(head, tabs, body);
    const pName = (pl) => pl.name;
    const draw = () => {
      head.innerHTML = '';
      head.append(
        h('span', { class: 'npc' }, 'Marge: ', h('i', null, tab === 'pilots' ? P.t('"Every pilot wants a signing bonus AND a wage. In my day we paid in sandwiches."') : P.t('"Sponsors pay when you win. Win THEIR way and they pay extra. Read the fine print."'))),
        h('span', { class: 'chips-inline' }, h('span', { class: 'chip fame' }, '📺 ' + P.t('Fame') + ' ', h('b', null, S.d.fame)), UI.moneyChip()));
      tabs.innerHTML = '';
      for (const [k, label] of [['pilots', P.t('Pilots')], ['sponsors', P.t('Sponsors') + ` (${S.d.sponsors.length}/${S.sponsorSlots()})`]]) tabs.appendChild(UI.button(label, () => { tab = k; draw(); }, tab === k ? 'tab on' : 'tab'));
      tabs.appendChild(UI.button('📈 ' + P.t('Pit Exchange'), () => { m.close(); this.openExchange(); }, 'tab'));
      body.innerHTML = '';
      if (tab === 'pilots') {
        // your garage and who flies what
        const crew = h('div', { class: 'crew-row' });
        S.d.mechs.forEach((mm, i) => {
          const rec = S.mechRec(i);
          const pil = i === 0 ? null : P.PILOTS_BY_ID[mm.pilot];
          let ctl;
          if (i === 0) ctl = h('b', null, P.t('You'));
          else {
            ctl = h('select', null, h('option', { value: '' }, P.t('— nobody —')), S.d.pilots.map((id) => h('option', { value: id, selected: mm.pilot === id }, P.PILOTS_BY_ID[id].name)));
            ctl.addEventListener('change', () => {
              S.assignPilot(i, ctl.value || null);
              draw();
              this.refresh();
            });
          }
          crew.appendChild(h('div', { class: 'crew-card' + (i === 0 || pil ? '' : ' empty') }, h('div', { class: 'crew-mech' }, `#${i + 1} ${rec.name}`), ctl, pil ? h('div', { class: 'dim' }, P.tc('pilots', pil.id, 'quirk', pil.quirk) + ' · ' + P.t('wage {w}/bout', { w: U.fmtMoney(pil.wage) })) : null));
        });
        body.append(h('div', { class: 'list-head' }, P.t('Your garage')), crew, h('div', { class: 'list-head' }, P.t('Pilots for hire')));
        const grid = h('div', { class: 'pilot-grid' });
        for (const pl of P.PILOTS) {
          const hired = S.d.pilots.includes(pl.id);
          const unlocked = S.pilotUnlocked(pl);
          const can = !hired && unlocked && S.d.money >= pl.fee;
          const flying = S.d.mechs.findIndex((x) => x.pilot === pl.id);
          grid.appendChild(h('div', { class: 'pilot-card' + (hired ? ' hired' : '') + (unlocked ? '' : ' locked') },
            h('div', { class: 'pc-name' }, pName(pl), h('span', { class: 'dim' }, ' · ' + P.tc('pilots', pl.id, 'title', pl.title))),
            h('div', { class: 'pc-quirk' }, h('b', null, P.tc('pilots', pl.id, 'quirk', pl.quirk) + ': '), P.tc('pilots', pl.id, 'desc', pl.desc)),
            h('div', { class: 'pc-bio dim' }, unlocked ? P.tc('pilots', pl.id, 'bio', pl.bio) : P.t('Available after beating {name}.', { name: S.boutFoe(S.boutById(pl.unlock)).name })),
            h('div', { class: 'pc-foot' },
              h('span', null, P.t('Signing {f} · wage {w}/bout', { f: U.fmtMoney(pl.fee), w: U.fmtMoney(pl.wage) })),
              hired
                ? h('span', { class: 'row' }, h('span', { class: 'badge-eq' }, flying >= 0 ? P.t('flies #{n}', { n: flying + 1 }) : P.t('on the bench')), UI.button(P.t('Release'), async () => {
                  if (!(await UI.confirm(P.t('Release {name}? The signing bonus is not refunded.', { name: pName(pl) }), P.t('Release')))) return;
                  S.firePilot(pl.id);
                  draw();
                  this.refresh();
                }, 'small ghost'))
                : UI.button(P.t('Hire ({f})', { f: U.fmtMoney(pl.fee) }), () => {
                  if (!S.hirePilot(pl.id)) return P.SFX.play('ui_bad');
                  P.SFX.play('coin');
                  UI.toast(P.t('{name} joins the team!', { name: pName(pl) }), 'good');
                  draw();
                  this.refresh();
                }, can ? 'small primary' : 'small', can ? null : { disabled: true }))));
        }
        body.appendChild(grid);
        body.appendChild(h('div', { class: 'dim small-print' }, P.t('Pilot quirks work like a passive on the mech they fly. Training Sim bonuses apply to every pilot. Wages are paid for each bout a pilot fights.')));
      } else {
        const slots = S.sponsorSlots();
        const cond = (sp) => P.t('Bonus {v} if you {cond}.', { v: U.fmtMoney(sp.bonus.pay), cond: S.sponsorCondText(sp) });
        const card = (sp, right, extra) => h('div', { class: 'sponsor-card' },
          h('div', { class: 'sp-name' }, sp.name),
          h('div', { class: 'sp-blurb dim' }, P.tc('sponsors', sp.id, 'blurb', sp.blurb)),
          h('div', { class: 'sp-terms' }, P.t('{v} per win.', { v: U.fmtMoney(sp.pay) }) + ' ' + cond(sp)),
          extra || null,
          h('div', { class: 'sp-foot' }, right));
        body.append(h('div', { class: 'list-head' }, P.t('Active contracts ({n}/{max})', { n: S.d.sponsors.length, max: slots }), h('span', { class: 'dim' }, P.t('more slots: Sponsorship Office'))));
        const act = h('div', { class: 'sponsor-grid' });
        if (!S.d.sponsors.length) act.appendChild(h('div', { class: 'empty-note' }, P.t('No sponsors yet. Sign one below: free money for winning.')));
        for (const c of S.d.sponsors) {
          const sp = P.SPONSORS_BY_ID[c.id];
          act.appendChild(card(sp, UI.button(P.t('Drop'), () => {
            S.dropSponsor(c.id);
            draw();
          }, 'small ghost'), h('div', { class: 'sp-left' }, P.t('{n} bouts left', { n: c.left }))));
        }
        body.appendChild(act);
        body.appendChild(h('div', { class: 'list-head' }, P.t("Today's offers"), h('span', { class: 'dim' }, P.t('new offers every day · bigger brands call as your fame grows'))));
        const offers = h('div', { class: 'sponsor-grid' });
        const list = S.sponsorOffers();
        if (!list.length) offers.appendChild(h('div', { class: 'empty-note' }, P.t('Nobody is calling today. Win something.')));
        for (const sp of list) {
          const full = S.d.sponsors.length >= slots;
          offers.appendChild(card(sp, UI.button(P.t('Sign ({n} bouts)', { n: sp.bouts }), () => {
            if (!S.signSponsor(sp.id)) return P.SFX.play('ui_bad');
            P.SFX.play('coin');
            UI.toast(P.t('Signed with {name}!', { name: sp.name }), 'good');
            draw();
          }, full ? 'small' : 'small primary', full ? { disabled: true, title: P.t('All sponsor slots are full.') } : null)));
        }
        body.appendChild(offers);
        const nextBig = P.SPONSORS.filter((s) => s.fame > S.d.fame).sort((a, b) => a.fame - b.fame)[0];
        if (nextBig) body.appendChild(h('div', { class: 'dim small-print' }, P.t('Next big brand ({name}) calls at fame {f}.', { name: nextBig.name, f: nextBig.fame })));
      }
    };
    draw();
  };

  // =====================================================================================
  // JUNK-O-MATIC 3000
  // =====================================================================================
  Hub.openFuser = function () {
    const m = UI.modal(P.t('Junk-o-Matic 3000'), { cls: 'wide' });
    let slots = [null, null, null];
    let busy = false;
    let lastId = null;
    const machine = h('div', { class: 'fuser-machine' });
    const side = h('div', { class: 'fuser-side' });
    m.body.append(h('div', { class: 'modal-sub' },
      h('span', { class: 'npc' }, 'Marge: ', h('i', null, P.t('"Three parts go in. One part comes out. Nobody knows how. Don\'t put your hand in it."'))),
      h('span', { class: 'chip luck' }, '☘ ' + P.t('Luck') + ' ', h('b', null, S.luck()))), h('div', { class: 'fuser' }, machine, side));

    const eligible = () => S.d.inventory.filter((it) => !S.inUse(it.uid) && !it.free && !slots.includes(it.uid));
    const items = () => slots.map((u) => S.item(u)).filter(Boolean);

    const draw = () => {
      machine.innerHTML = '';
      const slotRow = h('div', { class: 'fuser-slots' });
      slots.forEach((uid, i) => {
        const it = uid ? S.item(uid) : null;
        const box = h('div', { class: 'fuser-slot' + (it ? ' full' : '') }, it ? UI.itemCard(it, { sub: P.rarName(P.PARTS[it.id].rarity) }) : h('div', { class: 'fuser-empty' }, P.t('INSERT PART')));
        if (it) box.addEventListener('click', () => {
          if (busy) return;
          slots[i] = null;
          P.SFX.play('ui');
          draw();
        });
        slotRow.appendChild(box);
      });
      const reel = h('div', { class: 'fuser-reel' }, h('div', { class: 'reel-window' }, lastId ? h('img', { class: 'reel-icon', src: P.Pixel.icon(lastId, S.d.paint) }) : h('span', { class: 'dim' }, '???')));
      const odds = h('div', { class: 'fuser-odds' });
      const ins = items();
      if (ins.length === 3) {
        const o = P.Loot.fuseOdds(ins, S.luck());
        odds.appendChild(h('div', { class: 'list-head' }, P.t('Odds')));
        for (const r of P.RARITY_ORDER.slice(0, 5)) {
          const p = o.probs[r];
          if (p < 0.001) continue;
          odds.appendChild(h('div', { class: 'odds-row' }, h('span', { style: { color: P.RARITY[r].color } }, P.rarName(r)), h('div', { class: 'odds-bar' }, h('div', { style: { width: p * 100 + '%', background: P.RARITY[r].color } })), h('b', null, Math.round(p * 100) + '%')));
        }
        const notes = [];
        if (o.catBias) notes.push(P.t('{p}% chance of a {cat}', { p: Math.round(o.catBias.chance * 100), cat: P.catName(o.catBias.cat) }));
        if (o.tagBias && P.SYNERGIES[o.tagBias.tag]) notes.push(P.t('50% chance of a {syn} part', { syn: P.synName(o.tagBias.tag) }));
        if (o.lvl) notes.push(P.t('comes out tinkered +{n}', { n: o.lvl }));
        notes.push(P.t('{p}% chance of a bonus Prototype blueprint', { p: (o.blueprintChance * 100).toFixed(1) }));
        odds.appendChild(h('div', { class: 'odds-notes dim' }, notes.join(' · ')));
      } else odds.appendChild(h('div', { class: 'dim odds-notes' }, P.t('Feed it three spare parts. Higher rarity in = higher rarity out. Match categories or synergy tags to steer the result. Luck tilts the odds.')));
      const crank = UI.button(P.t('CRANK IT!'), () => run(reel), 'primary big crank-btn', ins.length === 3 && !busy ? null : { disabled: true });
      machine.append(slotRow, h('div', { class: 'fuser-mid' }, reel, odds), crank);

      side.innerHTML = '';
      side.append(h('div', { class: 'list-head' }, P.t('Your spare parts')), UI.sortBar(draw));
      const lst = h('div', { class: 'item-list' });
      const el = UI.sortItems(eligible());
      if (!el.length) lst.appendChild(h('div', { class: 'empty-note' }, P.t('No spare parts to feed it. Equipped parts and Junk Bin freebies are not accepted.')));
      for (const it of el) {
        lst.appendChild(UI.itemCard(it, {
          onClick: () => {
            if (busy) return;
            const i = slots.indexOf(null);
            if (i < 0) return P.SFX.play('ui_bad');
            slots[i] = it.uid;
            draw();
          },
        }));
      }
      side.appendChild(lst);
    };

    const run = (reel) => {
      const ins = items();
      if (ins.length !== 3 || busy) return;
      busy = true;
      const luck = S.luck();
      const res = P.Loot.fuse(ins, luck);
      for (const it of ins) S.removeItem(it.uid);
      const inst = S.addItem(res.item);
      lastId = inst.id;
      let bp = null;
      if (res.blueprint) {
        bp = S.randomUnknownBlueprint();
        if (bp) S.learnBlueprint(bp);
      }
      S.save();
      slots = [null, null, null];
      machine.classList.add('cranking');
      P.SFX.play('fuse');
      this.fx.smoke(MECH_X + 40, MECH_Y - 10, 8, { size: 1.4, color: '#5a5048', a: 0.5 });
      const win = reel.querySelector('.reel-window');
      const pool = P.Loot.pool();
      let n = 0;
      const total = 22;
      const spin = () => {
        n++;
        const fake = n < total ? U.rng.pick(pool) : P.PARTS[inst.id];
        win.innerHTML = '';
        win.appendChild(h('img', { class: 'reel-icon', src: P.Pixel.icon(fake.id, S.d.paint) }));
        win.style.borderColor = P.RARITY[fake.rarity].color;
        P.SFX.play('reel', { gap: 10 });
        if (n < total) setTimeout(spin, 45 + n * n * 0.6);
        else {
          machine.classList.remove('cranking');
          const big = rarIdx(inst) >= 3;
          P.SFX.play(big ? 'jackpot' : 'loot');
          win.classList.add('landed');
          const result = h('div', { class: 'fuser-result' }, h('div', { class: 'list-head' }, big ? '★ ' + P.t('JACKPOT') + ' ★' : P.t('Out comes...')), UI.itemCard(inst, { cls: 'reveal rar-' + P.PARTS[inst.id].rarity }));
          if (bp) result.appendChild(UI.blueprintCard(bp, P.t('it was stuck in the gears!')));
          reel.after(result);
          busy = false;
          setTimeout(() => {
            this.refresh();
          }, 50);
          // redraw controls but keep the result visible
          const keep = result;
          setTimeout(() => {
            draw();
            const mid = machine.querySelector('.fuser-mid');
            if (mid) mid.appendChild(keep);
          }, 900);
        }
      };
      spin();
    };
    draw();
  };

  // =====================================================================================
  // PIT EXCHANGE
  // =====================================================================================
  function sparkline(hist) {
    const c = h('canvas', { class: 'spark', width: 120, height: 32 });
    const x = c.getContext('2d');
    const min = Math.min(...hist), max = Math.max(...hist);
    const up = hist[hist.length - 1] >= hist[0];
    x.strokeStyle = up ? '#7ee07a' : '#ff6a5a';
    x.lineWidth = 2;
    x.beginPath();
    hist.forEach((v, i) => {
      const px = hist.length > 1 ? (i / (hist.length - 1)) * 116 + 2 : 60;
      const py = 30 - ((v - min) / Math.max(1e-6, max - min)) * 26;
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    });
    x.stroke();
    return c;
  }

  Hub.openExchange = function () {
    const m = UI.modal(P.t('The Pit Exchange'), { cls: 'wide' });
    const head = h('div', { class: 'modal-sub' });
    const list = h('div', { class: 'venture-list' });
    m.body.append(head, list);
    const draw = () => {
      head.innerHTML = '';
      const pv = S.portfolioValue();
      head.append(
        h('span', { class: 'npc' }, P.t("Vinnie (Marge's cousin): "), h('i', null, P.t('"Prices move once a day, after every bout. Buy low, sell high, cry often. This is not financial advice. I am not licensed to give any."'))),
        h('span', { class: 'chips-inline' }, UI.moneyChip(P.t('Cash')), h('span', { class: 'chip money' }, P.t('Portfolio') + ' ', h('b', null, U.fmtMoney(pv)))));
      list.innerHTML = '';
      for (const v of P.VENTURES) {
        const unlocked = S.ventureUnlocked(v);
        const hist = S.d.market.hist[v.id];
        const price = S.d.market.prices[v.id];
        const prev = hist.length > 1 ? hist[hist.length - 2] : price;
        const ch = Math.round((price / prev - 1) * 100);
        const val = S.holdingValue(v.id);
        const basis = S.d.costBasis[v.id] || 0;
        const pl = basis ? Math.round((val / basis - 1) * 100) : 0;
        const risk = h('span', { class: 'risk', title: P.t('Risk {n}/5', { n: v.risk }) }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= v.risk ? 'on' : '' })));
        const row = h('div', { class: 'venture' + (unlocked ? '' : ' locked') },
          h('div', { class: 'v-main' }, h('div', { class: 'v-name' }, v.name, ' ', risk), h('div', { class: 'v-blurb dim' }, unlocked ? P.tc('ventures', v.id, 'blurb', v.blurb) : P.t('Unlocks after beating {name}.', { name: S.boutFoe(S.boutById(v.unlock)).name }))),
          sparkline(hist),
          h('div', { class: 'v-price' }, h('b', null, price.toFixed(2)), h('span', { class: ch >= 0 ? 'up' : 'down' }, `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch)}%`)),
          h('div', { class: 'v-stake' }, val > 0 ? h('span', null, P.t('Stake') + ' ', h('b', null, U.fmtMoney(val)), ' ', h('span', { class: pl >= 0 ? 'up' : 'down' }, `(${pl >= 0 ? '+' : ''}${pl}%)`)) : h('span', { class: 'dim' }, P.t('No stake'))),
          h('div', { class: 'v-btns' },
            ...[25, 100].map((amt) => UI.button('+$' + amt, () => {
              if (!S.invest(v.id, amt)) return P.SFX.play('ui_bad');
              P.SFX.play('coin');
              draw();
              this.renderChips();
            }, 'small', unlocked && S.d.money >= amt ? null : { disabled: true })),
            UI.button(P.t('Cash out'), () => {
              const got = S.cashOut(v.id);
              if (!got) return;
              P.SFX.play('coin');
              UI.toast(P.t('Cashed out {v} from {name}', { v: U.fmtMoney(got), name: v.name }), got >= basis ? 'good' : 'bad');
              draw();
              this.renderChips();
            }, 'small ghost', val > 0 ? null : { disabled: true })));
        list.appendChild(row);
      }
    };
    draw();
  };
})();
