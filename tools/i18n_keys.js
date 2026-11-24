// Lists every UI string the game translates: the first argument of P.t('...') and T('...') calls,
// plus a few keys built at runtime. Used by the smoke test to check a language table is complete.
//   node tools/i18n_keys.js            -> prints the keys as JSON
//   node tools/i18n_keys.js vi         -> prints only the keys missing from the 'vi' table
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SRC = ['src/core', 'src/data', 'src/game', 'src/battle', 'src/render', 'src/audio', 'src/ui', 'src/scenes', 'src'];
// strings passed through P.t() by variable rather than literal
const RUNTIME = ['beaten', 'next', 'locked', 'Rarity', 'Value', 'Type', 'Newest', 'A–Z', '{name} up {p}%', '{name} down {p}%'];

function listKeys() {
  const keys = new Set(RUNTIME);
  const re = /(?:\bP\.t|\bt|\bT)\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
  for (const dir of SRC) {
    const abs = path.join(root, dir);
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith('.js') || f.startsWith('lang_')) continue;
      const src = fs.readFileSync(path.join(abs, f), 'utf8');
      let m;
      while ((m = re.exec(src))) {
        try {
          keys.add(Function('"use strict"; return ' + m[1])());
        } catch (e) {
          /* not a plain literal */
        }
      }
    }
  }
  // sponsor condition templates and chapter-2 data strings are routed through P.t at runtime
  const ctx = loadData();
  for (const c of Object.values(ctx.PTP.SPONSOR_CONDS)) keys.add(c.text);
  return [...keys].filter((k) => /[A-Za-z]/.test(k)).sort();
}

function loadData() {
  const vm = require('vm');
  const ctx = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Boolean, Infinity, NaN, isFinite, parseInt, parseFloat };
  ctx.window = ctx;
  ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  vm.createContext(ctx);
  for (const f of ['src/core/util.js', 'src/core/i18n.js', 'src/data/parts.js', 'src/data/parts_ext.js', 'src/data/campaign.js', 'src/data/facilities.js', 'src/data/chapter2.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

module.exports = { listKeys };
if (require.main === module) {
  const keys = listKeys();
  const lang = process.argv[2];
  if (!lang) console.log(JSON.stringify(keys, null, 1));
  else {
    const vm = require('vm');
    const ctx = loadData();
    vm.runInContext(fs.readFileSync(path.join(root, 'src/data/lang_' + lang + '.js'), 'utf8'), ctx);
    const tb = ctx.PTP.I18N.ui[lang] || {};
    const missing = keys.filter((k) => tb[k] == null);
    console.log(JSON.stringify(missing, null, 1));
    console.error(`${missing.length} of ${keys.length} keys missing for '${lang}'`);
  }
}
