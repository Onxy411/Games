// Part-Time Pilot — DOM UI helpers: dialog boxes, tooltips, toasts, modals, item cards.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const h = U.h;
  const UI = (P.UI = {});

  UI.init = function () {
    UI.root = document.getElementById('ui');
    UI.tip = document.getElementById('tooltip');
    UI.stage = document.getElementById('stage');
    UI.overlay = h('div', { class: 'overlay-layer' });
    document.getElementById('stage').appendChild(UI.overlay);
    UI.stage.addEventListener('mousemove', (e) => {
      UI.mouse = { x: e.clientX, y: e.clientY };
      if (!UI.tip.classList.contains('hidden')) UI.placeTip();
    });
  };
  UI.clear = function () {
    UI.root.innerHTML = '';
    UI.hideTip();
  };

  UI.button = (label, onClick, cls, attrs) =>
    h('button', Object.assign({ class: 'btn ' + (cls || ''), onclick: (e) => {
      P.SFX.play('ui');
      onClick && onClick(e);
    } }, attrs || {}), label);

  // ---------- toast ----------
  UI.toast = function (msg, kind) {
    let wrap = UI.stage.querySelector('.toasts');
    if (!wrap) {
      wrap = h('div', { class: 'toasts' });
      UI.stage.appendChild(wrap);
    }
    const t = h('div', { class: 'toast ' + (kind || '') }, msg);
    wrap.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
  };

  // ---------- tooltip ----------
  UI.showTip = function (html) {
    UI.tip.innerHTML = html;
    UI.tip.classList.remove('hidden');
    UI.placeTip();
  };
  UI.hideTip = function () {
    if (UI.tip) UI.tip.classList.add('hidden');
  };
  UI.placeTip = function () {
    if (!UI.mouse) return;
    const sr = UI.stage.getBoundingClientRect();
    const tr = UI.tip.getBoundingClientRect();
    let x = UI.mouse.x - sr.left + 16, y = UI.mouse.y - sr.top + 12;
    if (x + tr.width > sr.width - 8) x = UI.mouse.x - sr.left - tr.width - 16;
    if (y + tr.height > sr.height - 8) y = sr.height - tr.height - 8;
    UI.tip.style.left = Math.max(4, x) + 'px';
    UI.tip.style.top = Math.max(4, y) + 'px';
  };
  UI.attachTip = function (el, htmlFn) {
    el.addEventListener('mouseenter', (e) => {
      UI.mouse = { x: e.clientX, y: e.clientY };
      UI.tipOwner = el;
      UI.showTip(typeof htmlFn === 'function' ? htmlFn() : htmlFn);
    });
    el.addEventListener('mouseleave', UI.hideTip);
    return el;
  };
  // hide tooltips whose owner element got removed from the page (list re-renders)
  setInterval(() => {
    if (UI.tipOwner && !document.body.contains(UI.tipOwner)) {
      UI.tipOwner = null;
      UI.hideTip();
    }
  }, 250);

  // ---------- item rendering ----------
  UI.rarColor = (item) => P.RARITY[P.PARTS[item.id].rarity].color;
  // Cash chip; negative cash is Marge's tab (entry fees she fronted you).
  UI.moneyChip = function (label) {
    const m = P.State.d.money;
    const el = h('span', { class: 'chip money' + (m < 0 ? ' debt' : '') }, label ? label + ' ' : '', h('b', null, m < 0 ? P.t("Marge's tab {v}", { v: U.fmtMoney(-m) }) : U.fmtMoney(m)));
    if (m < 0) UI.attachTip(el, P.t("You owe Marge for entry fees she covered. You can't buy anything until a purse or a shift pays her back."));
    return el;
  };
  UI.wearLine = function (item) {
    const w = item.wear || 0;
    if (w <= 0.001) return '';
    const cost = P.State.d ? P.State.repairCost(item) : 0;
    return `<div class="tip-line bad">${P.t('Damaged: starts the next bout at {hp} HP', { hp: U.pct(1 - w) })} · ${cost ? P.t('repair {cost}', { cost: U.fmtMoney(cost) }) : P.t('free patch')}</div>`;
  };
  UI.itemTipHtml = function (item, extra) {
    const def = P.PARTS[item.id];
    if (!def) return '';
    const rar = P.RARITY[def.rarity];
    const mod = item.mod ? P.MODS[item.mod] : null;
    const tags = (def.tags || []).map((t) => {
      const s = P.SYNERGIES[t];
      return s ? `<span class="tag" style="color:${s.color}">${P.synName(t)}</span>` : '';
    }).join(' ');
    const stats = P.Stats.itemSummary(item).split(' · ').map((s) => `<span>${s}</span>`).join('');
    let special = '';
    if (def.head) special += `<div class="tip-line">${P.t('Targeting:')} ${P.targetingDesc(def.head.target)}</div>`;
    if (def.legs) special += `<div class="tip-line dim">${def.legs.limbs > 1 ? P.t('{n} legs — losing them hurts balance.', { n: def.legs.limbs }) : P.t('Single unit.')}${def.legs.stable ? ' ' + P.t('Never trips.') : ''}</div>`;
    if (def.cat === 'legs') special += `<div class="tip-line dim">${P.t('*Legs carry the weight; their own weight does not count.')}</div>`;
    return `<div class="tip-name" style="color:${rar.color}">${P.itemName(item)}</div>
      <div class="tip-sub">${P.t('{rarity} {cat}', { rarity: P.rarName(def.rarity), cat: P.catName(def.cat) })}${item.lvl ? ' · ' + P.t('Tinkered +{n}', { n: item.lvl }) : ''}${item.free ? ' · ' + P.t('Junk Bin') : ''}</div>
      ${tags ? `<div class="tip-tags">${tags}</div>` : ''}
      <div class="tip-stats">${stats}</div>
      ${special}
      ${mod ? `<div class="tip-mod">✦ ${P.modName(item.mod)}: ${P.modDesc(item.mod)}</div>` : ''}
      ${UI.wearLine(item)}
      <div class="tip-desc">${P.partDesc(item.id)}</div>
      ${extra || ''}`;
  };

  UI.itemCard = function (item, opts) {
    opts = opts || {};
    const def = P.PARTS[item.id];
    const paint = (P.State.d && P.State.d.paint) || 'rust';
    const el = h('div', { class: 'item-card ' + (opts.cls || '') + (item.isNew ? ' is-new' : ''), style: { '--rar': UI.rarColor(item) } },
      h('img', { class: 'item-icon', src: P.Pixel.icon(item.id, paint), alt: '' }),
      h('div', { class: 'item-text' },
        h('div', { class: 'item-name' }, P.itemName(item)),
        h('div', { class: 'item-sub' }, opts.sub != null ? opts.sub : `${P.catName(def.cat)} · ${P.Stats.itemSummary(item).split(' · ').slice(0, 3).join(' · ')}`)),
      opts.right ? h('div', { class: 'item-right' }, opts.right) : null,
      (item.wear || 0) > 0.001 ? h('div', { class: 'wear-bar', title: P.t('{hp} HP', { hp: U.pct(1 - item.wear) }) }, h('i', { style: { width: (1 - item.wear) * 100 + '%' } })) : null,
    );
    if (opts.onClick) {
      el.classList.add('clickable');
      el.addEventListener('click', (e) => {
        P.SFX.play('ui');
        opts.onClick(e);
      });
    }
    UI.attachTip(el, () => UI.itemTipHtml(item, opts.tipExtra ? opts.tipExtra() : ''));
    if (opts.onHover) {
      el.addEventListener('mouseenter', () => opts.onHover(true));
      el.addEventListener('mouseleave', () => opts.onHover(false));
    }
    return el;
  };

  // Blueprint "card" for reward screens
  UI.blueprintCard = function (id, sub) {
    const def = P.PARTS[id];
    const el = h('div', { class: 'bp-card reveal' },
      h('img', { class: 'item-icon', src: P.Pixel.icon(id, (P.State.d && P.State.d.paint) || 'rust') }),
      h('div', { class: 'item-text' },
        h('div', { class: 'bp-kicker' }, P.t('BLUEPRINT DISCOVERED') + (sub ? ' · ' + sub : '')),
        h('div', { class: 'item-name' }, P.partName(id)),
        h('div', { class: 'item-sub' }, P.t('Prototype {cat} — craft it at the Workbench', { cat: P.catName(def.cat) }))));
    UI.attachTip(el, () => UI.itemTipHtml({ id, lvl: 0, mod: null }));
    return el;
  };

  // Shared sorting for part lists
  UI.SORTS = {
    rarity: { label: 'Rarity', fn: (a, b) => P.RARITY_ORDER.indexOf(P.PARTS[b.id].rarity) - P.RARITY_ORDER.indexOf(P.PARTS[a.id].rarity) || (b.lvl || 0) - (a.lvl || 0) },
    value: { label: 'Value', fn: (a, b) => P.Loot.price(b) - P.Loot.price(a) },
    type: { label: 'Type', fn: (a, b) => ['chassis', 'head', 'legs', 'arm', 'mount', 'module'].indexOf(P.PARTS[a.id].cat) - ['chassis', 'head', 'legs', 'arm', 'mount', 'module'].indexOf(P.PARTS[b.id].cat) || P.partName(a.id).localeCompare(P.partName(b.id)) },
    newest: { label: 'Newest', fn: (a, b) => (b.uid || 0) - (a.uid || 0) },
    name: { label: 'A–Z', fn: (a, b) => P.partName(a.id).localeCompare(P.partName(b.id)) },
  };
  UI.sortItems = (list) => list.slice().sort((UI.SORTS[P.State.settings.sort] || UI.SORTS.rarity).fn);
  UI.sortSelect = function (onChange) {
    const sel = h('select', { class: 'sort-select', title: P.t('Sort parts') }, Object.keys(UI.SORTS).map((k) => h('option', { value: k, selected: P.State.settings.sort === k }, P.t('Sort:') + ' ' + P.t(UI.SORTS[k].label))));
    sel.addEventListener('change', () => {
      P.State.settings.sort = sel.value;
      P.State.saveSettings();
      onChange();
    });
    return sel;
  };
  UI.sortBar = function (onChange) {
    const bar = h('div', { class: 'sort-bar' }, h('span', { class: 'dim' }, P.t('Sort:')));
    for (const k in UI.SORTS) {
      bar.appendChild(UI.button(P.t(UI.SORTS[k].label), () => {
        P.State.settings.sort = k;
        P.State.saveSettings();
        onChange();
      }, 'tab' + (P.State.settings.sort === k ? ' on' : '')));
    }
    return bar;
  };

  // ---------- modal ----------
  UI.modal = function (title, opts) {
    opts = opts || {};
    UI.hideTip();
    const body = h('div', { class: 'modal-body' });
    const close = () => {
      wrap.remove();
      UI.hideTip();
      opts.onClose && opts.onClose();
    };
    const wrap = h('div', { class: 'modal-wrap' + (opts.cls ? ' ' + opts.cls : '') },
      h('div', { class: 'panel modal' },
        h('div', { class: 'modal-head' }, h('h2', { class: 'title' }, title), opts.noClose ? null : UI.button('✕', close, 'btn-x', { title: P.t('Close (Esc)') })),
        body));
    (opts.parent || UI.root).appendChild(wrap);
    const m = { wrap, body, close };
    UI.topModal = m;
    return m;
  };

  UI.confirm = function (text, yes, no) {
    return new Promise((resolve) => {
      const m = UI.modal(P.t('Hold on'), { parent: UI.overlay, noClose: true, cls: 'small' });
      m.body.appendChild(h('p', { class: 'confirm-text' }, text));
      m.body.appendChild(h('div', { class: 'row end' },
        UI.button(no || P.t('Cancel'), () => { m.close(); resolve(false); }),
        UI.button(yes || P.t('OK'), () => { m.close(); resolve(true); }, 'primary')));
    });
  };

  // ---------- dialog (story text) ----------
  UI.dialog = function (lines) {
    return new Promise((resolve) => {
      let i = 0, typing = null, full = '';
      const nameEl = h('div', { class: 'dlg-name' });
      const textEl = h('div', { class: 'dlg-text' });
      const hint = h('div', { class: 'dlg-hint' }, P.t('click ▸'));
      const box = h('div', { class: 'dialog' }, h('div', { class: 'dlg-box panel' }, nameEl, textEl, hint));
      UI.overlay.appendChild(box);
      const show = () => {
        const L = lines[i];
        nameEl.textContent = L.who;
        nameEl.className = 'dlg-name who-' + L.who.toLowerCase().replace(/[^a-z]/g, '');
        full = L.text;
        let n = 0;
        clearInterval(typing);
        textEl.textContent = '';
        typing = setInterval(() => {
          n += 2;
          textEl.textContent = full.slice(0, n);
          if (n % 6 === 0) P.SFX.play('ui', { gap: 60 });
          if (n >= full.length) {
            clearInterval(typing);
            typing = null;
          }
        }, 22);
      };
      const advance = (e) => {
        if (e && e.type === 'keydown' && !['Space', 'Enter', 'KeyZ', 'Escape'].includes(e.code)) return;
        if (e) e.preventDefault();
        if (typing) {
          clearInterval(typing);
          typing = null;
          textEl.textContent = full;
          return;
        }
        i++;
        if (i >= lines.length || (e && e.code === 'Escape')) {
          box.remove();
          window.removeEventListener('keydown', advance);
          resolve();
        } else show();
      };
      box.addEventListener('click', advance);
      window.addEventListener('keydown', advance);
      show();
    });
  };

  // number formatting helpers for stat panels
  UI.delta = function (v, base, fmt, invert) {
    const d = v - base;
    if (Math.abs(d) < 0.005) return '';
    const good = invert ? d < 0 : d > 0;
    return `<span class="delta ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmt ? fmt(d) : Math.round(d)}</span>`;
  };
})();
