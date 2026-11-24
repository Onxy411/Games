// Part-Time Pilot — compiles ASCII sprite templates into canvases (outline + auto-shading + paint recolor).
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const X = (P.Pixel = {});

  const FIXED = {
    M: '#a3abb5', m: '#6c7480', D: '#3c414c', K: '#17151d', R: '#a8552c', r: '#6b3420', O: '#e88a2a',
    Y: '#f0c040', y: '#a87e22', W: '#f2efe6', w: '#c8c5bc', L: '#ff4a3a', B: '#7b5637', b: '#4b3324',
    T: '#bdb7a0', C: '#dde5ec', A: '#e9bb4c', a: '#9b7123', E: '#5cba62', e: '#2f6e3a', U: '#3d71e0',
    u: '#25408a', V: '#8a4ad0', N: '#f07ab0', X: '#1d3a40', Z: '#d63b35', z: '#6e2420',
  };
  const OUTLINE = [16, 12, 20];
  const cache = new Map();

  X.palette = function (paint, def) {
    const fp = (def && def.fixedPaint) || {};
    const Pc = fp.P || paint.P;
    const Sc = fp.S || paint.S;
    const glow = (def && def.glow) || '#5ff3ff';
    return {
      P: Pc, p: U.shade(Pc, -0.3), Q: U.shade(Pc, 0.25), S: Sc, s: U.shade(Sc, -0.3),
      G: glow, g: U.shade(glow, -0.4),
    };
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Compile sprite `key` with palette; returns {canvas, flash, soot, dark, w, h, pivot, anchors, muzzle, glow}
  X.get = function (key, paint, def) {
    const spr = P.SPRITES[key];
    if (!spr) return null;
    paint = paint || P.PAINTS[0];
    const pal = X.palette(paint, def);
    const ck = key + '|' + pal.P + '|' + pal.S + '|' + pal.G;
    let c = cache.get(ck);
    if (c) return c;
    c = compile(spr, pal, key);
    cache.set(ck, c);
    return c;
  };

  function compile(spr, pal, key) {
    const rows = spr.rows;
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const W = w + 2, H = h + 2;
    const opaque = (x, y) => {
      if (y < 0 || y >= h || x < 0) return false;
      const ch = rows[y][x];
      return !!ch && ch !== '.' && ch !== ' ';
    };
    const cols = new Array(W * H).fill(null);
    let gx = 0, gy = 0, gn = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!opaque(x, y)) continue;
        const ch = rows[y][x];
        let base = pal[ch] || FIXED[ch] || '#ff00ff';
        let amt = 0;
        if (ch !== 'G' && ch !== 'g') {
          if (!opaque(x, y - 1)) amt += 0.16;
          else if (!opaque(x, y + 1)) amt -= 0.22;
          if (!opaque(x - 1, y)) amt += 0.05;
          if (!opaque(x + 1, y)) amt -= 0.06;
        } else {
          gx += x;
          gy += y;
          gn++;
        }
        cols[(y + 1) * W + (x + 1)] = U.hex2rgb(amt ? U.shade(base, amt) : base);
      }
    }
    // outline
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && cols[y * W + x] && cols[y * W + x] !== OUTLINE;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (cols[y * W + x]) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) cols[y * W + x] = OUTLINE;
      }
    }
    const canvas = makeCanvas(W, H);
    const flash = makeCanvas(W, H);
    const soot = makeCanvas(W, H);
    const dark = makeCanvas(W, H);
    const id = canvas.getContext('2d').createImageData(W, H);
    const fd = flash.getContext('2d').createImageData(W, H);
    const sd = soot.getContext('2d').createImageData(W, H);
    const dd = dark.getContext('2d').createImageData(W, H);
    const rng = U.makeRng(U.hashStr(key));
    for (let i = 0; i < W * H; i++) {
      const c = cols[i];
      if (!c) continue;
      const o = i * 4;
      id.data[o] = c[0];
      id.data[o + 1] = c[1];
      id.data[o + 2] = c[2];
      id.data[o + 3] = 255;
      dd.data[o] = c[0] * 0.58;
      dd.data[o + 1] = c[1] * 0.58;
      dd.data[o + 2] = c[2] * 0.66;
      dd.data[o + 3] = 255;
      fd.data[o] = 255;
      fd.data[o + 1] = 255;
      fd.data[o + 2] = 255;
      fd.data[o + 3] = 255;
      if (c !== OUTLINE) {
        const r = rng();
        if (r < 0.26) {
          sd.data[o] = 22;
          sd.data[o + 1] = 16;
          sd.data[o + 2] = 16;
          sd.data[o + 3] = 235;
        } else if (r < 0.34) {
          sd.data[o] = 60;
          sd.data[o + 1] = 40;
          sd.data[o + 2] = 30;
          sd.data[o + 3] = 200;
        }
      }
    }
    canvas.getContext('2d').putImageData(id, 0, 0);
    flash.getContext('2d').putImageData(fd, 0, 0);
    soot.getContext('2d').putImageData(sd, 0, 0);
    dark.getContext('2d').putImageData(dd, 0, 0);
    const pt = (p) => (p ? [p[0] + 1, p[1] + 1] : null);
    const anchors = {};
    if (spr.anchors) {
      for (const k in spr.anchors) {
        const a = spr.anchors[k];
        if (k === 'mounts') anchors.mounts = a.map((m) => [m[0] + 1, m[1] + 1, m[2]]);
        else if (k === 'screen') anchors.screen = [a[0] + 1, a[1] + 1, a[2], a[3]];
        else anchors[k] = pt(a);
      }
    }
    return {
      canvas, flash, soot, dark, w: W, h: H,
      pivot: pt(spr.pivot || [Math.floor(w / 2), h - 1]),
      anchors,
      muzzle: pt(spr.muzzle),
      screen: spr.screen ? [spr.screen[0] + 1, spr.screen[1] + 1, spr.screen[2], spr.screen[3]] : anchors.screen || null,
      lightsAt: spr.lightsAt ? Object.fromEntries(Object.entries(spr.lightsAt).map(([k, v]) => [k, pt(v)])) : null,
      glow: gn ? { x: gx / gn + 1.5, y: gy / gn + 1.5, color: pal.G } : null,
      rows: h,
    };
  }

  // Icon (data URL) for inventory lists
  const iconCache = new Map();
  X.icon = function (partId, paintId) {
    const def = P.PARTS[partId];
    if (!def) return '';
    const paint = P.PAINTS_BY_ID[paintId] || P.PAINTS[0];
    const key = partId + '|' + paint.id;
    if (iconCache.has(key)) return iconCache.get(key);
    let sprKey = def.sprite || def.trinket;
    let url = '';
    const S = 3;
    if (sprKey) {
      const spr = X.get(sprKey, paint, def);
      const c = makeCanvas(36 * S / 3 * 1, 36);
      c.width = 40;
      c.height = 40;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const scale = Math.max(1, Math.min(3, Math.floor(38 / Math.max(spr.w, spr.h))));
      const dw = spr.w * scale, dh = spr.h * scale;
      ctx.drawImage(spr.canvas, Math.floor((40 - dw) / 2), Math.floor((40 - dh) / 2), dw, dh);
      url = c.toDataURL();
    } else {
      // modules without sprite: draw a little chip
      const c = makeCanvas(40, 40);
      const ctx = c.getContext('2d');
      const rar = P.RARITY[def.rarity].color;
      ctx.fillStyle = '#16131c';
      ctx.fillRect(8, 10, 24, 20);
      ctx.fillStyle = '#3c414c';
      ctx.fillRect(10, 12, 20, 16);
      ctx.fillStyle = rar;
      ctx.fillRect(14, 16, 12, 8);
      ctx.fillStyle = '#a3abb5';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(11 + i * 5, 6, 2, 4);
        ctx.fillRect(11 + i * 5, 30, 2, 4);
      }
      ctx.fillStyle = '#17151d';
      ctx.fillRect(17, 18, 6, 4);
      url = c.toDataURL();
    }
    iconCache.set(key, url);
    return url;
  };
  X.clearIconCache = () => iconCache.clear();

  // ---------- tiny 3x5 pixel font for in-world signage ----------
  const F = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', ' ': '000000000000000', "'": '010010000000000', '!': '010010010000010', '-': '000000111000000',
    '.': '000000000000010', '&': '010101010101011', '$': '011110010011110', '?': '110001010000010', ':': '000010000010000',
  };
  X.textWidth = (s, scale) => s.length * 4 * (scale || 1) - (scale || 1);
  X.text = function (ctx, s, x, y, color, scale) {
    scale = scale || 1;
    ctx.fillStyle = color;
    let cx = x;
    for (const chRaw of s.toUpperCase()) {
      const g = F[chRaw] || F['?'];
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
      cx += 4 * scale;
    }
  };
})();
