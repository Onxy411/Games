// Part-Time Pilot — tiny translation layer (headless-safe, no DOM needed).
//
// UI strings use the English text itself as the key:   P.t('Repair all ({cost})', { cost: '$40' })
// Content that has an id (parts, mods, opponents, dialogue, announcer lines...) is looked up by id:
//   P.tc('parts', 'dumpster_frame', 'name', englishFallback)
// Language tables live in src/data/lang_*.js and register themselves in P.I18N.ui / P.I18N.content.
// Anything missing falls back to English, so a half-finished table never breaks the game.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});

  const I = (P.I18N = {
    lang: 'en',
    langs: [
      { id: 'en', name: 'English' },
      { id: 'vi', name: 'Tiếng Việt' },
    ],
    ui: {},
    content: {},
  });

  const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s);

  P.t = function (s, vars) {
    let out = s;
    if (I.lang !== 'en') {
      const tb = I.ui[I.lang];
      if (tb && tb[s] != null) out = tb[s];
    }
    return fill(out, vars);
  };

  // Localized content field. field = null returns the whole entry (e.g. a list of lines).
  P.tc = function (group, id, field, fallback) {
    if (I.lang === 'en') return fallback;
    const c = I.content[I.lang];
    const g = c && c[group];
    const e = g && g[id];
    if (e == null) return fallback;
    if (field == null) return e;
    return e[field] != null ? e[field] : fallback;
  };

  // Localized story lines: same shape as the English list ({who, text}); text is replaced by index.
  P.tLines = function (group, id, lines) {
    const tr = P.tc(group, id, null, null);
    if (!tr || !Array.isArray(tr)) return lines;
    return lines.map((L, i) => Object.assign({}, L, { text: tr[i] != null ? tr[i] : L.text }));
  };

  // ---- localized content getters (data is read lazily, so load order does not matter) ----
  P.partName = (id) => P.tc('parts', id, 'name', (P.PARTS[id] || {}).name || id);
  P.partDesc = (id) => P.tc('parts', id, 'desc', (P.PARTS[id] || {}).desc || '');
  P.modName = (id) => P.tc('mods', id, 'name', P.MODS[id].name);
  P.modDesc = (id) => P.tc('mods', id, 'desc', P.MODS[id].desc);
  P.catName = (cat) => P.tc('cats', cat, null, P.CATS[cat].name);
  P.rarName = (r) => P.tc('rarities', r, null, P.RARITY[r].name);
  P.dmgName = (t) => P.tc('dmgTypes', t, null, (P.DMG_TYPES[t] || { name: t }).name);
  P.paintName = (p) => P.tc('paints', p.id, null, p.name);
  P.synName = (id) => P.tc('synergies', id, 'name', P.SYNERGIES[id].name);
  P.synTierDesc = (id, i) => {
    const tr = P.tc('synergies', id, 'tiers', null);
    return (tr && tr[i]) || P.SYNERGIES[id].tiers[i].desc;
  };
  P.targetingDesc = (t) => P.tc('targeting', t, null, P.TARGETING[t]);
  P.targetName = (t) => P.tc('targetNames', t, null, t.charAt(0).toUpperCase() + t.slice(1));
  P.boutTitle = (b) => (b ? P.tc('bouts', b.id, null, b.title) : '');
  P.announcerLines = (key) => P.tc('announcer', key, null, P.ANNOUNCER[key]);
  P.enemyField = (id, field) => P.tc('enemies', id, field, P.ENEMIES[id][field]);
  // display name of a mech build: opponents' mech names are translated, player names are left alone
  P.mechLabel = (b) => {
    if (!b || I.lang === 'en') return b && b.name;
    for (const id in P.ENEMIES) if (P.ENEMIES[id].mech === b.name && P.ENEMIES[id].pilot === b.pilot) return P.enemyField(id, 'mech');
    return b.name;
  };

  // fonts with Vietnamese glyphs (Pixelify Sans / Silkscreen have none)
  P.canvasFont = () => (I.lang === 'vi' ? '"VT323", "Tiny5", monospace' : '"Pixelify Sans", "Silkscreen", monospace');

  I.set = function (lang) {
    I.lang = I.langs.some((l) => l.id === lang) ? lang : 'en';
    if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = I.lang;
  };
})();
