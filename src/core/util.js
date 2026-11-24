// Part-Time Pilot — core utilities (no DOM dependencies except the DOM helpers at the bottom)
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = (P.util = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInQuad = (t) => t * t;
  U.easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  U.sign = (v) => (v < 0 ? -1 : 1);

  // ---------- Seeded RNG (mulberry32). Used by the battle sim so replays are deterministic. ----------
  U.makeRng = function (seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    const r = function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.weighted = (items, wfn) => {
      let total = 0;
      for (const it of items) total += Math.max(0, wfn(it));
      if (total <= 0) return items[Math.floor(r() * items.length)];
      let x = r() * total;
      for (const it of items) {
        x -= Math.max(0, wfn(it));
        if (x <= 0) return it;
      }
      return items[items.length - 1];
    };
    return r;
  };
  U.newSeed = () => ((Math.random() * 0x7fffffff) ^ (Date.now() & 0x7fffffff)) >>> 0;
  // Non-deterministic helper RNG for loot/shop/cosmetics
  U.rng = U.makeRng(U.newSeed());

  U.hashStr = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // ---------- colors ----------
  const hexCache = {};
  U.hex2rgb = function (hex) {
    if (hexCache[hex]) return hexCache[hex];
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    hexCache[hex] = v;
    return v;
  };
  U.rgb2hex = function (r, g, b) {
    const c = (x) => U.clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  };
  // amt > 0 lightens toward white, amt < 0 darkens toward black
  U.shade = function (hex, amt) {
    const [r, g, b] = U.hex2rgb(hex);
    if (amt >= 0) return U.rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    const k = 1 + amt;
    return U.rgb2hex(r * k, g * k, b * k);
  };
  U.mix = function (h1, h2, t) {
    const a = U.hex2rgb(h1), b = U.hex2rgb(h2);
    return U.rgb2hex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t));
  };
  U.rgba = function (hex, a) {
    const [r, g, b] = U.hex2rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  U.fmtMoney = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  U.fmtTime = (s) => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  U.pct = (v) => Math.round(v * 100) + '%';
  U.deepCopy = (o) => JSON.parse(JSON.stringify(o));
  U.titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  // ---------- DOM helpers (guarded so the sim can be loaded headless in Node) ----------
  U.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(typeof kid === 'object' ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  U.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  U.pickFile = function (accept) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept || '.json,application/json';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return resolve(null);
        const rd = new FileReader();
        rd.onload = () => resolve(String(rd.result));
        rd.onerror = () => resolve(null);
        rd.readAsText(f);
      };
      inp.click();
    });
  };

  U.storage = {
    get(key) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
      } catch (e) {
        return null;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    },
  };
})();
