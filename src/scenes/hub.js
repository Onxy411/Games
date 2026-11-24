// Part-Time Pilot — the junkyard hub: mech builder in the middle, everything else one click away.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const h = U.h;
  const UI = P.UI;
  const S = P.State;
  P.Scenes = P.Scenes || {};

  const MECH_X = 157, MECH_Y = 108;

  const Hub = {
    enter(params) {
      params = params || {};
      R().setWorld(320, 180);
      this.env = P.Env.hub();
      this.fx = new P.FX();
      this.fx.groundY = MECH_Y;
      this.view = new P.MechView(S.build(), { facing: 1, x: MECH_X, y: MECH_Y });
      this.t = 0;
      this.selected = this.defaultSlot();
      this.binMode = 'slot';
      this.preview = null;
      S.ensureShop();
      P.Music.play('hub');
      this.buildUI();
      this.refresh();
      this.escHandler = (e) => {
        if (e.code === 'Escape' && UI.topModal && document.body.contains(UI.topModal.wrap)) UI.topModal.close();
      };
      window.addEventListener('keydown', this.escHandler);
      if (params.dialog && params.dialog.length) setTimeout(() => UI.dialog(params.dialog).then(() => params.after && params.after()), 350);
      else if (params.after) params.after();
      if (params.toasts) params.toasts.forEach((t, i) => setTimeout(() => UI.toast(t, 'good'), 600 + i * 500));
      // Pit Exchange headlines from the day that just passed
      const news = S.d.pendingNews || [];
      S.d.pendingNews = [];
      news.filter((n) => n.held || Math.random() < 0.6).slice(0, 3).forEach((n, i) => setTimeout(() => UI.toast('📈 ' + n.text, n.good ? 'good' : 'bad'), 1400 + i * 700));
    },
    exit() {
      this.env.dispose();
      window.removeEventListener('keydown', this.escHandler);
    },
    defaultSlot() {
      const slots = S.slots();
      for (const k of slots) {
        if (!S.d.equip[k] && S.d.inventory.some((i) => P.PARTS[i.id].cat === P.slotCat(k) && !S.inUse(i.uid))) return k;
      }
      return 'chassis';
    },

    // ---------------- rendering ----------------
    update(dt) {
      this.t += dt;
      this.view.update(dt);
      this.fx.update(dt, this.t);
      for (const em of this.env.emitters) {
        if (em.kind === 'fire' && Math.random() < dt * 14) this.fx.fireBurst(em.x + (Math.random() - 0.5) * 6, em.y, 1);
        if (em.kind === 'fire' && Math.random() < dt * 1.5) this.fx.smoke(em.x, em.y - 6, 1, { size: 0.8, color: '#3a3036', a: 0.35, life: 2 });
      }
      // welding sparks at the workbench
      if (Math.random() < dt * 1.2) {
        this.fx.spark(104, 88, 8, ['#fff6c0', '#ffd25a', '#8fe8ff'], 70, { up: 30, glow: true });
        this.fx.light(104, 88, 14, '#9fe8ff', 0.12, 0.8);
      }
    },
    render(dt) {
      const R = P.R;
      R.beginFrame();
      this.env.drawBack(this.t, { sway: 1 });
      R.beginWorld();
      this.view.draw(R.wctx);
      this.fx.drawWorld(R.wctx);
      R.presentWorld();
      for (const l of this.view.lights) R.glow(l.x, l.y, l.r, l.color, l.a);
      this.fx.drawScreen();
      this.env.drawFront(this.t, dt, { sway: 1 });
    },

    // ---------------- UI ----------------
    buildUI() {
      UI.clear();
      const root = h('div', { class: 'hub' });
      this.el = {};
      const E = this.el;
      E.chips = h('div', { class: 'chips' });
      E.pips = h('div', { class: 'pips' });
      root.appendChild(h('div', { class: 'topbar panel' },
        h('div', { class: 'logo-small' }, 'PART-TIME PILOT', h('span', null, (S.chapterId() === 'ch2' ? 'Ch.2 · ' : 'Ch.1 · ') + P.tc('chapters', S.chapterId(), 'short', S.chapter().short))),
        E.chips, E.pips));

      E.nameInput = h('input', { class: 'mech-name', value: S.d.mechName, maxlength: 22, spellcheck: 'false',
        onchange: (e) => {
          S.d.mechName = e.target.value.trim() || 'Rustbucket';
          S.save();
        } });
      E.slots = h('div', { class: 'slot-list' });
      E.garage = h('div', { class: 'garage-tabs' });
      E.pilot = h('div', { class: 'pilot-row' });
      root.appendChild(h('div', { class: 'panel hub-left' }, h('h2', { class: 'title' }, S.d.mechs.length > 1 ? P.t('Your Garage') : P.t('Your Mech')), E.garage, E.nameInput, E.pilot, E.slots));

      E.binTitle = h('h2', { class: 'title' }, P.t('Parts Bin'));
      E.binTabs = h('div', { class: 'tabs' });
      E.bin = h('div', { class: 'item-list' });
      root.appendChild(h('div', { class: 'panel hub-right' }, E.binTitle, E.binTabs, E.bin));

      E.stats = h('div', { class: 'stat-grid' });
      E.syn = h('div', { class: 'syn-row' });
      E.paint = h('div', { class: 'paint-row' });
      root.appendChild(h('div', { class: 'panel hub-center' }, E.stats, E.syn, E.paint));

      E.nav = h('div', { class: 'hub-nav' });
      root.appendChild(E.nav);
      UI.root.appendChild(root);
      this.buildNav();
    },

    buildNav() {
      const E = this.el;
      E.nav.innerHTML = '';
      const nb = S.nextBout();
      E.nav.appendChild(UI.button(h('span', null, S.chapterId() === 'ch2' ? '⚔ ' + P.t('Enter the Arena') : '⚔ ' + P.t('Enter the Pit'), h('small', null, nb ? P.boutTitle(nb).split('—')[0] : P.t('Free play'))), () => this.openLadder(), 'primary big'));
      E.nav.appendChild(UI.button('🛒 ' + P.t('Swap Meet'), () => this.openShop()));
      E.nav.appendChild(UI.button('🔧 ' + P.t('Workbench'), () => this.openWorkbench()));
      E.nav.appendChild(UI.button('🎰 ' + P.t('Junk-o-Matic'), () => this.openFuser()));
      const facNew = P.FACILITIES.some((f) => {
        const n = S.nextFacilityLevel(f.id);
        return n && S.d.money >= n.cost;
      });
      E.nav.appendChild(UI.button(h('span', null, '🏗 ' + P.t('Facilities'), facNew ? h('i', { class: 'badge' }, '$') : null), () => this.openFacilities()));
      E.nav.appendChild(UI.button(h('span', null, '🗑 ' + P.t('Work a Shift'), S.canShift() ? h('i', { class: 'badge' }, '!') : null), () => this.openShift()));
      if (S.d.ch2) {
        const unpiloted = S.d.mechs.some((m) => !m.pilot);
        E.nav.appendChild(UI.button(h('span', null, '📺 ' + P.t('Team Office'), unpiloted ? h('i', { class: 'badge' }, '!') : null), () => this.openTeamOffice()));
      } else E.nav.appendChild(UI.button('📈 ' + P.t('Pit Exchange'), () => this.openExchange()));
      E.nav.appendChild(UI.button('🎞', () => this.openReplays(), 'icon-btn', { title: P.t('Replays') }));
      E.nav.appendChild(UI.button('☰', () => this.openMenu(), 'icon-btn', { title: P.t('Menu') }));
    },

    // Garage tabs (Chapter 2): pick which mech the builder edits, and who flies it
    renderGarage() {
      const E = this.el;
      E.garage.innerHTML = '';
      E.pilot.innerHTML = '';
      E.nameInput.value = S.d.mechName;
      if (S.d.mechs.length < 2) return;
      S.d.mechs.forEach((m, i) => {
        const rec = S.mechRec(i);
        const pil = S.pilotName(i);
        const b = UI.button(h('span', null, `#${i + 1} ${rec.name}`, h('small', null, pil || P.t('no pilot'))), () => {
          if (i === S.d.cur) return;
          S.selectMech(i);
          this.selected = this.defaultSlot();
          this.preview = null;
          P.SFX.play('clank');
          this.refresh();
        }, 'garage-tab' + (i === S.d.cur ? ' on' : '') + (pil ? '' : ' warn'));
        E.garage.appendChild(b);
      });
      if (S.d.cur === 0) {
        E.pilot.append(h('label', null, P.t('Pilot')), h('b', null, P.t('You')));
        return;
      }
      const sel = h('select', null, h('option', { value: '' }, P.t('— nobody —')), S.d.pilots.map((id) => h('option', { value: id, selected: S.d.mechs[S.d.cur].pilot === id }, P.PILOTS_BY_ID[id].name + ' · ' + P.tc('pilots', id, 'quirk', P.PILOTS_BY_ID[id].quirk))));
      sel.addEventListener('change', () => {
        S.assignPilot(S.d.cur, sel.value || null);
        this.refresh();
      });
      E.pilot.append(h('label', null, P.t('Pilot')), sel, UI.button(P.t('Hire…'), () => this.openTeamOffice('pilots'), 'small ghost'));
    },

    refresh() {
      UI.hideTip();
      this.view.setBuild(this.preview || S.build());
      this.renderGarage();
      this.renderChips();
      this.renderSlots();
      this.renderBin();
      this.renderStats();
      this.renderPaint();
      this.buildNav();
    },

    renderChips() {
      const E = this.el;
      const st = S.stats();
      E.chips.innerHTML = '';
      E.chips.append(
        h('div', { class: 'chip' }, P.t('Day') + ' ', h('b', null, S.d.day)),
        UI.moneyChip(),
        UI.attachTip(h('div', { class: 'chip scrap' }, '⚙ ', h('b', null, S.d.scrap), ' ' + P.t('scrap')), P.t('Scrap: salvage unwanted parts at the Workbench, spend it to tinker and craft.')),
        UI.attachTip(h('div', { class: 'chip luck' }, '☘ ' + P.t('Luck') + ' ', h('b', null, st.luck)), P.t('Luck improves crits, loot rarity, extra salvage picks, Junk-o-Matic odds and the occasional miracle survival.') + (S.d.luckBonus ? '<br>' + P.t('Includes +{n} from your raccoon friend.', { n: S.d.luckBonus }) : '')),
      );
      const bill = S.repairBill(true);
      if (bill > 0) {
        const rc = h('div', { class: 'chip repair clickable' }, '🔧 ', P.t('Repairs'), ' ', h('b', null, U.fmtMoney(bill)));
        rc.addEventListener('click', () => this.openWorkbench('repair'));
        E.chips.appendChild(UI.attachTip(rc, P.t('Your equipped parts are still damaged from the last bout and will start the next one with less HP. Click to repair.')));
      }
      const pv = S.portfolioValue();
      if (pv > 0) E.chips.appendChild(UI.attachTip(h('div', { class: 'chip money' }, '📈 ', h('b', null, U.fmtMoney(pv))), P.t('Your Pit Exchange portfolio value.')));
      if (S.d.ch2) E.chips.appendChild(UI.attachTip(h('div', { class: 'chip fame' }, '📺 ' + P.t('Fame') + ' ', h('b', null, S.d.fame)), P.t('Fame fills the seats: the gate share and your merch stand grow with it, and bigger sponsors call. Wins and stylish K.O.s raise it; losses dent it.')));
      E.pips.innerHTML = '';
      for (const b of S.bouts()) {
        const st2 = S.boutStatus(b.id);
        E.pips.appendChild(UI.attachTip(h('div', { class: 'pip ' + st2 + (b.boss ? ' boss' : '') }), `${P.boutTitle(b)}<br><span class="dim">${S.boutFoe(b).name} — ${P.t(st2)}</span>`));
      }
    },

    renderSlots() {
      const E = this.el;
      E.slots.innerHTML = '';
      const slots = S.slots();
      for (const key of slots) {
        const uid = S.d.equip[key];
        const it = uid ? S.item(uid) : null;
        const cat = P.slotCat(key);
        const spare = S.d.inventory.some((i) => P.PARTS[i.id].cat === cat && !S.inUse(i.uid));
        const row = h('div', { class: 'slot-row' + (this.selected === key ? ' selected' : '') + (it ? '' : ' empty') },
          h('div', { class: 'slot-label' }, P.slotLabel(key), cat === 'mount' ? h('i', { class: 'flex' }, P.t('flex')) : null),
          it ? h('img', { class: 'slot-icon', src: P.Pixel.icon(it.id, S.d.paint) }) : h('div', { class: 'slot-icon none' }, P.CATS[cat].icon),
          h('div', { class: 'slot-item', style: { color: it ? UI.rarColor(it) : '' } }, it ? P.itemName(it) : P.t('— empty —'), it && it.wear > 0.001 ? h('span', { class: 'wear-tag' }, ' ' + U.pct(1 - it.wear)) : null),
          !it && spare ? h('div', { class: 'slot-hint' }, '!') : null);
        row.addEventListener('click', () => {
          P.SFX.play('ui');
          this.selected = key;
          this.binMode = 'slot';
          this.renderSlots();
          this.renderBin();
        });
        if (it) UI.attachTip(row, () => UI.itemTipHtml(it));
        E.slots.appendChild(row);
      }
      const ch = S.item(S.d.equip.chassis);
      const def = ch ? P.PARTS[ch.id] : null;
      if (def) E.slots.appendChild(h('div', { class: 'slot-foot dim' }, P.t('{name}: {m} flexible hardpoint(s) (weapons or utilities), {n} module bay(s).', { name: P.partName(def.id), m: def.chassis.mounts, n: def.chassis.modules })));
    },

    renderBin() {
      const E = this.el;
      const sel = this.selected;
      const cat = P.slotCat(sel);
      E.binTabs.innerHTML = '';
      E.binTabs.append(
        UI.button(P.slotLabel(sel), () => { this.binMode = 'slot'; this.renderBin(); }, this.binMode === 'slot' ? 'tab on' : 'tab'),
        UI.button(P.t('All parts ({n})', { n: S.d.inventory.length }), () => { this.binMode = 'all'; this.renderBin(); }, this.binMode === 'all' ? 'tab on' : 'tab'),
        UI.sortSelect(() => this.renderBin()),
      );
      E.bin.innerHTML = '';
      const rarIdx = (it) => P.RARITY_ORDER.indexOf(P.PARTS[it.id].rarity);
      if (this.binMode === 'slot') {
        E.binTitle.textContent = P.t('Parts Bin — {cat}', { cat: P.catName(cat) });
        const cur = S.d.equip[sel];
        if (cur && sel !== 'chassis') {
          E.bin.appendChild(UI.button(P.t('Unequip {slot}', { slot: P.slotLabel(sel) }), () => {
            S.unequip(sel);
            this.preview = null;
            this.refresh();
          }, 'small ghost'));
        }
        const list = S.d.inventory.filter((i) => P.PARTS[i.id].cat === cat)
          .sort((a, b) => (b.uid === cur) - (a.uid === cur) || (!!S.inUse(a.uid)) - (!!S.inUse(b.uid)) || (UI.SORTS[S.settings.sort] || UI.SORTS.rarity).fn(a, b));
        if (!list.length) E.bin.appendChild(h('div', { class: 'empty-note' }, P.t('No {cat} parts. Win bouts, work shifts, or visit the Swap Meet (the Junk Bin is free).', { cat: P.catName(cat).toLowerCase() })));
        for (const it of list) {
          const where = S.slotOf(it.uid);
          const use = S.inUse(it.uid);
          let right;
          if (where === sel) right = h('span', { class: 'badge-eq' }, P.t('EQUIPPED'));
          else if (where) right = h('span', { class: 'badge-other' }, P.t('in {slot}', { slot: P.slotLabel(where) }));
          else if (use) right = h('span', { class: 'badge-other' }, P.t('on #{n}', { n: use.mech + 1 }));
          else right = h('span', { class: 'badge-new' }, it.isNew ? P.t('NEW') : '');
          E.bin.appendChild(UI.itemCard(it, {
            right,
            cls: where === sel ? 'equipped' : '',
            sub: this.deltaLine(sel, it),
            onClick: () => this.equip(sel, it.uid),
            onHover: (on) => this.setPreview(on ? this.overrideFor(sel, it.uid) : null),
          }));
        }
      } else {
        E.binTitle.textContent = P.t('Parts Bin — Everything');
        const order = ['chassis', 'head', 'legs', 'arm', 'mount', 'module'];
        const list = S.d.inventory.slice().sort((a, b) => order.indexOf(P.PARTS[a.id].cat) - order.indexOf(P.PARTS[b.id].cat) || (UI.SORTS[S.settings.sort] || UI.SORTS.rarity).fn(a, b));
        let lastCat = null;
        for (const it of list) {
          const c = P.PARTS[it.id].cat;
          if (c !== lastCat) {
            E.bin.appendChild(h('div', { class: 'list-head' }, P.catName(c)));
            lastCat = c;
          }
          const where = S.slotOf(it.uid);
          const use = S.inUse(it.uid);
          E.bin.appendChild(UI.itemCard(it, {
            right: where ? h('span', { class: 'badge-other' }, P.slotLabel(where)) : use ? h('span', { class: 'badge-other' }, P.t('on #{n}', { n: use.mech + 1 })) : h('span', { class: 'badge-new' }, it.isNew ? P.t('NEW') : ''),
            onClick: () => {
              const slots = S.slots().filter((k) => P.slotCat(k) === c);
              const target = slots.find((k) => !S.d.equip[k]) || slots[0];
              if (target) {
                this.selected = target;
                this.equip(target, it.uid);
              }
            },
          }));
        }
      }
    },

    overrideFor(slot, uid) {
      const o = { [slot]: uid };
      const from = S.slotOf(uid);
      if (from && from !== slot) o[from] = S.d.equip[slot] || null;
      return o;
    },
    deltaLine(slot, it) {
      const base = S.stats();
      const nx = S.stats(this.overrideFor(slot, it.uid));
      const bits = [];
      const d = (label, a, b, digits) => {
        const diff = b - a;
        if (Math.abs(diff) < (digits ? 0.05 : 0.5)) return;
        bits.push(`<span class="${diff > 0 ? 'up' : 'down'}">${label} ${diff > 0 ? '+' : ''}${digits ? diff.toFixed(digits) : Math.round(diff)}</span>`);
      };
      d(P.t('DPS'), base.dps, nx.dps, 1);
      d(P.t('HP'), base.hpTotal, nx.hpTotal);
      d(P.t('Acc'), base.acc, nx.acc);
      d(P.t('Eva'), base.eva, nx.eva);
      d(P.t('Luck'), base.luck, nx.luck);
      d(P.t('Armor'), base.armor, nx.armor);
      const el = document.createElement('span');
      el.innerHTML = bits.length ? bits.join(' ') : `<span class="dim">${P.Stats.itemSummary(it).split(' · ').slice(0, 3).join(' · ')}</span>`;
      return el;
    },

    setPreview(override) {
      this.preview = override ? S.build(override) : null;
      this.view.setBuild(this.preview || S.build());
      this.renderStats(override);
    },

    equip(slot, uid) {
      if (S.equip(slot, uid)) {
        const it = S.item(uid);
        it.isNew = false;
        S.save();
        P.SFX.play('clank');
        this.fx.spark(MECH_X, MECH_Y - 25, 16, ['#fff6c0', '#ffd25a'], 80, { up: 40, glow: true });
        this.fx.light(MECH_X, MECH_Y - 25, 30, '#ffd27a', 0.25, 0.8);
        this.preview = null;
        this.refresh();
      }
    },

    renderStats(override) {
      const E = this.el;
      const base = S.stats();
      const st = override ? S.stats(override) : base;
      const row = (label, val, d, tip) => {
        const el = h('div', { class: 'stat' }, h('label', null, label), h('b', { html: val + (d || '') }));
        if (tip) UI.attachTip(el, tip);
        return el;
      };
      const pct = (x) => Math.round(x) + '%';
      E.stats.innerHTML = '';
      E.stats.append(
        row(P.t('HP'), st.hpNow < st.hpTotal ? `<span class="bad">${st.hpNow}</span>/${st.hpTotal}` : st.hpTotal, UI.delta(st.hpTotal, base.hpTotal), P.t("Total HP of all parts. The chassis is the core: if it hits 0 you are K.O.'d.") + (st.hpNow < st.hpTotal ? '<br><span class="bad">' + P.t('Damaged parts start the next bout with less HP. Repair them at the Workbench.') + '</span>' : '')),
        row(P.t('Armor'), st.armor, UI.delta(st.armor, base.armor), P.t('Reduces incoming damage (less effective vs energy, explosives and fire).')),
        row(P.t('Accuracy'), st.acc, UI.delta(st.acc, base.acc), P.t('From your head and modules. Losing your head costs a lot of accuracy.')),
        row(P.t('Evasion'), Math.round(st.eva), UI.delta(st.eva, base.eva), P.t('Chance to dodge. Mostly from legs. Lose a leg and it plummets.')),
        row(P.t('Speed'), st.speed.toFixed(2), UI.delta(st.speed, base.speed, (x) => x.toFixed(2)), P.t('How fast you close distance or kite.')),
        row(P.t('Crit'), pct(st.crit + st.luck * 0.3), UI.delta(st.crit + st.luck * 0.3, base.crit + base.luck * 0.3, pct), P.t('Crit chance (crit +75% damage). Includes Luck.')),
        row(P.t('Luck'), st.luck, UI.delta(st.luck, base.luck), P.t('Crits, loot quality, extra salvage and lucky survivals.')),
        row(P.t('Load'), `<span class="${st.overweight > 0 ? 'bad' : ''}">${st.weight}/${st.cap || '—'}</span>`, UI.delta(st.weight, base.weight, null, true), st.overweight > 0 ? P.t('OVERWEIGHT by {p}% — speed and evasion penalties!', { p: Math.round(st.overweight * 100) }) : P.t('Part weight vs. what your legs can carry.')),
        row(P.t('Est. DPS'), st.dps.toFixed(1), UI.delta(st.dps, base.dps, (x) => x.toFixed(1)), P.t('Raw damage per second if every shot hits. Real fights vary a lot.')),
        row(P.t('Aim'), P.targetName(st.targeting), '', P.targetingDesc(st.targeting)),
      );
      E.syn.innerHTML = '';
      const syns = st.synergies.filter((s) => s.count >= 2 || s.tier >= 0);
      if (!syns.length) E.syn.appendChild(h('span', { class: 'dim' }, P.t('No synergies yet — matching part tags unlock bonuses.')));
      for (const s of syns) {
        const stars = s.tiers.map((t, i) => (i <= s.tier ? '★' : '☆')).join('');
        const tip = `<b style="color:${s.color}">${P.synName(s.id)}</b> ${P.t('({n} parts)', { n: s.count })}<br>` + s.tiers.map((t, i) => `<span class="${i <= s.tier ? '' : 'dim'}">${t.n}+: ${P.synTierDesc(s.id, i)}</span>`).join('<br>');
        E.syn.appendChild(UI.attachTip(h('span', { class: 'syn' + (s.tier >= 0 ? ' on' : ''), style: { '--c': s.color } }, `${P.synName(s.id)} ${s.count}`, h('i', null, stars)), tip));
      }
    },

    renderPaint() {
      const E = this.el;
      E.paint.innerHTML = '';
      E.paint.appendChild(h('label', null, P.t('Paint')));
      const unlocked = new Set(S.unlockedPaints());
      for (const p of P.PAINTS) {
        if (p.enemyOnly || (p.unlock && !S.chapterOpen(S.chapterOf(S.boutById(p.unlock))))) continue;
        const ok = unlocked.has(p.id);
        const sw = h('div', { class: 'swatch' + (S.d.paint === p.id ? ' on' : '') + (ok ? '' : ' locked'), style: { background: ok ? `linear-gradient(135deg, ${p.P} 60%, ${p.S} 60%)` : '' } }, ok ? '' : '🔒');
        UI.attachTip(sw, ok ? P.paintName(p) : `${P.paintName(p)}<br><span class="dim">${P.t('Beat {name} to unlock.', { name: S.boutFoe(S.boutById(p.unlock)).name })}</span>`);
        if (ok) sw.addEventListener('click', () => {
          S.d.paint = p.id;
          S.save();
          P.SFX.play('ui_ok');
          this.fx.smoke(MECH_X, MECH_Y - 25, 6, { size: 1.2, color: p.P, a: 0.5 });
          this.refresh();
        });
        E.paint.appendChild(sw);
      }
    },

    // =====================================================================================
    // LADDER
    // =====================================================================================
    openLadder() {
      const m = UI.modal(S.chapterId() === 'ch2' ? P.t('The Public Arena — Bout Ladder') : P.t('The Scrap Pit — Bout Ladder'), { cls: 'wide' });
      const list = h('div', { class: 'ladder-list' });
      const detail = h('div', { class: 'ladder-detail' });
      let ch = S.chapterId();
      const chTabs = h('div', { class: 'tabs chapter-tabs' });
      if (S.d.ch2) m.body.appendChild(chTabs);
      m.body.appendChild(h('div', { class: 'ladder' }, list, detail));
      let sel = (S.nextBout(ch) || S.bouts(ch)[S.bouts(ch).length - 1]).id;
      let preview = null, raf = 0, last = performance.now();
      const loop = () => {
        const now = performance.now();
        if (preview) preview.frame(Math.min(0.05, (now - last) / 1000));
        last = now;
        raf = requestAnimationFrame(loop);
      };
      const oldClose = m.close;
      m.close = () => {
        cancelAnimationFrame(raf);
        oldClose();
      };
      m.wrap.querySelector('.btn-x').onclick = m.close;
      const draw = () => {
        chTabs.innerHTML = '';
        for (const c of P.CHAPTER_ORDER.filter((c) => S.chapterOpen(c))) {
          chTabs.appendChild(UI.button((c === 'ch2' ? 'Ch.2 · ' : 'Ch.1 · ') + P.tc('chapters', c, 'short', P.CHAPTERS[c].short), () => {
            ch = c;
            sel = (S.nextBout(ch) || S.bouts(ch)[S.bouts(ch).length - 1]).id;
            draw();
          }, c === ch ? 'tab on' : 'tab'));
        }
        list.innerHTML = '';
        S.bouts(ch).forEach((b, i) => {
          const st = S.boutStatus(b.id);
          const row = h('div', { class: 'ladder-row ' + st + (sel === b.id ? ' selected' : '') + (b.boss ? ' boss' : '') },
            h('div', { class: 'lr-num' }, b.boss ? '♛' : i + 1),
            h('div', { class: 'lr-text' }, h('div', { class: 'lr-title' }, (P.boutTitle(b).split('—')[1] || P.boutTitle(b)) + (b.team ? ` · ${b.size}v${b.size}` : '')), h('div', { class: 'lr-sub' }, S.boutFoe(b).name)),
            h('div', { class: 'lr-status' }, st === 'beaten' ? '✔' : st === 'next' ? '★' : '🔒'));
          row.addEventListener('click', () => {
            sel = b.id;
            P.SFX.play('ui');
            draw();
          });
          list.appendChild(row);
        });
        const b = S.bouts(ch).find((x) => x.id === sel);
        const st = S.boutStatus(b.id);
        const rematch = st === 'beaten';
        if (b.team) {
          detail.innerHTML = '';
          const r = this.teamDetail(b, st, m, draw);
          detail.append(...r.nodes.filter(Boolean));
          preview = r.preview;
          return;
        }
        const e = P.ENEMIES[b.enemy];
        const eb = S.boutBuild(b, rematch);
        const est = P.Stats.compute(eb);
        const fee = S.entryFee(b);
        detail.innerHTML = '';
        const cv = h('canvas', { class: 'scout-canvas', width: 90, height: 72 });
        const types = [...new Set(est.weapons.map((w) => P.dmgName(w.type)))];
        const parts = h('div', { class: 'scout-parts' });
        for (const k of P.slotsFor(eb.parts.chassis.id)) {
          const it = eb.parts[k];
          if (!it) continue;
          const card = UI.itemCard(it, { sub: P.slotLabel(k) });
          parts.appendChild(card);
        }
        const mine = S.stats(null, 0);
        const eq0 = S.mechRec(0).equip;
        const warn = [];
        if (S.d.mechs.length > 1) warn.push(P.t('Scrap Pit bouts are one-on-one: you fly mech #1 ({name}).', { name: S.mechRec(0).name }));
        if (!mine.weapons.length) warn.push(P.t('Your mech has NO weapons. It will have to headbutt things.'));
        if (!eq0.legs) warn.push(P.t('Your mech has no legs. It will be immobile and easy to hit.'));
        if (mine.overweight > 0) warn.push(P.t('Your mech is {p}% overweight — slow and easy to hit.', { p: Math.round(mine.overweight * 100) }));
        if (!eq0.head) warn.push(P.t('No head: accuracy is terrible.'));
        if (mine.hpNow < mine.hpTotal) warn.push(P.t('Your mech is still damaged: it starts at {hp} HP. Repair bill: {bill}.', { hp: U.pct(mine.hpNow / mine.hpTotal), bill: U.fmtMoney(S.repairBill(true)) }));
        if (fee > S.d.money) warn.push(P.t("You can't cover the {fee} entry fee. Marge will put it on her tab.", { fee: U.fmtMoney(fee) }));
        const nodes = [
          h('div', { class: 'scout-top' },
            cv,
            h('div', { class: 'scout-info' },
              h('div', { class: 'scout-bout' }, P.boutTitle(b)),
              h('div', { class: 'scout-pilot' }, e.pilot, h('span', null, ' · ' + P.tc('enemies', b.enemy, 'title', e.title))),
              h('div', { class: 'scout-mech' }, '“' + P.tc('enemies', b.enemy, 'mech', e.mech) + '”'),
              h('div', { class: 'scout-quote' }, P.tc('enemies', b.enemy, 'quote', e.quote)),
              h('div', { class: 'scout-meta' },
                h('span', null, `${P.t('HP')} ${est.hpTotal}`), h('span', null, `${P.t('Armor')} ${est.armor}`), h('span', null, `${P.t('Eva')} ${Math.round(est.eva)}`),
                h('span', null, `${P.t('Speed')} ${est.speed.toFixed(2)}`), h('span', null, P.t('Aims: {t}', { t: P.targetName(est.targeting) })), h('span', null, P.t('Damage: {list}', { list: types.join(', ') || P.t('none') }))),
            )),
          h('div', { class: 'list-head' }, P.t('Scouting report'), S.boutTier(b, rematch) > b.tier ? h('span', { class: 'dim' }, P.t('free play: one tier tougher')) : null),
          parts,
          this.oddsBox(b, rematch, eb),
          warn.length ? h('div', { class: 'warn' }, warn.map((w) => h('div', null, '⚠ ' + w)), mine.hpNow < mine.hpTotal && S.d.money > 0 ? UI.button(P.t('Repair now'), () => {
            S.repairMany(S.damaged(true));
            P.SFX.play('clank');
            this.refresh();
            draw();
          }, 'small') : null) : null,
          h('div', { class: 'row end fight-row' },
            h('div', { class: 'reward' },
              (() => {
                const purse = rematch ? Math.round(b.reward * 0.5) : b.reward;
                const bonus = Math.round(purse * S.fx('purse'));
                return (rematch ? P.t('Rematch purse: {v}', { v: U.fmtMoney(purse) }) : P.t('Purse: {v}', { v: U.fmtMoney(purse) })) + (bonus ? P.t(' (+{v} sponsors)', { v: U.fmtMoney(bonus) }) : '') + P.t(' + salvage + crate');
              })(),
              h('div', { class: 'dim fee-line' }, P.t('Entry fee {fee} · a loss pays {hz} hazard pay', { fee: fee ? U.fmtMoney(fee) : P.t('free'), hz: U.fmtMoney(S.hazardPay(b)) }))),
            UI.button(st === 'beaten' ? P.t('Rematch') : P.t('FIGHT!'), () => {
              m.close();
              P.Game.go(P.Scenes.battle, { bout: b, rematch: st === 'beaten' });
            }, 'primary big', st === 'locked' ? { disabled: true } : null)),
        ];
        detail.append(...nodes.filter(Boolean));
        preview = new P.MechPreview(cv, eb, { facing: -1 });
      };
      draw();
      loop();
    },

    // Scouting Office: win chance over 40 simulated bouts with your current build (damage included).
    oddsBox(bout, rematch, eb, A) {
      if (!S.fx('odds')) return h('div', { class: 'odds-box locked dim' }, '🔭 ' + P.t("Build a Scouting Office and the bookie will tell you your odds."));
      A = A || S.build(null, 0);
      if (Array.isArray(A) && !A.length) return null;
      const key = JSON.stringify([A, eb]);
      this.oddsCache = this.oddsCache || {};
      const box = h('div', { class: 'odds-box' });
      const show = (p) => {
        box.innerHTML = '';
        const col = p >= 0.65 ? 'var(--good)' : p >= 0.35 ? '#ffd76a' : 'var(--bad)';
        box.append(h('span', null, '🔭 ' + P.t("Bookie's odds:") + ' '), h('b', { style: { color: col } }, P.t('{p} to win', { p: U.pct(p) })), h('span', { class: 'dim' }, ' · ' + P.t('40 simulated bouts with your current build')));
      };
      if (this.oddsCache[key] != null) {
        show(this.oddsCache[key]);
        return box;
      }
      box.append(h('span', { class: 'dim' }, '🔭 ' + P.t('The bookie is crunching numbers…')));
      let i = 0, wins = 0;
      const N = 40;
      const step = () => {
        if (!document.body.contains(box)) return;
        const end = Math.min(N, i + 5);
        for (; i < end; i++) if (P.Sim.run({ seed: 777 + i * 131, A, B: eb }).winner === 'A') wins++;
        if (i < N) setTimeout(step, 0);
        else {
          this.oddsCache[key] = wins / N;
          show(wins / N);
        }
      };
      setTimeout(step, 30);
      return box;
    },

    // Team bout detail: the opposing team, your lineup (point / wing / rear), odds and money.
    teamDetail(b, st, modal, redraw) {
      const rematch = st === 'beaten';
      const foe = S.boutFoe(b);
      const team = S.boutTeam(b, rematch);
      const POS = [P.t('Point'), P.t('Wing'), P.t('Rear')];
      const AIM = { nearest: P.t('nearest mech'), focus: P.t("its captain's target"), weakest: P.t('the most damaged mech'), lead: P.t('your point mech') };
      const cv = h('canvas', { class: 'scout-canvas', width: 90, height: 72 });
      const units = team.map((eb, i) => {
        const u = P.TEAMS[b.team].units[i];
        const est = P.Stats.compute(eb);
        const chips = P.slotsFor(eb.parts.chassis.id).filter((k) => eb.parts[k]).map((k) => {
          const it = eb.parts[k];
          return UI.attachTip(h('span', { class: 'part-chip', style: { '--rar': UI.rarColor(it) } }, h('img', { src: P.Pixel.icon(it.id, eb.paint) }), P.itemName(it)), () => UI.itemTipHtml(it, `<div class="tip-line dim">${P.slotLabel(k)}</div>`));
        });
        return h('div', { class: 'unit-card' },
          h('div', { class: 'unit-head' }, h('b', null, POS[i] + ': '), eb.pilot, h('span', { class: 'dim' }, ` · “${P.tc('enemies', u.enemy, 'mech', eb.name)}” · ${P.t('HP')} ${est.hpTotal} · ${P.t('goes after')} ${AIM[eb.unitTarget || 'nearest']}`)),
          h('div', { class: 'unit-parts' }, chips));
      });
      // your lineup
      const lineup = S.lineupFor(b);
      const ready = S.d.mechs.map((_, i) => i).filter((i) => S.mechReady(i));
      const lineRows = [];
      for (let pos = 0; pos < b.size; pos++) {
        const sel = h('select', null, h('option', { value: '' }, P.t('— empty —')), ready.map((mi) => h('option', { value: mi, selected: lineup[pos] === mi }, `#${mi + 1} ${S.mechRec(mi).name} (${S.pilotName(mi)})`)));
        sel.addEventListener('change', () => {
          const cur = lineup.slice();
          const v = sel.value === '' ? null : Number(sel.value);
          const other = cur.indexOf(v);
          if (v != null && other >= 0) cur[other] = cur[pos];
          cur[pos] = v;
          S.setLineup(cur.filter((x) => x != null).concat(S.d.mechs.map((_, i) => i).filter((i) => !cur.includes(i))));
          redraw();
        });
        const mi = lineup[pos];
        const stt = mi != null ? S.stats(null, mi) : null;
        lineRows.push(h('div', { class: 'lineup-row' }, h('b', null, POS[pos]), sel,
          stt ? h('span', { class: stt.hpNow < stt.hpTotal ? 'bad' : 'dim' }, `HP ${stt.hpNow}/${stt.hpTotal} · DPS ${stt.dps.toFixed(1)}`) : h('span', { class: 'bad' }, P.t('nobody here'))));
      }
      const warn = [];
      const unpiloted = S.d.mechs.filter((m, i) => !S.mechReady(i)).length;
      if (lineup.length < b.size) warn.push(P.t('Only {n} of {size} mechs are ready: you will fight short-handed.', { n: lineup.length, size: b.size }) + (unpiloted ? ' ' + P.t('Hire pilots in the Team Office.') : ''));
      const dmgd = lineup.filter((mi) => {
        const s2 = S.stats(null, mi);
        return s2.hpNow < s2.hpTotal;
      });
      if (dmgd.length) warn.push(P.t('{n} of your mechs are still damaged. Repair bill: {bill}.', { n: dmgd.length, bill: U.fmtMoney(S.repairBill(true)) }));
      const fee = S.entryFee(b), wages = S.wages(lineup);
      if (fee + wages > S.d.money) warn.push(P.t("You can't cover the {fee} entry fee. Marge will put it on her tab.", { fee: U.fmtMoney(fee + wages) }));
      const purse = rematch ? Math.round(b.reward * 0.5) : b.reward;
      const extra = Math.round(purse * S.fx('purse')) + S.gate(b, true);
      const nodes = [
        h('div', { class: 'scout-top' }, cv,
          h('div', { class: 'scout-info' },
            h('div', { class: 'scout-bout' }, P.boutTitle(b) + ` · ${b.size}v${b.size}`),
            h('div', { class: 'scout-pilot' }, foe.name),
            h('div', { class: 'scout-quote' }, foe.quote))),
        h('div', { class: 'list-head' }, P.t('Opposing team'), S.boutTier(b, rematch) > b.tier ? h('span', { class: 'dim' }, P.t('free play: one tier tougher')) : null),
        h('div', { class: 'unit-list' }, units),
        h('div', { class: 'list-head' }, P.t('Your lineup'), h('span', { class: 'dim' }, P.t('enemies usually go after the nearest mech: put your toughest on point'))),
        h('div', { class: 'lineup' }, lineRows),
        lineup.length ? this.oddsBox(b, rematch, team, lineup.map((mi) => S.build(null, mi))) : null,
        warn.length ? h('div', { class: 'warn' }, warn.map((w) => h('div', null, '⚠ ' + w)), dmgd.length && S.d.money > 0 ? UI.button(P.t('Repair now'), () => {
          S.repairMany(S.damaged(true));
          P.SFX.play('clank');
          this.refresh();
          redraw();
        }, 'small') : null) : null,
        h('div', { class: 'row end fight-row' },
          h('div', { class: 'reward' },
            (rematch ? P.t('Rematch purse: {v}', { v: U.fmtMoney(purse) }) : P.t('Purse: {v}', { v: U.fmtMoney(purse) })) + (extra ? P.t(' + about {v} gate & bonus', { v: U.fmtMoney(extra) }) : '') + (S.d.sponsors.length ? P.t(' + {n} sponsor(s)', { n: S.d.sponsors.length }) : ''),
            h('div', { class: 'dim fee-line' }, P.t('Entry fee {fee} · pilot wages {w} · a loss pays {hz}', { fee: U.fmtMoney(fee), w: U.fmtMoney(wages), hz: U.fmtMoney(S.hazardPay(b)) }))),
          UI.button(rematch ? P.t('Rematch') : P.t('FIGHT!'), () => {
            modal.close();
            P.Game.go(P.Scenes.battle, { bout: b, rematch, lineup });
          }, 'primary big', st === 'locked' || !lineup.length ? { disabled: true } : null)),
      ];
      return { nodes, preview: new P.MechPreview(cv, team[0], { facing: -1 }) };
    },

    // =====================================================================================
    // SWAP MEET
    // =====================================================================================
    openShop() {
      const m = UI.modal(P.t("Fiona's Swap Meet"), { cls: 'wide' });
      let tab = 'buy';
      const head = h('div', { class: 'modal-sub' });
      const tabs = h('div', { class: 'tabs' });
      const list = h('div', { class: 'item-grid' });
      m.body.append(head, tabs, list);
      const draw = () => {
        head.innerHTML = '';
        head.append(h('span', { class: 'npc' }, 'Fiona: ', h('i', null, tab === 'sell' ? P.t('"I\'ll give you forty cents on the dollar. Fifty if it\'s haunted. Okay, still forty."') : tab === 'junk' ? P.t('"Free junk! Terrible junk. But free!"') : P.t('"Fresh stock every day. Most of it isn\'t stolen."'))), UI.moneyChip());
        tabs.innerHTML = '';
        for (const [k, label] of [['buy', P.t('Buy')], ['sell', P.t('Sell')], ['junk', P.t('Free Junk Bin')]]) tabs.appendChild(UI.button(label, () => { tab = k; draw(); }, tab === k ? 'tab on' : 'tab'));
        list.innerHTML = '';
        if (tab === 'buy') {
          for (const it of S.ensureShop()) {
            const price = P.Loot.price(it);
            const can = !it.sold && S.d.money >= price;
            list.appendChild(UI.itemCard(it, {
              cls: it.sold ? 'sold' : '',
              right: it.sold ? h('span', { class: 'badge-other' }, P.t('SOLD')) : UI.button(U.fmtMoney(price), () => {
                if (!can) return P.SFX.play('ui_bad');
                S.d.money -= price;
                it.sold = true;
                S.addItem({ id: it.id, lvl: it.lvl, mod: it.mod });
                S.save();
                P.SFX.play('coin');
                UI.toast(P.t('Bought {name}', { name: P.itemName(it) }), 'good');
                draw();
                this.refresh();
              }, can ? 'small primary' : 'small', can ? null : { disabled: true }),
            }));
          }
          list.appendChild(h('div', { class: 'empty-note' }, P.t('Stock refreshes after every bout.')));
        } else if (tab === 'sell') {
          list.appendChild(h('div', { class: 'grid-span' }, UI.sortBar(draw)));
          const items = UI.sortItems(S.d.inventory.filter((i) => !S.inUse(i.uid)));
          if (!items.length) list.appendChild(h('div', { class: 'empty-note' }, P.t('Nothing to sell — everything you own is bolted onto your mech.')));
          for (const it of items) {
            const price = P.Loot.sellPrice(it);
            list.appendChild(UI.itemCard(it, {
              right: UI.button(price ? P.t('Sell {v}', { v: U.fmtMoney(price) }) : P.t('Toss'), async () => {
                const def = P.PARTS[it.id];
                if (P.RARITY_ORDER.indexOf(def.rarity) >= 2 && !(await UI.confirm(P.t('Sell {name} for {v}?', { name: P.itemName(it), v: U.fmtMoney(price) }), P.t('Sell')))) return;
                S.removeItem(it.uid);
                S.d.money += price;
                S.save();
                P.SFX.play('coin');
                draw();
                this.refresh();
              }, 'small'),
            }));
          }
        } else {
          for (const id of P.Loot.JUNK_BIN) {
            const it = { id, lvl: 0, mod: null, free: true };
            list.appendChild(UI.itemCard(it, {
              right: UI.button(P.t('Take'), () => {
                S.addItem(it);
                S.save();
                P.SFX.play('clank');
                UI.toast(P.t('Took {name} from the Junk Bin', { name: P.partName(id) }));
                this.refresh();
              }, 'small'),
            }));
          }
          list.appendChild(h('div', { class: 'empty-note' }, P.t('Junk Bin parts are free but worthless to sell or salvage. Use them to patch holes after a rough bout.')));
        }
      };
      draw();
    },

    // =====================================================================================
    // WORK A SHIFT (scavenging)
    // =====================================================================================
    openShift() {
      if (!S.canShift()) {
        UI.dialog(P.tLines('dialogue', 'noShift', P.DIALOGUE.noShift));
        return;
      }
      const m = UI.modal(P.t('Work a Shift — Day {d}', { d: S.d.day }), { cls: 'wide' });
      m.body.appendChild(h('div', { class: 'modal-sub' }, h('span', { class: 'npc' }, 'Marge: ', h('i', null, P.t('"Sort one pile. You get paid $25, plus whatever you can sneak into your pockets. Luck helps."')))));
      const piles = h('div', { class: 'pile-row' });
      m.body.appendChild(piles);
      const luck = S.luck();
      for (const pile of P.Loot.pilesForDay(S.d.day)) {
        const card = h('div', { class: 'pile-card' + (pile.mystery ? ' mystery' : '') },
          h('div', { class: 'pile-icon' }, pile.icon), h('div', { class: 'pile-name' }, P.tc('piles', pile.id, 'name', pile.name)), h('div', { class: 'pile-desc' }, P.tc('piles', pile.id, 'desc', pile.desc)));
        card.addEventListener('click', () => {
          P.SFX.play('whoosh');
          const { res, got, bp } = S.workShift(pile);
          piles.innerHTML = '';
          piles.appendChild(h('div', { class: 'shift-result' },
            h('div', { class: 'big-money' }, P.t('+{v} wages', { v: U.fmtMoney(res.wage) })),
            res.notes.map((n) => h('div', { class: 'note' }, n)),
            h('div', { class: 'loot-reveal' }, got.map((it, i) => {
              const c = UI.itemCard(it, { cls: 'reveal' });
              c.style.animationDelay = i * 0.25 + 's';
              return c;
            }), bp ? UI.blueprintCard(bp, P.t('tucked under the junk')) : null),
            UI.button(P.t('Back to the garage'), () => m.close(), 'primary')));
          P.SFX.play(got.length ? 'loot' : 'coin');
          this.refresh();
        });
        piles.appendChild(card);
      }
    },

    // =====================================================================================
    // REPLAYS
    // =====================================================================================
    openReplays() {
      const m = UI.modal(P.t('Replay Archive'), { cls: 'wide' });
      const list = h('div', { class: 'replay-list' });
      m.body.append(h('div', { class: 'modal-sub' }, h('span', { class: 'npc' }, P.t('Every bout is saved as a tiny deterministic replay (seed + both builds). Export to share; import to watch.')),
        UI.button(P.t('Import replay file…'), async () => {
          const txt = await U.pickFile('.json,.ptpreplay,application/json');
          if (!txt) return;
          let rep;
          try {
            rep = JSON.parse(txt);
          } catch (e) {
            return UI.toast(P.t('That file is not valid JSON.'), 'bad');
          }
          const err = S.validateReplay(rep);
          if (err) return UI.toast(err, 'bad');
          m.close();
          P.Game.go(P.Scenes.battle, { replay: rep, returnTo: 'hub' });
        }, 'small')), list);
      const draw = () => {
        list.innerHTML = '';
        const reps = S.replays();
        if (!reps.length) list.appendChild(h('div', { class: 'empty-note' }, P.t('No replays yet. Go break something.')));
        for (const r of reps) {
          const won = r.result.winner === 'A';
          list.appendChild(h('div', { class: 'replay-row' },
            h('div', { class: 'rr-res ' + (won ? 'win' : 'loss') }, won ? P.t('WIN') : P.t('LOSS')),
            h('div', { class: 'rr-text' }, h('div', null, `${S.replaySideName(r.A)} vs ${S.replaySideName(r.B)}`), h('div', { class: 'dim' }, P.t('{title} · {how} at {time} · {date}', { title: r.boutId && S.boutById(r.boutId) ? P.boutTitle(S.boutById(r.boutId)) : r.title, how: r.result.reason === 'ko' ? P.t('K.O.') : P.t('Decision'), time: U.fmtTime(r.result.duration), date: new Date(r.date).toLocaleString(P.I18N.lang === 'vi' ? 'vi-VN' : undefined) }))),
            UI.button('▶ ' + P.t('Watch'), () => {
              m.close();
              P.Game.go(P.Scenes.battle, { replay: r, returnTo: 'hub' });
            }, 'small primary'),
            UI.button(P.t('Export'), () => U.download(`ptp-replay-${r.id}.json`, JSON.stringify(r, null, 1)), 'small'),
            UI.button('✕', () => {
              S.deleteReplay(r.id);
              draw();
            }, 'small ghost')));
        }
      };
      draw();
    },

    // =====================================================================================
    // MENU
    // =====================================================================================
    openMenu() {
      const m = UI.modal(P.t('Menu'), { cls: 'small' });
      const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S.settings.sfx });
      vol.addEventListener('input', () => {
        S.settings.sfx = Number(vol.value);
        P.SFX.setVolume(S.settings.sfx);
        S.saveSettings();
      });
      vol.addEventListener('change', () => P.SFX.play('ui_ok'));
      const mus = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S.settings.music });
      mus.addEventListener('input', () => {
        S.settings.music = Number(mus.value);
        P.Music.setVolume(S.settings.music);
        S.saveSettings();
      });
      const shake = h('input', { type: 'checkbox' });
      shake.checked = S.settings.shake !== false;
      shake.addEventListener('change', () => {
        S.settings.shake = shake.checked;
        S.saveSettings();
      });
      const spd = h('select', null, [1, 2, 4].map((v) => h('option', { value: v, selected: S.settings.speed === v }, v + 'x')));
      spd.addEventListener('change', () => {
        S.settings.speed = Number(spd.value);
        S.saveSettings();
      });
      const lang = h('select', null, P.I18N.langs.map((l) => h('option', { value: l.id, selected: P.I18N.lang === l.id }, l.name)));
      lang.addEventListener('change', () => {
        S.settings.lang = lang.value;
        P.I18N.set(lang.value);
        S.saveSettings();
        m.close();
        P.Game.refit();
        P.Game.go(P.Scenes.hub);
      });
      const st = S.d.stats;
      m.body.append(
        h('div', { class: 'form-row' }, h('label', null, P.t('Language')), lang),
        h('div', { class: 'form-row' }, h('label', null, P.t('Music volume (M to mute)')), mus),
        h('div', { class: 'form-row' }, h('label', null, P.t('Sound effects volume')), vol),
        h('div', { class: 'form-row' }, h('label', null, P.t('Screen shake')), shake),
        h('div', { class: 'form-row' }, h('label', null, P.t('Default battle speed')), spd),
        h('div', { class: 'career' }, P.t('Career: {w}W / {l}L · {d} damage dealt · {p} parts lost · {m} earned', { w: st.wins, l: st.losses, d: st.dmgDealt, p: st.partsLost, m: U.fmtMoney(st.moneyEarned) }), h('br'), P.t('Spent: {r} on repairs · {f} on entry fees · {c} on facilities', { r: U.fmtMoney(st.repairsPaid || 0), f: U.fmtMoney(st.feesPaid || 0), c: U.fmtMoney(st.facilitySpend || 0) })),
        h('div', { class: 'row' },
          UI.button(P.t('Save & return to title'), () => {
            S.save();
            m.close();
            P.Game.go(P.Scenes.title);
          }),
          UI.button(P.t('Delete save…'), async () => {
            if (await UI.confirm(P.t('Delete your save and start over? This cannot be undone.'), P.t('Delete'))) {
              S.deleteSave();
              m.close();
              P.Game.go(P.Scenes.title);
            }
          }, 'ghost')),
        h('div', { class: 'dim small-print' }, P.t('Progress autosaves after every change. Keys in battle: Space pause · 1/2/3 speed · S skip.')),
      );
    },
  };

  function R() {
    return P.R;
  }
  P.Scenes.hub = Hub;
})();
