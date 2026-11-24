// Part-Time Pilot — particles, projectiles, beams, debris, lights and floating text.
// Pixel particles/projectiles/debris render into the low-res world buffer (crisp);
// smoke, glows, beams and text render at screen resolution on top (soft, HD-2D style).
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const R = P.R;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  class FX {
    constructor() {
      this.reset();
    }
    reset() {
      this.pix = [];
      this.soft = [];
      this.lights = [];
      this.texts = [];
      this.callouts = [];
      this.projs = [];
      this.beams = [];
      this.debris = [];
      this.charges = [];
      this.shakeA = 0;
      this.flashA = 0;
      this.flashColor = '#ffffff';
      this.groundY = 214;
      this.decal = null;
      this.time = 0;
    }

    // ---------------- spawners ----------------
    spark(x, y, n, colors, spd, opts) {
      opts = opts || {};
      colors = Array.isArray(colors) ? colors : [colors];
      for (let i = 0; i < n; i++) {
        const a = opts.dir != null ? opts.dir + rnd(-opts.spread || -0.8, opts.spread || 0.8) : rnd(0, Math.PI * 2);
        const s = rnd(0.4, 1) * (spd || 90);
        this.pix.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), life: rnd(0.15, 0.45) * (opts.life || 1), max: 0.45, color: pick(colors), size: Math.random() < 0.2 ? 2 : 1, g: opts.g == null ? 220 : opts.g, drag: 0.9, glow: opts.glow });
      }
    }
    chips(x, y, n, colors) {
      colors = colors || ['#8a909a', '#5a606a', '#c0c6cc'];
      for (let i = 0; i < n; i++) {
        this.pix.push({ x, y, vx: rnd(-70, 70), vy: rnd(-110, -30), life: rnd(0.5, 1.1), max: 1.1, color: pick(colors), size: Math.random() < 0.4 ? 2 : 1, g: 320, drag: 0.98, bounce: true });
      }
    }
    smoke(x, y, n, opts) {
      opts = opts || {};
      for (let i = 0; i < n; i++) {
        this.soft.push({
          x: x + rnd(-2, 2) * (opts.spread || 1), y: y + rnd(-2, 2) * (opts.spread || 1),
          vx: rnd(-6, 6) + (opts.vx || 0), vy: rnd(-16, -6) * (opts.rise == null ? 1 : opts.rise),
          life: rnd(0.8, 1.6) * (opts.life || 1), max: 1.6 * (opts.life || 1),
          size: rnd(3, 6) * (opts.size || 1), grow: 7 * (opts.size || 1), color: opts.color || '#3a3438', a: opts.a || 0.55, add: false,
        });
      }
    }
    glowPuff(x, y, n, color, size, life) {
      for (let i = 0; i < n; i++) {
        this.soft.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: rnd(-20, 20), vy: rnd(-25, 5), life: rnd(0.15, 0.35) * (life || 1), max: 0.35 * (life || 1), size: rnd(3, 6) * (size || 1), grow: 14 * (size || 1), color, a: 0.8, add: true });
      }
    }
    light(x, y, r, color, life, a) {
      this.lights.push({ x, y, r, color, life, max: life, a: a == null ? 1 : a });
    }
    shake(a) {
      if (P.State.settings.shake === false) return;
      this.shakeA = Math.max(this.shakeA, a);
    }
    screenFlash(color, a) {
      this.flashColor = color;
      this.flashA = Math.max(this.flashA, a);
    }
    text(x, y, str, opts) {
      opts = opts || {};
      this.texts.push({ x: x + rnd(-3, 3), y, str, color: opts.color || '#fff', size: opts.size || 10, life: opts.life || 1.0, max: opts.life || 1.0, vy: opts.vy == null ? -22 : opts.vy, crit: !!opts.crit, stroke: opts.stroke });
    }
    callout(str, x, y, color, sub) {
      this.callouts.push({ str, x, y, color: color || '#ffcf5a', life: 1.8, max: 1.8, sub });
    }
    scorch(x, y, r) {
      if (!this.decal) return;
      const c = this.decal.getContext('2d');
      const gy = U.clamp(y, this.groundY - 2, this.groundY + 14);
      c.fillStyle = 'rgba(10,8,8,0.35)';
      c.beginPath();
      c.ellipse(Math.round(x), Math.round(gy), r, r * 0.3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(10,8,8,0.4)';
      for (let i = 0; i < r; i++) c.fillRect(Math.round(x + rnd(-r, r)), Math.round(gy + rnd(-r * 0.25, r * 0.25)), 1, 1);
    }

    explosion(x, y, size, opts) {
      opts = opts || {};
      size = size || 1;
      this.light(x, y, 34 * size, opts.color || '#ffb050', 0.3, 1);
      this.light(x, y, 14 * size, '#ffffff', 0.12, 0.9);
      this.glowPuff(x, y, Math.round(6 * size), opts.color || '#ff8a2a', size * 1.2, 1.4);
      this.glowPuff(x, y, Math.round(3 * size), '#ffe08a', size * 0.8, 1);
      this.smoke(x, y - 2, Math.round(5 * size), { size: size * 1.2, life: 1.4, color: '#2e2a2c', a: 0.6, spread: 3 });
      this.spark(x, y, Math.round(14 * size), ['#ffd25a', '#ff8a2a', '#fff2c0'], 130 * size, { up: 40, glow: true });
      this.chips(x, y, Math.round(5 * size));
      this.shake(3 * size);
      if (y > this.groundY - 30) this.scorch(x, this.groundY + rnd(0, 6), 7 * size);
      if (!opts.silent) P.SFX.play(size > 1.4 ? 'boom_big' : 'boom', { vol: Math.min(1, 0.5 + size * 0.3) });
    }

    impact(x, y, dtype, crit, vfx) {
      const big = crit ? 1.5 : 1;
      switch (dtype) {
        case 'ballistic':
          this.spark(x, y, Math.round(7 * big), ['#ffe7a0', '#ffffff', '#ffb94a'], 110, { glow: true });
          this.light(x, y, 10 * big, '#ffd27a', 0.12, 0.8);
          if (vfx === 'plunger') this.text(x, y - 6, 'THWOMP', { color: '#ff8a8a', size: 7, life: 0.6 });
          break;
        case 'melee':
          this.spark(x, y, Math.round(16 * big), ['#ffffff', '#ffe27a', '#ffb04a'], 150, { glow: true });
          this.chips(x, y, Math.round(4 * big));
          this.light(x, y, 16 * big, '#fff0c0', 0.12, 1);
          this.shake(2.2 * big);
          break;
        case 'explosive':
          this.explosion(x, y, vfx === 'mortar' ? 1.7 : vfx === 'toast' ? 0.8 : 1.0 * (crit ? 1.3 : 1));
          if (vfx === 'toast') {
            for (let i = 0; i < 6; i++) this.pix.push({ x, y, vx: rnd(-60, 60), vy: rnd(-90, -20), life: 0.8, max: 0.8, color: pick(['#d9a35a', '#a8652a', '#f2d29a']), size: 1, g: 300, drag: 0.98, bounce: true });
          }
          break;
        case 'energy':
          this.spark(x, y, Math.round(10 * big), ['#9ff6ff', '#ffffff', '#4ad0ff'], 120, { glow: true, g: 40 });
          this.light(x, y, 18 * big, '#7fe8ff', 0.18, 1);
          this.smoke(x, y, 1, { size: 0.6, color: '#2a3a44', a: 0.4 });
          break;
        case 'fire':
          this.fireBurst(x, y, 6);
          this.light(x, y, 14, '#ff7a2a', 0.2, 0.8);
          break;
        case 'burn':
          this.fireBurst(x, y, 2);
          break;
        case 'acid':
          for (let i = 0; i < 7 * big; i++) this.pix.push({ x, y, vx: rnd(-40, 40), vy: rnd(-60, -10), life: rnd(0.4, 0.8), max: 0.8, color: pick(['#a8ff3a', '#6ad41a', '#e0ff8a']), size: Math.random() < 0.4 ? 2 : 1, g: 260, drag: 0.97, glow: true });
          this.smoke(x, y, 1, { size: 0.6, color: '#7a9a3a', a: 0.35 });
          this.light(x, y, 10, '#a8ff3a', 0.15, 0.6);
          break;
        case 'cryo':
          this.spark(x, y, Math.round(10 * big), ['#ffffff', '#cfeeff', '#8fd8ff'], 80, { g: 120, glow: true });
          this.light(x, y, 14, '#cfeeff', 0.18, 0.9);
          break;
        case 'sonic':
          this.spark(x, y, 3, ['#ff9ae0', '#ffffff'], 40, { g: 0, glow: true });
          break;
        case 'emp':
          this.spark(x, y, 10, ['#ffffff', '#d8dcff', '#8fa8ff'], 90, { g: 0, glow: true });
          this.ring(x, y, '#d8dcff', 22, 0.3, 1.2);
          break;
        case 'gravity':
          this.spark(x, y, 4, ['#c08aff', '#ffffff'], 50, { g: 0, glow: true });
          break;
        default:
          this.spark(x, y, 4, '#cccccc', 60);
      }
    }

    fireBurst(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.pix.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: rnd(-15, 15), vy: rnd(-50, -20), life: rnd(0.25, 0.5), max: 0.5, color: pick(['#ffd25a', '#ff8a2a', '#ff5a1a']), size: Math.random() < 0.4 ? 2 : 1, g: -30, drag: 0.92, glow: true });
      }
      this.glowPuff(x, y, Math.max(1, Math.round(n / 2)), '#ff6a1a', 0.7, 1.5);
    }

    stream(from, to, n, colors, glow, g) {
      const dx = to.x - from.x, dy = to.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < n; i++) {
        const s = rnd(150, 220);
        const a = Math.atan2(dy, dx) + rnd(-0.14, 0.14) - (g ? 0.12 : 0);
        this.pix.push({ x: from.x, y: from.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (d / s) * rnd(0.9, 1.15), max: d / s, color: pick(colors), size: 2, g: g || 0, drag: 0.99, glow: true, flame: true });
      }
      this.light(from.x + dx * 0.5, from.y + dy * 0.5, 18, glow, 0.2, 0.5);
    }

    flameStream(from, to, n) {
      const dx = to.x - from.x, dy = to.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < n; i++) {
        const s = rnd(160, 240);
        const a = Math.atan2(dy, dx) + rnd(-0.16, 0.16);
        this.pix.push({ x: from.x, y: from.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (d / s) * rnd(0.85, 1.15), max: d / s, color: pick(['#fff2a0', '#ffd25a', '#ff8a2a', '#ff5a1a']), size: 2, g: -20, drag: 0.985, glow: true, flame: true });
      }
      this.glowPuff(from.x + dx * 0.5, from.y + dy * 0.5, 3, '#ff7a2a', 1.2, 1.2);
      this.light(from.x + dx * 0.5, from.y + dy * 0.5, 26, '#ff7a2a', 0.25, 0.7);
    }

    muzzle(x, y, color, size) {
      this.light(x, y, 12 * (size || 1), color || '#ffd27a', 0.08, 1);
      this.spark(x, y, 3, ['#fff2c0', color || '#ffd27a'], 60, { g: 0, life: 0.4 });
    }

    projectile(p) {
      p.trailT = 0;
      p.pos = { x: p.from.x, y: p.from.y };
      p.prev = { x: p.from.x, y: p.from.y };
      p.spin = rnd(-12, 12);
      this.projs.push(p);
      return p;
    }
    killProjectile(id, whiff) {
      for (const p of this.projs) {
        if (p.id !== id || p.dead) continue;
        if (whiff) {
          p.whiff = 0.35;
          const vx = (p.pos.x - p.prev.x) || p.dir * 2;
          const vy = (p.pos.y - p.prev.y) || 0;
          const m = Math.hypot(vx, vy) || 1;
          const sp = p.kind === 'mortar' || p.kind === 'toast' || p.kind === 'plunger' || p.kind === 'can' ? 160 : 400;
          p.wv = { x: (vx / m) * sp, y: (vy / m) * sp + 40 };
        } else p.dead = true;
      }
    }

    beam(b) {
      b.max = b.life;
      this.beams.push(b);
    }
    // expanding circle (EMP pulses, phoenix nova, mine blasts)
    ring(x, y, color, maxR, life, width) {
      (this.rings || (this.rings = [])).push({ x, y, color, maxR, life, max: life, width: width || 1 });
    }
    // sonic wave fronts travelling from `from` toward `to`
    sonic(from, to) {
      (this.waves || (this.waves = [])).push(...[0, 0.1, 0.2].map((d) => ({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, delay: d, life: 0.45 + d, max: 0.45 + d })));
      for (let i = 0; i < 3; i++) this.text(U.lerp(from.x, to.x, 0.3 + i * 0.2) + rnd(-6, 6), U.lerp(from.y, to.y, 0.4) - 8 - rnd(0, 10), i % 2 ? '♫' : '♪', { color: '#ff9ae0', size: 9, life: 0.9, vy: -18 });
    }
    // black hole vortex between the mechs
    vortex(x, y, life) {
      (this.vortices || (this.vortices = [])).push({ x, y, life, max: life });
      this.shake(3);
    }
    charge(getPos, color, dur) {
      this.charges.push({ getPos, color, life: dur, max: dur });
    }
    debrisFrom(d, fromX, force) {
      const dir = Math.sign(d.x - fromX) || (Math.random() < 0.5 ? -1 : 1);
      this.debris.push({
        canvas: d.canvas, w: d.w, h: d.h, x: d.x, y: d.y, flip: d.flip,
        vx: dir * rnd(40, 110) * (force || 1), vy: rnd(-170, -90) * (force || 1), rot: 0, vr: rnd(-12, 12),
        rest: this.groundY + rnd(1, 9), grounded: false, smokeT: rnd(4, 8), life: 999,
      });
      this.spark(d.x, d.y, 14, ['#ffd25a', '#ff8a2a', '#ffffff'], 140, { glow: true });
      this.smoke(d.x, d.y, 3, { size: 1, color: '#2a2628' });
    }

    // ---------------- update ----------------
    update(dt, clock) {
      this.time += dt;
      const gy = this.groundY;
      for (const p of this.pix) {
        p.life -= dt;
        p.vy += p.g * dt;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.bounce && p.y > gy + 4 && p.vy > 0) {
          p.y = gy + 4;
          p.vy *= -0.35;
          p.vx *= 0.6;
        }
      }
      this.pix = this.pix.filter((p) => p.life > 0);
      for (const s of this.soft) {
        s.life -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.size += s.grow * dt;
        s.vx *= 0.98;
        s.vy *= 0.985;
      }
      this.soft = this.soft.filter((s) => s.life > 0);
      for (const l of this.lights) l.life -= dt;
      this.lights = this.lights.filter((l) => l.life > 0);
      for (const t of this.texts) {
        t.life -= dt;
        t.y += t.vy * dt;
        t.vy *= 0.94;
      }
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const c of this.callouts) c.life -= dt;
      this.callouts = this.callouts.filter((c) => c.life > 0);
      for (const b of this.beams) b.life -= dt;
      this.beams = this.beams.filter((b) => b.life > 0);
      for (const c of this.charges) c.life -= dt;
      this.charges = this.charges.filter((c) => c.life > 0);
      if (this.rings) {
        for (const r of this.rings) r.life -= dt;
        this.rings = this.rings.filter((r) => r.life > 0);
      }
      if (this.waves) {
        for (const w of this.waves) w.life -= dt;
        this.waves = this.waves.filter((w) => w.life > 0);
      }
      if (this.vortices) {
        for (const v of this.vortices) {
          v.life -= dt;
          // suck particles inward
          if (Math.random() < dt * 60) {
            const a = rnd(0, Math.PI * 2), r = rnd(18, 34);
            this.pix.push({ x: v.x + Math.cos(a) * r, y: v.y + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 1.6, life: 0.38, max: 0.38, color: pick(['#c08aff', '#ffffff', '#6a3aa0']), size: 1, g: 0, drag: 1, glow: true });
          }
        }
        this.vortices = this.vortices.filter((v) => v.life > 0);
      }

      for (const p of this.projs) {
        if (p.dead) continue;
        p.prev.x = p.pos.x;
        p.prev.y = p.pos.y;
        if (p.whiff != null) {
          p.whiff -= dt;
          p.pos.x += p.wv.x * dt;
          p.pos.y += p.wv.y * dt;
          p.wv.y += 300 * dt;
          if (p.pos.y > gy + 6 || p.whiff <= 0) {
            p.dead = true;
            if (p.kind === 'rocket' || p.kind === 'mortar' || p.kind === 'toast') this.explosion(p.pos.x, Math.min(p.pos.y, gy + 4), p.kind === 'mortar' ? 1.1 : 0.6);
            else if (p.pos.y > gy) {
              this.spark(p.pos.x, gy + 3, 4, ['#8a7a6a', '#5a4a3a'], 50, { up: 30 });
              this.smoke(p.pos.x, gy + 2, 1, { size: 0.6, color: '#5a5048', a: 0.4 });
            }
          }
        } else if (p.kind === 'boomerang') {
          // out to the target, then back to the thrower
          const to = p.toFn();
          const home = p.homeFn ? p.homeFn() : p.from;
          if (clock <= p.t1) {
            const k = U.clamp((clock - p.t0) / Math.max(0.01, p.t1 - p.t0), 0, 1);
            p.pos.x = U.lerp(p.from.x, to.x + p.dir * 10, k);
            p.pos.y = U.lerp(p.from.y, to.y, k) - 14 * Math.sin(Math.PI * k);
          } else {
            const k = U.clamp((clock - p.t1) / Math.max(0.01, p.t2 - p.t1), 0, 1);
            p.pos.x = U.lerp(to.x + p.dir * 10, home.x, k);
            p.pos.y = U.lerp(to.y, home.y, k) + 10 * Math.sin(Math.PI * k);
            if (k >= 1) p.dead = true;
          }
        } else {
          const to = p.toFn();
          const k = U.clamp((clock - p.t0) / Math.max(0.01, p.t1 - p.t0), 0, 1);
          const ease = p.kind === 'rocket' || p.kind === 'swarm' ? U.easeInQuad(k) * 0.6 + k * 0.4 : k;
          p.pos.x = U.lerp(p.from.x, to.x, ease);
          p.pos.y = U.lerp(p.from.y, to.y, ease) - (p.arc || 0) * Math.sin(Math.PI * k);
          if (p.kind === 'swarm') p.pos.y += Math.sin(k * 9 + p.spin) * 4 * (1 - k);
          if (p.kind === 'mine' && k >= 1) p.dead = true;
          if (k >= 1 && clock - p.t1 > 0.25) p.dead = true;
        }
        // trails
        p.trailT -= dt;
        if (p.trailT <= 0 && !p.dead) {
          if (p.kind === 'rocket') {
            p.trailT = 0.02;
            this.smoke(p.pos.x, p.pos.y, 1, { size: 0.5, life: 0.6, color: '#8a8488', a: 0.4, rise: 0.2 });
            this.pix.push({ x: p.pos.x, y: p.pos.y, vx: 0, vy: 0, life: 0.1, max: 0.1, color: '#ffd25a', size: 1, g: 0, drag: 1, glow: true });
          } else if (p.kind === 'mortar') {
            p.trailT = 0.04;
            this.smoke(p.pos.x, p.pos.y, 1, { size: 0.45, life: 0.5, color: '#6a6468', a: 0.35, rise: 0.1 });
          } else if (p.kind === 'toast') {
            p.trailT = 0.05;
            this.fireBurst(p.pos.x, p.pos.y, 1);
          } else if (p.kind === 'can') {
            p.trailT = 0.04;
            this.pix.push({ x: p.pos.x, y: p.pos.y, vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.3, max: 0.3, color: '#dff6ff', size: 1, g: 60, drag: 0.95 });
          } else if (p.kind === 'swarm') {
            p.trailT = 0.03;
            this.smoke(p.pos.x, p.pos.y, 1, { size: 0.3, life: 0.4, color: '#a8a0a4', a: 0.35, rise: 0.1 });
          } else if (p.kind === 'smoke') {
            p.trailT = 0.04;
            this.smoke(p.pos.x, p.pos.y, 1, { size: 0.5, life: 0.7, color: '#8a8488', a: 0.4, rise: 0.2 });
          } else if (p.kind === 'boomerang') {
            p.trailT = 0.05;
            this.pix.push({ x: p.pos.x, y: p.pos.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.2, max: 0.2, color: '#fff6c0', size: 1, g: 0, drag: 1, glow: true });
          } else p.trailT = 1;
        }
      }
      this.projs = this.projs.filter((p) => !p.dead);

      for (const d of this.debris) {
        if (!d.grounded) {
          d.vy += 340 * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.rot += d.vr * dt;
          if (d.x < 8 || d.x > R.W - 8) {
            d.vx *= -0.5;
            d.x = U.clamp(d.x, 8, R.W - 8);
          }
          if (d.y > d.rest && d.vy > 0) {
            d.y = d.rest;
            d.vy *= -0.32;
            d.vx *= 0.55;
            d.vr *= 0.5;
            this.spark(d.x, d.y + 2, 3, ['#8a7a6a', '#5a4a3a'], 40, { up: 30 });
            if (Math.abs(d.vy) < 30) {
              d.grounded = true;
              d.rot = Math.round(d.rot / (Math.PI / 2)) * (Math.PI / 2) + rnd(-0.25, 0.25);
            }
          }
        } else if (d.smokeT > 0) {
          d.smokeT -= dt;
          if (Math.random() < dt * 3) this.smoke(d.x, d.y - 2, 1, { size: 0.6, color: '#2e2a2c', a: 0.4, life: 1.2 });
        }
      }
      if (this.debris.length > 40) this.debris.splice(0, this.debris.length - 40);

      this.shakeA = Math.max(0, this.shakeA - dt * 18);
      this.flashA = Math.max(0, this.flashA - dt * 3);
      const s = this.shakeA * (R.scale / 3);
      R.shakeX = s > 0.05 ? rnd(-s, s) * 1.4 : 0;
      R.shakeY = s > 0.05 ? rnd(-s, s) : 0;
    }

    // ---------------- drawing ----------------
    drawDebris(ctx) {
      for (const d of this.debris) {
        ctx.save();
        ctx.translate(Math.round(d.x), Math.round(d.y));
        ctx.rotate(d.rot);
        if (d.flip) ctx.scale(-1, 1);
        ctx.globalAlpha = 1;
        ctx.drawImage(d.canvas, -Math.round(d.w / 2), -Math.round(d.h / 2));
        ctx.restore();
      }
    }
    drawWorld(ctx) {
      for (const p of this.pix) {
        if (p.life < 0.08 && Math.random() < 0.5) continue;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      for (const p of this.projs) this.drawProj(ctx, p);
    }
    drawProj(ctx, p) {
      const x = Math.round(p.pos.x), y = Math.round(p.pos.y);
      const ang = Math.atan2(p.pos.y - p.prev.y, p.pos.x - p.prev.x || p.dir * 0.001);
      ctx.save();
      ctx.translate(x, y);
      switch (p.kind) {
        case 'bullet': {
          ctx.rotate(ang);
          ctx.fillStyle = '#fff6d0';
          ctx.fillRect(-4, 0, 5, 1);
          ctx.fillStyle = '#ffc04a';
          ctx.fillRect(-7, 0, 3, 1);
          break;
        }
        case 'pellet':
          ctx.fillStyle = '#ffe9a0';
          ctx.fillRect(0, 0, 1, 1);
          ctx.fillStyle = 'rgba(255,200,90,0.6)';
          ctx.fillRect(-p.dir, 0, 1, 1);
          break;
        case 'plunger':
          ctx.rotate(ang);
          ctx.fillStyle = '#7b5637';
          ctx.fillRect(-6, 0, 6, 1);
          ctx.fillStyle = '#d63b35';
          ctx.fillRect(0, -2, 2, 5);
          break;
        case 'rocket':
          ctx.rotate(ang);
          ctx.fillStyle = '#5cba62';
          ctx.fillRect(-3, -1, 4, 2);
          ctx.fillStyle = '#d63b35';
          ctx.fillRect(1, -1, 1, 2);
          ctx.fillStyle = '#ffd25a';
          ctx.fillRect(-5, 0, 2, 1);
          break;
        case 'mortar':
          ctx.fillStyle = '#2a2a30';
          ctx.fillRect(-1, -1, 3, 3);
          ctx.fillStyle = '#6c7480';
          ctx.fillRect(-1, -1, 1, 1);
          break;
        case 'toast':
          ctx.rotate(p.spin * (this.time % 10));
          ctx.fillStyle = '#7a4a1a';
          ctx.fillRect(-2, -2, 4, 4);
          ctx.fillStyle = '#e0b060';
          ctx.fillRect(-1, -1, 2, 2);
          break;
        case 'can':
          ctx.rotate(p.spin * (this.time % 10));
          ctx.fillStyle = p.color || '#d63b35';
          ctx.fillRect(-1, -2, 3, 4);
          ctx.fillStyle = '#dde5ec';
          ctx.fillRect(-1, -2, 3, 1);
          break;
        case 'nail':
          ctx.rotate(ang);
          ctx.fillStyle = '#d8dce4';
          ctx.fillRect(-3, 0, 4, 1);
          ctx.fillStyle = '#6c7480';
          ctx.fillRect(-4, 0, 1, 1);
          break;
        case 'revolver':
          ctx.rotate(ang);
          ctx.fillStyle = '#fff2b0';
          ctx.fillRect(-5, 0, 6, 1);
          ctx.fillStyle = '#e9bb4c';
          ctx.fillRect(-9, 0, 4, 1);
          break;
        case 'harpoon':
          ctx.rotate(ang);
          ctx.fillStyle = '#7b5637';
          ctx.fillRect(-8, 0, 7, 1);
          ctx.fillStyle = '#c8ccd4';
          ctx.fillRect(-1, -1, 3, 3);
          ctx.fillRect(2, 0, 1, 1);
          break;
        case 'swarm':
          ctx.rotate(ang);
          ctx.fillStyle = '#d63b35';
          ctx.fillRect(-2, 0, 3, 1);
          ctx.fillStyle = '#ffd25a';
          ctx.fillRect(-3, 0, 1, 1);
          break;
        case 'smoke':
          ctx.rotate(p.spin * (this.time % 10) * 0.3);
          ctx.fillStyle = '#5c5f66';
          ctx.fillRect(-1, -2, 3, 4);
          ctx.fillStyle = '#e8b820';
          ctx.fillRect(-1, -1, 3, 1);
          break;
        case 'mine':
          ctx.fillStyle = '#3c414c';
          ctx.fillRect(-2, -1, 5, 2);
          ctx.fillStyle = '#ff4a3a';
          ctx.fillRect(0, -2, 1, 1);
          break;
        case 'boomerang': {
          const a = this.time * 30;
          ctx.rotate(a);
          ctx.fillStyle = '#c8c5bc';
          ctx.fillRect(-2, -2, 5, 5);
          ctx.fillStyle = '#f2efe6';
          ctx.fillRect(-3, 0, 1, 1);
          ctx.fillRect(3, 0, 1, 1);
          ctx.fillRect(0, -3, 1, 1);
          ctx.fillRect(0, 3, 1, 1);
          ctx.fillStyle = '#3c414c';
          ctx.fillRect(0, 0, 1, 1);
          break;
        }
      }
      ctx.restore();
    }

    drawScreen() {
      const v = R.vctx;
      // smoke (normal blend)
      for (const s of this.soft) {
        if (s.add) continue;
        const k = s.life / s.max;
        const r = s.size * R.scale;
        v.globalAlpha = s.a * Math.min(1, k * 1.5) * Math.min(1, (1 - k) * 6 + 0.2);
        v.drawImage(R.puffSprite(s.color), R.sx(s.x) - r, R.sy(s.y) - r, r * 2, r * 2);
      }
      v.globalAlpha = 1;
      v.globalCompositeOperation = 'lighter';
      for (const s of this.soft) {
        if (!s.add) continue;
        const k = s.life / s.max;
        const r = s.size * R.scale;
        v.globalAlpha = s.a * k;
        v.drawImage(R.glowSprite(s.color), R.sx(s.x) - r, R.sy(s.y) - r, r * 2, r * 2);
      }
      // glowing pixel particles get a soft halo
      for (const p of this.pix) {
        if (!p.glow) continue;
        const r = (p.flame ? 5 : 3) * R.scale;
        v.globalAlpha = Math.min(1, p.life / p.max) * (p.flame ? 0.35 : 0.5);
        v.drawImage(R.glowSprite(p.color), R.sx(p.x + 0.5) - r, R.sy(p.y + 0.5) - r, r * 2, r * 2);
      }
      const PGLOW = { rocket: '#ffb04a', toast: '#ffb04a', swarm: '#ff9a4a', bullet: '#ffe08a', pellet: '#ffe08a', revolver: '#ffd76a', nail: '#c8d0dc', boomerang: '#fff6c0', mine: '#ff4a3a' };
      for (const p of this.projs) {
        const col = PGLOW[p.kind];
        if (!col) continue;
        const r = (p.kind === 'rocket' ? 8 : p.kind === 'boomerang' ? 7 : 4) * R.scale;
        v.globalAlpha = 0.7;
        v.drawImage(R.glowSprite(col), R.sx(p.pos.x) - r, R.sy(p.pos.y) - r, r * 2, r * 2);
      }
      v.globalCompositeOperation = 'source-over';
      // harpoon ropes
      for (const p of this.projs) {
        if (p.kind !== 'harpoon' || !p.ropeFn) continue;
        const o = p.ropeFn();
        if (!o) continue;
        v.globalAlpha = 0.9;
        v.strokeStyle = '#8a6a44';
        v.lineWidth = Math.max(1, R.scale * 0.6);
        v.beginPath();
        v.moveTo(R.sx(o.x), R.sy(o.y));
        v.quadraticCurveTo(R.sx((o.x + p.pos.x) / 2), R.sy((o.y + p.pos.y) / 2 + 6), R.sx(p.pos.x), R.sy(p.pos.y));
        v.stroke();
      }
      // black hole vortices
      if (this.vortices) {
        for (const vx of this.vortices) {
          const k = vx.life / vx.max;
          const grow = Math.min(1, (1 - k) * 4) * Math.min(1, k * 3);
          const r = 14 * grow * R.scale;
          v.globalAlpha = 1;
          v.globalCompositeOperation = 'lighter';
          v.drawImage(R.glowSprite('#9a5aff'), R.sx(vx.x) - r * 2.4, R.sy(vx.y) - r * 2.4, r * 4.8, r * 4.8);
          v.globalCompositeOperation = 'source-over';
          v.fillStyle = '#05020a';
          v.beginPath();
          v.arc(R.sx(vx.x), R.sy(vx.y), r * 0.7, 0, Math.PI * 2);
          v.fill();
          v.strokeStyle = 'rgba(220,180,255,0.8)';
          v.lineWidth = R.scale * 0.6;
          v.beginPath();
          v.arc(R.sx(vx.x), R.sy(vx.y), r * 0.78, this.time * 6, this.time * 6 + Math.PI * 1.4);
          v.stroke();
        }
      }
      v.globalCompositeOperation = 'lighter';
      // expanding rings
      if (this.rings) {
        for (const rg of this.rings) {
          const k = 1 - rg.life / rg.max;
          v.globalAlpha = (1 - k) * 0.9;
          v.strokeStyle = rg.color;
          v.lineWidth = rg.width * R.scale * (1.5 - k);
          v.beginPath();
          v.arc(R.sx(rg.x), R.sy(rg.y), Math.max(1, rg.maxR * U.easeOutCubic(k) * R.scale), 0, Math.PI * 2);
          v.stroke();
        }
      }
      // sonic wavefronts
      if (this.waves) {
        for (const w of this.waves) {
          const age = w.max - w.life - w.delay;
          if (age < 0) continue;
          const k = U.clamp(age / 0.45, 0, 1);
          const dx = w.to.x - w.from.x, dy = w.to.y - w.from.y;
          const dist = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx);
          v.globalAlpha = (1 - k) * 0.85;
          v.strokeStyle = '#ff9ae0';
          v.lineWidth = R.scale * 1.1;
          v.beginPath();
          v.arc(R.sx(w.from.x), R.sy(w.from.y), Math.max(1, dist * k * R.scale), ang - 0.45, ang + 0.45);
          v.stroke();
        }
      }
      for (const l of this.lights) {
        const r = l.r * R.scale;
        v.globalAlpha = l.a * (l.life / l.max);
        v.drawImage(R.glowSprite(l.color), R.sx(l.x) - r, R.sy(l.y) - r, r * 2, r * 2);
      }
      for (const c of this.charges) {
        const pos = c.getPos();
        if (!pos) continue;
        const k = 1 - c.life / c.max;
        const r = (4 + k * 14) * R.scale * (1 + Math.sin(this.time * 40) * 0.08);
        v.globalAlpha = 0.4 + k * 0.6;
        v.drawImage(R.glowSprite(c.color), R.sx(pos.x) - r, R.sy(pos.y) - r, r * 2, r * 2);
        v.drawImage(R.glowSprite('#ffffff'), R.sx(pos.x) - r * 0.3, R.sy(pos.y) - r * 0.3, r * 0.6, r * 0.6);
      }
      // beams
      for (const b of this.beams) this.drawBeam(v, b);
      v.globalAlpha = 1;
      v.globalCompositeOperation = 'source-over';

      // texts
      for (const t of this.texts) {
        const k = t.life / t.max;
        const age = t.max - t.life;
        const pop = age < 0.12 ? 1 + (1 - age / 0.12) * (t.crit ? 0.9 : 0.4) : 1;
        R.text(t.str, t.x, t.y, { size: t.size * pop, color: t.color, alpha: Math.min(1, k * 3), stroke: t.stroke });
      }
      for (const c of this.callouts) {
        const age = c.max - c.life;
        const k = c.life / c.max;
        const sc = age < 0.15 ? U.easeOutBack(age / 0.15) : 1;
        const y = c.y - age * 6;
        const w = (c.str.length * 6.2 + 16) * sc;
        c.x = U.clamp(c.x, w / 2 + 4, R.W - w / 2 - 4);
        v.globalAlpha = Math.min(1, k * 3) * 0.75;
        v.fillStyle = '#120c10';
        v.fillRect(R.sx(c.x - w / 2), R.sy(y - 7), w * R.scale, 14 * R.scale);
        v.fillStyle = c.color;
        v.fillRect(R.sx(c.x - w / 2), R.sy(y - 7), w * R.scale, 1.2 * R.scale);
        v.fillRect(R.sx(c.x - w / 2), R.sy(y + 7) - 1.2 * R.scale, w * R.scale, 1.2 * R.scale);
        v.globalAlpha = 1;
        R.text(c.str, c.x, y, { size: 13 * sc, color: c.color, alpha: Math.min(1, k * 3) });
      }
      if (this.flashA > 0) {
        v.globalAlpha = this.flashA * 0.6;
        v.fillStyle = this.flashColor;
        v.fillRect(0, 0, R.view.width, R.view.height);
        v.globalAlpha = 1;
      }
    }

    drawBeam(v, b) {
      const k = b.life / b.max;
      const x1 = R.sx(b.x1), y1 = R.sy(b.y1), x2 = R.sx(b.x2), y2 = R.sy(b.y2);
      const S = R.scale;
      v.lineCap = 'round';
      if (b.kind === 'tesla' || b.kind === 'arc') {
        const segs = b.kind === 'tesla' ? 9 : 6;
        for (let pass = 0; pass < 2; pass++) {
          v.beginPath();
          v.moveTo(x1, y1);
          for (let i = 1; i < segs; i++) {
            const t = i / segs;
            v.lineTo(U.lerp(x1, x2, t) + rnd(-6, 6) * S, U.lerp(y1, y2, t) + rnd(-6, 6) * S);
          }
          v.lineTo(x2, y2);
          v.strokeStyle = pass ? '#ffffff' : b.color;
          v.lineWidth = (pass ? 0.8 : 2.6) * S;
          v.globalAlpha = (pass ? 1 : 0.55) * Math.min(1, k * 2);
          v.stroke();
        }
      } else if (b.kind === 'rope') {
        v.globalCompositeOperation = 'source-over';
        v.beginPath();
        v.moveTo(x1, y1);
        v.lineTo(x2, y2);
        v.strokeStyle = '#8a6a44';
        v.globalAlpha = Math.min(1, k * 2);
        v.lineWidth = Math.max(1, S * 0.7);
        v.stroke();
        v.globalCompositeOperation = 'lighter';
      } else if (b.kind === 'cryo') {
        const segs = 8;
        v.beginPath();
        v.moveTo(x1, y1);
        for (let i = 1; i <= segs; i++) {
          const t = i / segs;
          v.lineTo(U.lerp(x1, x2, t), U.lerp(y1, y2, t) + Math.sin(t * 14 + this.time * 30) * 1.5 * S);
        }
        v.strokeStyle = '#8fd8ff';
        v.globalAlpha = 0.5 * k;
        v.lineWidth = 4 * S;
        v.stroke();
        v.strokeStyle = '#ffffff';
        v.globalAlpha = k;
        v.lineWidth = 1.2 * S;
        v.stroke();
      } else {
        const w = b.width || 1;
        v.beginPath();
        v.moveTo(x1, y1);
        v.lineTo(x2, y2);
        v.strokeStyle = b.color;
        v.globalAlpha = 0.35 * k;
        v.lineWidth = w * 5 * S;
        v.stroke();
        v.globalAlpha = 0.8 * k;
        v.lineWidth = w * 2 * S;
        v.stroke();
        v.strokeStyle = '#ffffff';
        v.globalAlpha = k;
        v.lineWidth = w * 0.8 * S;
        v.stroke();
      }
      v.globalAlpha = 1;
    }
  }

  P.FX = FX;
})();
