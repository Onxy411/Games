// Part-Time Pilot — procedural layered environments (arenas + junkyard hub).
// Layers are painted once at native pixel resolution, then baked to screen resolution with
// different blur amounts (depth of field). Lighting, fog and dust are layered on top at screen res.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const R = P.R;
  const M = 6; // native margin around layers (for screen shake)

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return [c, x];
  }
  const fr = (x, col, a, b, w, h) => {
    x.fillStyle = col;
    x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h));
  };
  function vgrad(x, a, b, w, h, stops) {
    const g = x.createLinearGradient(0, b, 0, b + h);
    stops.forEach((s, i) => g.addColorStop(s[0] != null ? s[0] : i / (stops.length - 1), s[1] || s));
    x.fillStyle = g;
    x.fillRect(a, b, w, h);
  }
  function speckle(x, a, b, w, h, cols, density, rng) {
    const n = Math.round(w * h * density);
    for (let i = 0; i < n; i++) fr(x, rng.pick(cols), a + rng() * w, b + rng() * h, 1, 1);
  }
  function glowDot(x, cx, cy, r, col, alpha) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, U.rgba(col, alpha));
    g.addColorStop(1, U.rgba(col, 0));
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  class Env {
    constructor(W, H, paint) {
      this.W = W;
      this.H = H;
      this.layers = [];
      this.crowd = [];
      this.lights = [];
      this.emitters = [];
      this.fog = [];
      this.motes = [];
      this.cones = [];
      this.excite = 0;
      this.groundY = 214;
      this.vignette = 0.7;
      this.grade = null;
      paint(this);
      const [dc] = canvas(W, H);
      this.decal = dc;
      this.bake();
      this._onResize = () => this.bake();
      R.onResize(this._onResize);
    }
    dispose() {
      R.offResize(this._onResize);
    }
    layer(name, depth, blur, fn) {
      const [c, x] = canvas(this.W + M * 2, this.H + M * 2);
      x.translate(M, M);
      fn(x, c);
      const L = { name, depth, blur, native: c, baked: null };
      this.layers.push(L);
      return L;
    }
    crowdRow(y, depth, blur, fn, amp, rate) {
      const [c, x] = canvas(this.W + M * 2, 40);
      x.translate(M, 20);
      fn(x);
      this.crowd.push({ y, depth, blur, native: c, baked: null, amp, rate, phase: Math.random() * 6 });
    }
    bake() {
      const s = R.view.width / this.W;
      for (const L of this.layers) L.baked = R.bake(L.native, L.blur * (s / 3), s);
      for (const C of this.crowd) C.baked = R.bake(C.native, C.blur * (s / 3), s);
      // light cones at screen res
      const w = R.view.width, h = R.view.height;
      const lc = document.createElement('canvas');
      lc.width = w;
      lc.height = h;
      const x = lc.getContext('2d');
      x.globalCompositeOperation = 'lighter';
      for (const cn of this.cones) {
        const top = cn.y0 * s, bot = cn.y1 * s;
        const g = x.createLinearGradient(0, top, 0, bot);
        g.addColorStop(0, U.rgba(cn.color, cn.a * 1.0));
        g.addColorStop(0.7, U.rgba(cn.color, cn.a * 0.35));
        g.addColorStop(1, U.rgba(cn.color, 0));
        x.fillStyle = g;
        x.beginPath();
        x.moveTo((cn.x - cn.w0) * s, top);
        x.lineTo((cn.x + cn.w0) * s, top);
        x.lineTo((cn.x2 + cn.w1) * s, bot);
        x.lineTo((cn.x2 - cn.w1) * s, bot);
        x.closePath();
        x.filter = `blur(${6 * (s / 3)}px)`;
        x.fill();
        x.filter = 'none';
        if (cn.pool) {
          const pg = x.createRadialGradient(cn.x2 * s, cn.pool.y * s, 0, cn.x2 * s, cn.pool.y * s, cn.pool.r * s);
          pg.addColorStop(0, U.rgba(cn.color, cn.pool.a));
          pg.addColorStop(1, U.rgba(cn.color, 0));
          x.save();
          x.translate(cn.x2 * s, cn.pool.y * s);
          x.scale(1, cn.pool.squash || 0.22);
          x.translate(-cn.x2 * s, -cn.pool.y * s);
          x.fillStyle = pg;
          x.fillRect((cn.x2 - cn.pool.r) * s, (cn.pool.y - cn.pool.r) * s, cn.pool.r * 2 * s, cn.pool.r * 2 * s);
          x.restore();
        }
      }
      this.coneCanvas = lc;
      // color grade overlay
      if (this.grade) {
        const gc = document.createElement('canvas');
        gc.width = w;
        gc.height = h;
        const gx = gc.getContext('2d');
        const g = gx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, U.rgba(this.grade[0], 0.5));
        g.addColorStop(1, U.rgba(this.grade[1], 0.5));
        gx.fillStyle = g;
        gx.fillRect(0, 0, w, h);
        this.gradeCanvas = gc;
      }
    }
    drawLayer(L, t, sway) {
      const v = R.vctx;
      const s = R.scale;
      const ox = R.shakeX * L.depth + (sway || 0) * Math.sin(t * 0.21) * (L.depth - 0.6) * s * 2;
      const oy = R.shakeY * L.depth;
      v.drawImage(L.baked, -M * s + ox, -M * s + oy);
    }
    // Everything behind the mechs
    drawBack(t, opts) {
      opts = opts || {};
      const v = R.vctx;
      const s = R.scale;
      this.excite = Math.max(0, this.excite - 0.016);
      for (const L of this.layers) {
        if (L.name === 'fg') continue;
        this.drawLayer(L, t, opts.sway);
        if (L.name === 'mid') {
          for (const C of this.crowd) {
            const amp = C.amp * (1 + this.excite * 3);
            const bob = Math.round(Math.abs(Math.sin(t * C.rate * (1 + this.excite) + C.phase)) * amp) * -1;
            v.drawImage(C.baked, -M * s + R.shakeX * C.depth, (C.y - 20) * s + bob * s + R.shakeY * C.depth);
          }
        }
      }
      // decals (scorch marks)
      v.imageSmoothingEnabled = false;
      v.drawImage(this.decal, R.shakeX, R.shakeY, this.W * s, this.H * s);
      // static lights (lamps, neon, fires)
      v.globalCompositeOperation = 'lighter';
      for (const l of this.lights) {
        let a = l.a;
        if (l.flicker) a *= 0.75 + 0.25 * Math.sin(t * l.flicker + l.x) * Math.sin(t * l.flicker * 1.7);
        if (l.blink && Math.sin(t * l.blink + l.x * 3) > 0.92) a *= 0.2;
        const r = l.r * s;
        v.globalAlpha = U.clamp(a, 0, 1);
        v.drawImage(R.glowSprite(l.color), l.x * s - r + R.shakeX * (l.depth || 1), l.y * s - r + R.shakeY * (l.depth || 1), r * 2, r * 2);
      }
      v.globalAlpha = 0.85 + Math.sin(t * 1.3) * 0.05;
      v.drawImage(this.coneCanvas, R.shakeX * 0.5, 0);
      v.globalAlpha = 1;
      v.globalCompositeOperation = 'source-over';
      this.drawFog(t, 0);
    }
    drawFog(t, front) {
      const v = R.vctx;
      const s = R.scale;
      for (const f of this.fog) {
        if (!!f.front !== !!front) continue;
        const x = ((f.x + t * f.v) % (this.W + 200)) - 100;
        const r = f.r * s;
        v.globalAlpha = f.a;
        v.drawImage(R.puffSprite(f.color), x * s - r, f.y * s - r * 0.5, r * 2, r);
      }
      v.globalAlpha = 1;
    }
    // Everything in front of the mechs
    drawFront(t, dt, opts) {
      opts = opts || {};
      const v = R.vctx;
      const s = R.scale;
      this.drawFog(t, 1);
      // dust motes drifting in the light
      if (this.motes.length < 60) {
        const cn = this.cones.length ? this.cones[Math.floor(Math.random() * this.cones.length)] : null;
        const x = cn ? U.lerp(cn.x, cn.x2, Math.random()) + (Math.random() - 0.5) * 40 : Math.random() * this.W;
        this.motes.push({ x, y: Math.random() * this.groundY, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4, life: 4 + Math.random() * 4, max: 8 });
      }
      v.globalCompositeOperation = 'lighter';
      for (const m of this.motes) {
        m.life -= dt;
        m.x += m.vx * dt + Math.sin(t + m.y) * 0.05;
        m.y += m.vy * dt;
        const a = Math.min(1, m.life) * Math.min(1, (m.max - m.life) * 0.5) * 0.5;
        v.globalAlpha = a;
        v.fillStyle = this.moteColor || '#ffe7b0';
        v.fillRect(m.x * s, m.y * s, Math.max(1, s * 0.5), Math.max(1, s * 0.5));
      }
      v.globalCompositeOperation = 'source-over';
      v.globalAlpha = 1;
      this.motes = this.motes.filter((m) => m.life > 0);
      const fg = this.layers.find((L) => L.name === 'fg');
      if (fg) this.drawLayer(fg, t, opts.sway);
      if (this.gradeCanvas) {
        v.globalCompositeOperation = 'soft-light';
        v.drawImage(this.gradeCanvas, 0, 0);
        v.globalCompositeOperation = 'source-over';
      }
      R.vignette(this.vignette);
    }
  }

  // =============================================================================================
  // ARENA
  // =============================================================================================
  function paintArena(themeId) {
    const T = P.ARENAS[themeId] || P.ARENAS.pit;
    return (env) => {
      const W = env.W, H = env.H;
      const rng = U.makeRng(U.hashStr('arena_' + themeId));
      const GY = (env.groundY = 214);
      env.grade = [U.shade(T.sky[1], -0.3), T.haze];
      env.moteColor = U.mix(T.light, '#ffffff', 0.5);
      const dark = U.shade(T.sky[1], -0.4);

      // ---------------- FAR ----------------
      env.layer('far', 0.25, 3.4, (x) => {
        vgrad(x, -M, -M, W + M * 2, 170 + M, [[0, T.sky[0]], [0.55, T.sky[1]], [1, T.sky[2]]]);
        const sil = U.mix(T.sky[1], T.sky[2], 0.45);
        const sil2 = U.mix(T.sky[1], T.sky[2], 0.2);
        // cavern ceiling rocks
        for (let i = -M; i < W + M; i += 6) {
          const h = 10 + Math.sin(i * 0.05) * 6 + rng() * 10;
          fr(x, T.sky[0], i, -M, 6, h + M);
        }
        // arches & pillars of the old station
        for (const px of [30, 150, 330, 450]) {
          fr(x, sil2, px - 8, 20, 16, 150);
          fr(x, U.shade(sil2, 0.1), px - 8, 20, 2, 150);
        }
        x.strokeStyle = sil2;
        x.lineWidth = 6;
        for (const [a, b] of [[30, 150], [150, 330], [330, 450]]) {
          x.beginPath();
          x.moveTo(a, 40);
          x.quadraticCurveTo((a + b) / 2, -10, b, 40);
          x.stroke();
        }
        // pipes
        for (const py of [52, 74]) {
          fr(x, sil, -M, py, W + M * 2, 4);
          fr(x, U.shade(sil, 0.15), -M, py, W + M * 2, 1);
          for (let i = 0; i < W; i += 46 + Math.floor(rng() * 30)) fr(x, U.shade(sil, -0.2), i, py - 1, 3, 6);
        }
        // themed background structures
        if (T.props === 'tires' || T.props === 'demo') {
          for (let i = 0; i < 16; i++) {
            const bx = rng() * W, bw = 20 + rng() * 40, bh = 12 + rng() * 26;
            fr(x, U.mix(sil, T.sky[2], rng() * 0.4), bx, 150 - bh - rng() * 30, bw, bh);
          }
          if (T.props === 'demo') {
            // crane silhouettes
            for (const cx of [90, 400]) {
              fr(x, sil2, cx, 40, 5, 120);
              for (let i = 0; i < 120; i += 6) fr(x, U.shade(sil2, 0.15), cx + (i % 12 ? 0 : 3), 40 + i, 2, 2);
              fr(x, sil2, cx - 60, 40, 120, 4);
              fr(x, sil2, cx + 40, 44, 1, 50);
              fr(x, sil2, cx + 36, 94, 9, 9);
            }
          }
        }
        if (T.props === 'furnace') {
          for (const fx of [70, 240, 410]) {
            fr(x, sil2, fx - 26, 80, 52, 70);
            fr(x, U.shade(sil2, -0.3), fx - 14, 104, 28, 20);
            fr(x, '#ff6a1a', fx - 11, 108, 22, 14);
            fr(x, '#ffc04a', fx - 7, 112, 14, 6);
            glowDot(x, fx, 115, 40, '#ff5a1a', 0.45);
            fr(x, sil2, fx - 4, 20, 8, 60);
          }
          // chains
          for (let i = 0; i < 10; i++) {
            const cx = 20 + rng() * 440, len = 30 + rng() * 60;
            for (let j = 0; j < len; j += 3) fr(x, sil, cx, 10 + j, 2, 2);
          }
        }
        if (T.props === 'lab') {
          for (const cx of [60, 180, 300, 420]) {
            fr(x, sil2, cx - 3, 60, 6, 90);
            for (let j = 60; j < 150; j += 6) fr(x, U.shade(sil2, 0.25), cx - 5, j, 10, 2);
            glowDot(x, cx, 56, 18, T.accent, 0.55);
            fr(x, '#cff6ff', cx - 2, 54, 4, 4);
          }
          for (let i = 0; i < 6; i++) {
            x.strokeStyle = sil;
            x.lineWidth = 1;
            x.beginPath();
            const a = rng() * W;
            x.moveTo(a, 0);
            x.quadraticCurveTo(a + 30, 40 + rng() * 40, a + 60 + rng() * 40, 0);
            x.stroke();
          }
        }
        if (T.props === 'gold') {
          for (const cx of [120, 240, 360]) {
            fr(x, sil, cx, 0, 1, 34);
            fr(x, '#9b7123', cx - 14, 34, 28, 3);
            for (let k = -12; k <= 12; k += 6) {
              fr(x, '#e9bb4c', cx + k - 1, 30, 2, 4);
              glowDot(x, cx + k, 30, 10, '#ffd98a', 0.55);
            }
          }
          for (const bx of [60, 180, 300, 420]) {
            fr(x, '#3a1450', bx - 10, 40, 20, 60);
            fr(x, '#e9bb4c', bx - 10, 40, 20, 2);
            fr(x, '#e9bb4c', bx - 4, 60, 8, 6);
            fr(x, '#e9bb4c', bx - 4, 58, 2, 2);
            fr(x, '#e9bb4c', bx + 2, 58, 2, 2);
            fr(x, '#e9bb4c', bx - 1, 57, 2, 2);
            for (let k = 0; k < 20; k += 4) fr(x, '#3a1450', bx - 10 + k, 100, 2, 3);
          }
        }
        if (T.props === 'stadium') {
          // jumbotron
          fr(x, sil, 192, 14, 96, 56);
          fr(x, '#07090e', 196, 18, 88, 46);
          glowDot(x, 240, 41, 56, T.accent, 0.4);
          for (let j = 20; j < 62; j += 3) fr(x, U.rgba(T.accent, 0.22), 198, j, 84, 1);
          fr(x, U.rgba('#ffffff', 0.5), 214, 34, 52, 4);
          fr(x, U.rgba('#ffffff', 0.3), 222, 42, 36, 3);
          fr(x, '#ff3a2a', 200, 21, 6, 3);
          fr(x, sil, 236, 70, 8, 44);
          // floodlight towers
          for (const cx of [36, 444]) {
            fr(x, sil2, cx - 2, 22, 4, 128);
            for (let j = 26; j < 150; j += 8) fr(x, U.shade(sil2, 0.2), cx - 4, j, 8, 1);
            fr(x, sil2, cx - 16, 12, 32, 12);
            for (let k = -14; k <= 10; k += 6) {
              fr(x, '#fff6dc', cx + k, 14, 4, 5);
              glowDot(x, cx + k + 2, 17, 18, T.light, 0.6);
            }
          }
          // team banners
          for (const [bx, col] of [[112, T.accent], [368, U.shade(T.accent, -0.3)]]) {
            fr(x, col, bx - 12, 28, 24, 50);
            fr(x, U.shade(col, 0.35), bx - 12, 28, 24, 2);
            fr(x, U.shade(col, 0.5), bx - 5, 44, 10, 10);
            for (let k = 0; k < 24; k += 6) fr(x, col, bx - 12 + k, 78, 3, 4);
          }
        }
        // hanging lamps
        for (let i = 0; i < 7; i++) {
          const lx = 30 + i * 70 + rng() * 20, ly = 30 + rng() * 30;
          fr(x, sil, lx, 0, 1, ly);
          fr(x, T.light, lx - 1, ly, 3, 2);
          glowDot(x, lx, ly + 2, 16, T.light, 0.5);
        }
        // haze near the horizon
        vgrad(x, -M, 110, W + M * 2, 60, [[0, U.rgba(T.haze, 0)], [1, U.rgba(T.haze, 0.25)]]);
      });

      // ---------------- MID: stands + sign ----------------
      env.layer('mid', 0.45, 1.4, (x) => {
        const standC = U.mix(T.wall, T.sky[1], 0.55);
        for (let i = 0; i < 4; i++) {
          const y = 96 + i * 14;
          fr(x, U.shade(standC, -0.1 + i * 0.05), -M, y, W + M * 2, 14);
          fr(x, U.shade(standC, 0.2), -M, y, W + M * 2, 1);
        }
        // railings
        for (let i = 0; i < W; i += 8) fr(x, U.shade(standC, 0.3), i, 92, 1, 4);
        fr(x, U.shade(standC, 0.3), -M, 92, W + M * 2, 1);
        // sign
        const txt = T.sign;
        const sc = 2;
        const tw = P.Pixel.textWidth(txt, sc);
        const sx = Math.round(W / 2 - tw / 2);
        fr(x, '#120c10', sx - 6, 70, tw + 12, 18);
        fr(x, U.shade(T.accent, -0.4), sx - 6, 70, tw + 12, 1);
        fr(x, U.shade(T.accent, -0.4), sx - 6, 87, tw + 12, 1);
        P.Pixel.text(x, txt, sx, 74, T.accent, sc);
        env.lights.push({ x: W / 2, y: 79, r: tw * 0.55, color: T.accent, a: 0.38, flicker: 9, depth: 0.45 });
        // banners
        for (const bx of [40, 440]) {
          fr(x, U.shade(T.accent, -0.45), bx - 9, 62, 18, 30);
          fr(x, T.accent, bx - 9, 62, 18, 2);
          fr(x, U.shade(T.accent, -0.1), bx - 3, 70, 6, 6);
          for (let k = 0; k < 18; k += 4) fr(x, U.shade(T.accent, -0.45), bx - 9 + k, 92, 2, 3);
        }
        // scoreboard-ish screens
        for (const bx of [120, 360]) {
          fr(x, '#101418', bx - 16, 66, 32, 18);
          fr(x, U.shade(T.light, -0.5), bx - 14, 68, 28, 14);
          P.Pixel.text(x, bx < 240 ? 'P1' : 'P2', bx - 7, 72, '#ffe7b0', 1);
          env.lights.push({ x: bx, y: 75, r: 18, color: T.light, a: 0.18, flicker: 3, depth: 0.45 });
        }
      });
      // crowd rows
      const crowdCols = [U.shade(T.crowd, 0.15), U.shade(T.crowd, 0.3), U.shade(T.crowd, 0.05), U.mix(T.crowd, T.accent, 0.2), U.mix(T.crowd, '#6a6a7a', 0.3)];
      [[110, 4, 1.4], [124, 5, 1.1], [138, 6, 0.8]].forEach(([y, hr, blur], ri) => {
        env.crowdRow(y, 0.5, blur, (x) => {
          for (let i = -M; i < W + M; i += hr + 2 + Math.floor(rng() * 3)) {
            if (rng() < 0.08) continue;
            const c = U.shade(rng.pick(crowdCols), -0.15 + ri * 0.06);
            const hh = hr + Math.floor(rng() * 2);
            fr(x, c, i, -hh, hr, hh);
            fr(x, c, i - 1, 0, hr + 2, 6);
            fr(x, U.shade(c, 0.25), i, -hh, hr, 1);
            if (rng() < 0.08) {
              fr(x, '#e8e0d0', i - 2, -hh - 9, 9, 6);
              fr(x, rng.pick([T.accent, '#d63b35', '#3d71e0']), i, -hh - 8, 5, 2);
              fr(x, c, i + 2, -hh - 3, 1, 3);
            }
            if (rng() < 0.05) fr(x, '#ffd25a', i + 1, -hh - 4, 1, 2);
          }
        }, 1 + ri * 0.5, 4 + ri);
      });

      // ---------------- WALL ----------------
      env.layer('wall', 0.85, 0.35, (x) => {
        const wc = T.wall;
        fr(x, wc, -M, 146, W + M * 2, 24);
        for (let i = -M; i < W + M; i += 32) {
          fr(x, U.shade(wc, -0.25), i, 152, 1, 18);
          speckle(x, i, 152, 32, 18, [U.shade(wc, 0.1), U.shade(wc, -0.15)], 0.08, rng);
        }
        for (let i = -M; i < W + M; i += 8) {
          fr(x, i % 16 === 0 ? T.accent : '#1a161a', i, 146, 8, 5);
        }
        fr(x, U.shade(wc, 0.3), -M, 151, W + M * 2, 1);
        fr(x, U.shade(wc, -0.35), -M, 169, W + M * 2, 2);
        // embedded tires & graffiti
        for (let i = 0; i < 9; i++) {
          const tx = 20 + rng() * 440;
          fr(x, '#1a1820', tx, 156, 12, 10);
          fr(x, '#2a2830', tx + 3, 159, 6, 4);
        }
        for (let i = 0; i < 6; i++) {
          const gx = rng() * W;
          const gc = rng.pick(['#d63b35', '#3d71e0', '#5cba62', T.accent, '#f07ab0']);
          for (let k = 0; k < 14; k++) fr(x, U.rgba(gc, 0.6), gx + rng() * 22, 154 + rng() * 12, 2, 1);
        }
        // gates
        for (const gx of [0, W - 26]) {
          fr(x, '#0e0c10', gx, 140, 26, 30);
          for (let k = 0; k < 26; k += 4) fr(x, '#2a2630', gx + k, 140, 1, 30);
        }
      });

      // ---------------- FLOOR ----------------
      env.layer('floor', 1.0, 0, (x) => {
        vgrad(x, -M, 168, W + M * 2, H - 168 + M, [[0, T.floorFar], [0.35, T.floor], [1, U.shade(T.floor, -0.25)]]);
        speckle(x, -M, 168, W + M * 2, H - 168, [U.shade(T.floor, 0.12), U.shade(T.floor, -0.18), U.shade(T.floor, -0.3)], 0.06, rng);
        // painted ring
        x.strokeStyle = U.rgba(T.accent, 0.35);
        x.lineWidth = 2;
        x.beginPath();
        x.ellipse(W / 2, GY + 2, 170, 22, 0, 0, Math.PI * 2);
        x.stroke();
        x.strokeStyle = U.rgba(T.accent, 0.22);
        x.beginPath();
        x.moveTo(W / 2, GY - 16);
        x.lineTo(W / 2, GY + 22);
        x.stroke();
        // oil stains & cracks
        for (let i = 0; i < 10; i++) {
          x.fillStyle = 'rgba(10,8,10,0.28)';
          x.beginPath();
          x.ellipse(rng() * W, 190 + rng() * 70, 6 + rng() * 14, 2 + rng() * 3, 0, 0, Math.PI * 2);
          x.fill();
        }
        for (let i = 0; i < 14; i++) {
          let cx = rng() * W, cy = 175 + rng() * 90;
          for (let k = 0; k < 10; k++) {
            fr(x, U.shade(T.floor, -0.4), cx, cy, 1, 1);
            cx += rng() < 0.5 ? 1 : -1;
            cy += rng() < 0.6 ? 1 : 0;
            cx += 1;
          }
        }
        // grates
        for (const gx of [70, 410]) {
          fr(x, U.shade(T.floor, -0.45), gx - 12, 236, 24, 8);
          for (let k = 0; k < 24; k += 3) fr(x, U.shade(T.floor, 0.1), gx - 12 + k, 236, 1, 8);
        }
        // props at the back corners
        const prop = (px, flip) => {
          if (T.props === 'tires' || T.props === 'demo') {
            for (let k = 0; k < 3; k++) {
              fr(x, '#17151c', px - 9, 184 - k * 6, 18, 6);
              fr(x, '#2a2830', px - 7, 185 - k * 6, 14, 1);
            }
            fr(x, '#5a4038', px + flip * 18 - 6, 176, 12, 16);
            fr(x, '#7a5848', px + flip * 18 - 6, 176, 12, 2);
            fr(x, '#3a2a24', px + flip * 18 - 6, 182, 12, 1);
            env.emitters.push({ kind: 'fire', x: px + flip * 18, y: 175 });
            env.lights.push({ x: px + flip * 18, y: 172, r: 34, color: '#ff8a3a', a: 0.6, flicker: 14 });
          }
          if (T.props === 'demo') {
            fr(x, T.accent, px - 14, 196, 28, 4);
            for (let k = 0; k < 28; k += 6) fr(x, '#17151c', px - 14 + k, 196, 3, 4);
          }
          if (T.props === 'furnace') {
            fr(x, '#2a1612', px - 12, 174, 24, 20);
            fr(x, '#ff6a1a', px - 8, 180, 16, 8);
            env.emitters.push({ kind: 'fire', x: px, y: 178 });
            env.emitters.push({ kind: 'steam', x: px + flip * 20, y: 170 });
            env.lights.push({ x: px, y: 182, r: 40, color: '#ff5a1a', a: 0.7, flicker: 10 });
          }
          if (T.props === 'lab') {
            fr(x, '#1a2a34', px - 8, 166, 16, 28);
            for (let k = 0; k < 28; k += 4) fr(x, '#cfe6f0', px - 9, 166 + k, 18, 1);
            fr(x, '#cff6ff', px - 2, 162, 4, 4);
            env.emitters.push({ kind: 'zap', x: px, y: 163 });
            env.lights.push({ x: px, y: 164, r: 30, color: T.accent, a: 0.5, flicker: 20 });
          }
          if (T.props === 'gold') {
            fr(x, '#9b7123', px - 4, 160, 8, 34);
            fr(x, '#e9bb4c', px - 6, 158, 12, 3);
            fr(x, '#ffd98a', px - 2, 154, 4, 4);
            env.emitters.push({ kind: 'fire', x: px, y: 153 });
            env.lights.push({ x: px, y: 154, r: 30, color: '#ffc04a', a: 0.65, flicker: 12 });
          }
        };
        if (T.props === 'stadium') {
          // TV cameras on tripods, tally light on
          for (const [px, flip] of [[30, 1], [W - 30, -1]]) {
            fr(x, '#17151c', px - 1, 176, 2, 18);
            fr(x, '#17151c', px - 7, 193, 14, 2);
            fr(x, '#17151c', px - 5, 186, 2, 8);
            fr(x, '#17151c', px + 3, 186, 2, 8);
            fr(x, '#2a2a34', px - 8, 166, 16, 10);
            fr(x, '#3d3d4a', px - 8, 166, 16, 1);
            fr(x, '#14141a', px + flip * 8 - (flip < 0 ? 5 : 0), 168, 5, 6);
            fr(x, '#ff3a2a', px - flip * 6 - 1, 167, 2, 2);
            env.lights.push({ x: px - flip * 6, y: 168, r: 10, color: '#ff3a2a', a: 0.65, flicker: 2 });
          }
        }
        prop(28, 1);
        prop(W - 28, -1);
        if (T.props === 'gold') {
          // red carpet
          fr(x, 'rgba(140,20,40,0.55)', -M, GY + 8, W + M * 2, 10);
          fr(x, 'rgba(233,187,76,0.6)', -M, GY + 8, W + M * 2, 1);
          fr(x, 'rgba(233,187,76,0.6)', -M, GY + 17, W + M * 2, 1);
        }
      });

      // ---------------- FOREGROUND ----------------
      env.layer('fg', 1.35, 5.5, (x) => {
        const fc = '#060508';
        const rim = U.shade(T.light, -0.55);
        // fence along bottom
        for (let i = -M; i < W + M; i += 70) {
          fr(x, fc, i, 232, 5, 50);
          fr(x, rim, i, 232, 5, 1);
        }
        x.strokeStyle = 'rgba(8,6,10,0.85)';
        x.lineWidth = 1;
        for (let i = -40; i < W + 40; i += 9) {
          x.beginPath();
          x.moveTo(i, 236);
          x.lineTo(i + 30, 280);
          x.moveTo(i + 30, 236);
          x.lineTo(i, 280);
          x.stroke();
        }
        fr(x, fc, -M, 234, W + M * 2, 2);
        // crowd heads in front corners
        const head = (hx, hy, r) => {
          x.fillStyle = fc;
          x.beginPath();
          x.arc(hx, hy, r, 0, Math.PI * 2);
          x.fill();
          fr(x, fc, hx - r * 1.6, hy + r * 0.6, r * 3.2, 40);
          x.fillStyle = rim;
          x.beginPath();
          x.arc(hx, hy, r, Math.PI * 1.15, Math.PI * 1.6);
          x.lineTo(hx, hy);
          x.fill();
        };
        head(18, 252, 13);
        head(54, 262, 11);
        head(W - 24, 255, 14);
        head(W - 62, 266, 10);
        // pillars
        fr(x, fc, -M, -M, 14 + M, H + M * 2);
        fr(x, fc, W - 14, -M, 14 + M, H + M * 2);
        fr(x, rim, 13, -M, 1, H + M * 2);
        fr(x, rim, W - 14, -M, 1, H + M * 2);
        // hanging chains
        for (const cx of [26, W - 30]) for (let j = 0; j < 46; j += 4) fr(x, fc, cx + (j % 8 ? 0 : 1), j - M, 3, 3);
      });

      // spotlight cones & pools
      env.cones.push({ x: 150, x2: 170, y0: -10, y1: GY + 10, w0: 8, w1: 70, color: T.light, a: 0.12, pool: { y: GY + 2, r: 95, a: 0.28 } });
      env.cones.push({ x: 330, x2: 310, y0: -10, y1: GY + 10, w0: 8, w1: 70, color: T.light, a: 0.12, pool: { y: GY + 2, r: 95, a: 0.28 } });
      // fog
      for (let i = 0; i < 9; i++) env.fog.push({ x: rng() * (W + 200), y: 150 + rng() * 50, r: 60 + rng() * 60, a: 0.08 + rng() * 0.06, v: 3 + rng() * 5, color: U.mix(T.haze, '#808080', 0.5) });
      for (let i = 0; i < 5; i++) env.fog.push({ x: rng() * (W + 200), y: 226 + rng() * 30, r: 70 + rng() * 50, a: 0.06, v: 6 + rng() * 6, color: U.mix(T.haze, '#606060', 0.6), front: true });
    };
  }

  // =============================================================================================
  // HUB — the junkyard at night
  // =============================================================================================
  function paintHub(env) {
    const W = env.W, H = env.H;
    const rng = U.makeRng(4242);
    const GY = (env.groundY = 108);
    env.grade = ['#1a1840', '#ff9a4a'];
    env.moteColor = '#ffd9a0';
    env.vignette = 0.65;

    env.layer('far', 0.2, 2.6, (x) => {
      vgrad(x, -M, -M, W + M * 2, 120, [[0, '#070a1c'], [0.5, '#1c1838'], [0.8, '#4a2a44'], [1, '#a8583a']]);
      for (let i = 0; i < 90; i++) {
        const sx = rng() * W, sy = rng() * 70;
        fr(x, rng() < 0.2 ? '#ffffff' : '#9aa0c8', sx, sy, 1, 1);
      }
      glowDot(x, 250, 22, 26, '#e8e4ff', 0.35);
      x.fillStyle = '#efeadc';
      x.beginPath();
      x.arc(250, 22, 7, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#d8d0c0';
      x.fillRect(247, 20, 2, 2);
      x.fillRect(252, 24, 2, 1);
      // city skyline
      for (let i = -M; i < W + M; ) {
        const bw = 8 + rng() * 16, bh = 10 + rng() * 34;
        fr(x, '#1a1630', i, 98 - bh, bw, bh + 20);
        for (let k = 0; k < bw * bh * 0.05; k++) if (rng() < 0.5) fr(x, rng() < 0.7 ? '#ffd27a' : '#8ad0ff', i + 1 + rng() * (bw - 2), 98 - bh + 2 + rng() * (bh - 2), 1, 1);
        i += bw + 1;
      }
      vgrad(x, -M, 70, W + M * 2, 40, [[0, 'rgba(255,140,80,0)'], [1, 'rgba(255,140,80,0.25)']]);
    });
    env.layer('mid', 0.45, 1.1, (x) => {
      // junk mountains
      const jc = '#221c2a';
      for (let i = -M; i < W + M; i += 3) {
        const h = 18 + Math.sin(i * 0.035) * 10 + Math.sin(i * 0.11) * 4 + rng() * 3;
        fr(x, jc, i, GY - h + 4, 3, h);
      }
      for (let i = 0; i < 26; i++) {
        const cx = rng() * W, cy = GY - 8 - rng() * 16;
        fr(x, rng.pick(['#2e2638', '#3a2e3a', '#2a2a3e']), cx, cy, 10 + rng() * 10, 4 + rng() * 4);
        if (rng() < 0.3) fr(x, '#5a4a4a', cx + 2, cy + 1, 2, 2);
      }
      // crane
      fr(x, '#1a1624', 262, 28, 4, GY - 28);
      for (let j = 28; j < GY; j += 6) fr(x, '#2e2838', 262, j, 4, 1);
      fr(x, '#1a1624', 196, 28, 92, 3);
      for (let k = 196; k < 288; k += 6) fr(x, '#2e2838', k, 28, 1, 3);
      fr(x, '#1a1624', 286, 24, 8, 10);
      // floodlight tower
      fr(x, '#1a1624', 18, 20, 3, GY - 20);
      fr(x, '#2a2434', 12, 16, 15, 6);
      fr(x, '#fff2c0', 14, 18, 11, 2);
      env.lights.push({ x: 19, y: 19, r: 30, color: '#ffe7b0', a: 0.4, depth: 0.45 });
    });
    env.layer('ground', 1.0, 0, (x) => {
      vgrad(x, -M, GY - 6, W + M * 2, H - GY + M + 6, [[0, '#2a2026'], [0.3, '#3a2c2a'], [1, '#1e1618']]);
      speckle(x, -M, GY, W + M * 2, H - GY, ['#4a3a34', '#22181a', '#55443a'], 0.07, rng);
      // tire tracks
      for (let k = 0; k < 2; k++) for (let i = 0; i < W; i += 4) fr(x, 'rgba(15,10,12,0.4)', i, GY + 30 + k * 6 + Math.round(Math.sin(i * 0.02) * 3), 2, 1);
      // puddles
      for (const [px, py, pw] of [[60, 132, 26], [250, 140, 34], [200, 164, 20]]) {
        x.fillStyle = 'rgba(70,60,110,0.55)';
        x.beginPath();
        x.ellipse(px, py, pw, 3, 0, 0, Math.PI * 2);
        x.fill();
        fr(x, 'rgba(255,200,150,0.35)', px - pw / 3, py - 1, pw / 2, 1);
      }
      // garage shed (left)
      fr(x, '#2c2a36', -M, 34, 92 + M, GY - 34 + 2);
      for (let i = -M; i < 92; i += 4) fr(x, '#3a3846', i, 34, 1, GY - 34);
      fr(x, '#4a4656', -M, 30, 96 + M, 5);
      fr(x, '#1a1820', -M, 35, 96 + M, 1);
      fr(x, '#120e14', 40, 58, 44, GY - 58);
      vgrad(x, 42, 60, 40, GY - 60, [[0, '#6a4a2a'], [1, '#c8823a']]);
      // shelves of parts inside
      for (let s = 0; s < 3; s++) {
        fr(x, '#3a2a1e', 44, 66 + s * 12, 36, 2);
        for (let k = 0; k < 6; k++) fr(x, rng.pick(['#6c7480', '#a3abb5', '#b8642f', '#5cba62', '#3d71e0']), 46 + k * 6, 61 + s * 12, 4, 5);
      }
      env.lights.push({ x: 62, y: 84, r: 40, color: '#ffae5a', a: 0.45 });
      // sign
      const txt = "BOLT'S SALVAGE";
      P.Pixel.text(x, txt, 6, 22, '#ff5ad0', 1);
      fr(x, '#120c10', 4, 20, P.Pixel.textWidth(txt, 1) + 4, 1);
      env.lights.push({ x: 33, y: 24, r: 32, color: '#ff5ad0', a: 0.4, flicker: 11, blink: 7 });
      // workbench
      fr(x, '#3a2a1e', 96, 92, 26, 3);
      fr(x, '#2a1e16', 98, 95, 2, GY - 95);
      fr(x, '#2a1e16', 118, 95, 2, GY - 95);
      fr(x, '#a3abb5', 100, 89, 6, 3);
      fr(x, '#d63b35', 110, 88, 3, 4);
      // mech platform
      fr(x, '#2a2830', 128, GY - 1, 60, 6);
      for (let k = 128; k < 188; k += 6) fr(x, k % 12 ? '#f0c040' : '#17151d', k, GY + 1, 6, 2);
      fr(x, '#4a4858', 128, GY - 1, 60, 1);
      // tire stack + cat
      for (let k = 0; k < 3; k++) {
        fr(x, '#17151c', 204, GY - 6 - k * 6, 18, 6);
        fr(x, '#2a2830', 206, GY - 5 - k * 6, 14, 1);
      }
      fr(x, '#17151d', 210, GY - 25, 7, 6);
      fr(x, '#17151d', 210, GY - 27, 2, 2);
      fr(x, '#17151d', 215, GY - 27, 2, 2);
      fr(x, '#17151d', 216, GY - 22, 4, 2);
      fr(x, '#ffe04a', 211, GY - 24, 1, 1);
      fr(x, '#ffe04a', 214, GY - 24, 1, 1);
      // fire barrel
      fr(x, '#4a3a34', 234, GY - 14, 12, 16);
      fr(x, '#6a5248', 234, GY - 14, 12, 2);
      fr(x, '#2a201c', 234, GY - 8, 12, 1);
      env.emitters.push({ kind: 'fire', x: 240, y: GY - 15 });
      env.lights.push({ x: 240, y: GY - 18, r: 46, color: '#ff8a3a', a: 0.65, flicker: 14 });
      // hanging lamp over the mech
      fr(x, '#0e0c10', 158, -M, 1, 34 + M);
      fr(x, '#3a3846', 153, 34, 11, 3);
      fr(x, '#fff2c0', 155, 37, 7, 1);
      env.lights.push({ x: 158, y: 38, r: 22, color: '#ffe7b0', a: 0.7 });
      // junk piles at sides
      for (let i = 0; i < 12; i++) fr(x, rng.pick(['#3a2e34', '#4a3a36', '#2e2a36']), 270 + rng() * 50, GY - 4 - rng() * 14, 8 + rng() * 10, 6);
    });
    env.layer('fg', 1.3, 4.5, (x) => {
      const fc = '#050407';
      for (const [hx, hy, r] of [[8, 172, 14], [30, 178, 10], [312, 168, 16], [290, 180, 10]]) {
        x.fillStyle = fc;
        x.beginPath();
        x.arc(hx, hy, r, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = '#120e16';
        x.beginPath();
        x.arc(hx, hy, r * 0.45, 0, Math.PI * 2);
        x.fill();
      }
      for (let i = -M; i < W + M; i += 50) fr(x, fc, i, 160, 3, 30);
      fr(x, fc, -M, 160, W + M * 2, 1);
    });
    env.cones.push({ x: 158, x2: 158, y0: 36, y1: GY + 6, w0: 4, w1: 40, color: '#ffe0a0', a: 0.16, pool: { y: GY + 1, r: 46, a: 0.32 } });
    for (let i = 0; i < 6; i++) env.fog.push({ x: rng() * (W + 200), y: 96 + rng() * 20, r: 50 + rng() * 40, a: 0.07, v: 2 + rng() * 3, color: '#8a7a9a' });
    for (let i = 0; i < 3; i++) env.fog.push({ x: rng() * (W + 200), y: 150 + rng() * 20, r: 60, a: 0.05, v: 4, color: '#7a6a8a', front: true });
  }

  P.Env = {
    arena: (themeId) => new Env(480, 270, paintArena(themeId)),
    hub: () => new Env(320, 180, paintHub),
  };
})();
