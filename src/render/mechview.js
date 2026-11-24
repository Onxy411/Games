// Part-Time Pilot — assembles and animates a mech from its parts.
// Drawn into the low-res world buffer. Records world positions of parts/muzzles/glows every frame
// so effects (projectiles, damage numbers, bloom) can attach to the right spot.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;

  const FACES = {
    happy: ['.X....X.', '........', '.X....X.', '..XXXX..'],
    worried: ['.X....X.', '........', '........', '..XXXX..'],
    panic: ['XX....XX', 'XX....XX', '...XX...', '...XX...'],
    dead: ['X.X..X.X', '.X....X.', 'X.X..X.X', '..XXXX..'],
    win: ['.X....X.', 'X.X..X.X', '........', '.XXXXXX.'],
  };

  class MechView {
    constructor(build, opts) {
      opts = opts || {};
      this.facing = opts.facing || 1;
      this.x = opts.x || 0;
      this.y = opts.y || 0;
      this.t = Math.random() * 10;
      this.walk = 0;
      this.vx = 0;
      this.prevX = null;
      this.fall = 0;
      this.fallT = -1;
      this.fallDur = 1.2;
      this.victory = false;
      this.ko = false;
      this.koT = 0;
      this.koLean = 0;
      this.hop = 0;
      this.jolt = 0;
      this.bodyLunge = null;
      this.pos = {};
      this.muzzles = {};
      this.stumps = {};
      this.lights = [];
      this.thrusters = [];
      this.dronePos = null;
      this.droneTarget = null;
      this.droneUntil = 0;
      this.stuck = {};
      this.mood = 1;
      this.phase2 = false;
      this.topY = this.y - 50;
      this.setBuild(build);
    }

    setBuild(build) {
      this.build = build;
      this.paint = P.PAINTS_BY_ID[build.paint] || P.PAINTS[0];
      this.parts = {};
      const slots = P.slotsFor(build.parts.chassis ? build.parts.chassis.id : null);
      for (const key of slots) {
        const it = build.parts[key];
        if (!it) continue;
        const def = P.PARTS[it.id];
        if (!def || P.slotCat(key) !== def.cat) continue;
        this.parts[key] = { key, def, item: it, hpFrac: 1, destroyed: false, flash: 0, recoil: 0, lunge: null, limbsLost: 0, spinUntil: 0 };
      }
      this.chassisSpr = this.parts.chassis ? this.spr(this.parts.chassis) : null;
    }

    spr(part, frame) {
      let d = part.def;
      // Ditto Arm shows a purple holographic copy of the opposite arm
      if (d.mirror) {
        const other = this.parts[part.key === 'armR' ? 'armL' : 'armR'];
        if (other && other.def.weapon && !other.def.mirror) {
          const od = other.def;
          const k = od.spriteFrames ? od.spriteFrames[(frame || 0) % od.spriteFrames.length] : od.sprite;
          return P.Pixel.get(k, MechView.HOLO, { glow: '#d0b8ff' });
        }
      }
      const key = d.spriteFrames ? d.spriteFrames[(frame || 0) % d.spriteFrames.length] : d.sprite || d.trinket;
      return key ? P.Pixel.get(key, this.paint, d) : null;
    }

    hasRepairDrone() {
      for (const k in this.parts) {
        const p = this.parts[k];
        if (!p.destroyed && p.def.utility && p.def.utility.kind === 'repair') return true;
      }
      return false;
    }

    // ---------------- animation hooks ----------------
    update(dt) {
      this.t += dt;
      if (this.prevX != null && dt > 0) {
        const v = (this.x - this.prevX) / dt;
        this.vx = U.lerp(this.vx, U.clamp(v, -200, 200), 0.35);
      }
      this.prevX = this.x;
      this.walk += Math.abs(this.vx) * dt * 0.9;
      for (const k in this.parts) {
        const p = this.parts[k];
        if (p.flash > 0) p.flash -= dt;
        if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 8);
      }
      if (this.jolt > 0) this.jolt = Math.max(0, this.jolt - dt * 10);
      if (this.hop > 0) this.hop = Math.max(0, this.hop - dt * 30);
      if (this.fallT >= 0) {
        this.fallT += dt;
        const k = this.fallT, d = this.fallDur, F = 1.3;
        if (k < 0.2) this.fall = F * U.easeInQuad(k / 0.2);
        else if (k < d - 0.35) this.fall = F + Math.sin((k - 0.2) * 30) * 0.04 * Math.max(0, 1 - (k - 0.2) * 3);
        else if (k < d) this.fall = F * (1 - U.easeOutCubic((k - (d - 0.35)) / 0.35));
        else {
          this.fall = 0;
          this.fallT = -1;
        }
      }
      if (this.ko) {
        this.koT += dt;
        this.koLean = Math.min(0.45, this.koT * 1.2);
      }
    }

    onFire(key, vfx, dist) {
      if (key === 'ram') {
        this.bodyLunge = { t0: this.t, dur: 0.25, dist: U.clamp(dist - 30, 4, 16) };
        return;
      }
      const p = this.parts[key];
      if (!p) return;
      const melee = { claw: 0.24, saw: 0.08, drill: 0.2, glove: 0.18, ball: 0.38, hammer: 0.34 };
      if (melee[vfx] != null) {
        p.lunge = { t0: this.t, dur: Math.max(0.12, melee[vfx]), dist: U.clamp((dist || 50) - 32, 3, vfx === 'glove' ? 30 : vfx === 'ball' ? 34 : vfx === 'hammer' ? 12 : 22), vfx };
        if (vfx === 'saw') p.spinUntil = this.t + 0.5;
      } else {
        p.recoil = 1;
      }
    }
    onHit(key, big) {
      const p = this.parts[key];
      if (p) p.flash = 0.09;
      this.jolt = big ? 1 : 0.5;
    }
    setHp(key, frac) {
      const p = this.parts[key];
      if (p) p.hpFrac = frac;
      if (key === 'chassis') this.mood = frac;
    }
    stumble(dur) {
      this.fallT = 0;
      this.fallDur = Math.max(0.7, dur);
    }

    // Returns debris descriptors [{canvas, x, y, rot, flip}] for things that fly off
    destroyPart(key) {
      const p = this.parts[key];
      if (!p || p.destroyed) return [];
      const out = [];
      const pos = this.pos[key] || { x: this.x, y: this.y - 20 };
      if (key === 'legs') {
        const t = p.def.legs.type;
        const s = this.spr(p);
        const remaining = Math.max(1, (p.def.legs.limbs || 1) - p.limbsLost);
        const n = t === 'biped' || t === 'pogo' || t === 'quad' ? remaining : 1;
        for (let i = 0; i < n; i++) out.push({ canvas: s.canvas, x: pos.x + (i - n / 2) * 4, y: pos.y, w: s.w, h: s.h, flip: this.facing < 0 });
      } else {
        const s = this.spr(p);
        if (s) out.push({ canvas: s.canvas, x: pos.x, y: pos.y, w: s.w, h: s.h, flip: this.facing < 0 });
      }
      p.destroyed = true;
      p.hpFrac = 0;
      return out;
    }
    loseLimb(n) {
      const p = this.parts.legs;
      if (!p) return [];
      const before = p.limbsLost;
      p.limbsLost = n;
      if (n <= before) return [];
      const s = this.spr(p);
      const pos = this.pos.legs || { x: this.x, y: this.y - 8 };
      return [{ canvas: s.canvas, x: pos.x + this.facing * 3, y: pos.y, w: s.w, h: s.h, flip: this.facing < 0 }];
    }

    // ---------------- drawing ----------------
    drawSprite(ctx, s, x, y, rot, variant, part, key, flip) {
      if (!s) return;
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (flip) ctx.scale(-1, 1);
      const dx = -s.pivot[0], dy = -s.pivot[1];
      ctx.drawImage(variant === 'dark' ? s.dark : s.canvas, dx, dy);
      if (part) {
        if (part.hpFrac < 0.6 && !part.destroyed) {
          ctx.globalAlpha = Math.min(1, (0.6 - part.hpFrac) / 0.45);
          ctx.drawImage(s.soot, dx, dy);
        }
        if (part.flash > 0) {
          ctx.globalAlpha = Math.min(1, part.flash / 0.05);
          ctx.drawImage(s.flash, dx, dy);
        }
        ctx.globalAlpha = 1;
      }
      if (key) {
        const m = ctx.getTransform();
        const tp = (px, py) => ({ x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f });
        this.pos[key] = tp(dx + s.w / 2, dy + s.h / 2);
        if (s.muzzle) this.muzzles[key] = tp(dx + s.muzzle[0] + 0.5, dy + s.muzzle[1] + 0.5);
        if (s.glow && !(part && part.destroyed)) {
          const g = tp(dx + s.glow.x, dy + s.glow.y);
          this.lights.push({ x: g.x, y: g.y, color: s.glow.color, r: 6, a: 0.55 });
        }
        if (this._screenHook && this._screenHook.key === key) this._screenHook.fn(ctx, dx, dy, s, tp);
      }
      ctx.restore();
    }

    drawFace(ctx, ox, oy, rect, color) {
      let face = 'happy';
      if (this.ko) face = 'dead';
      else if (this.victory) face = 'win';
      else if (this.mood < 0.3) face = 'panic';
      else if (this.mood < 0.6) face = 'worried';
      const f = FACES[face];
      const sx = ox + rect[0], sy = oy + rect[1] + Math.max(0, Math.floor((rect[3] - 4) / 2));
      ctx.fillStyle = this.mood < 0.3 && !this.victory ? '#ff5a4a' : color;
      for (let r = 0; r < f.length; r++) for (let c = 0; c < 8 && c < rect[2]; c++) if (f[r][c] === 'X') ctx.fillRect(sx + c, sy + r, 1, 1);
    }

    drawShadow(ctx, gx, gy, lift) {
      const cs = this.chassisSpr;
      const w = (cs ? cs.w : 20) + 6;
      const hover = this.parts.legs && !this.parts.legs.destroyed && this.parts.legs.def.legs.type === 'hover';
      const k = U.clamp(1 + lift / 30 - (hover ? 0.3 : 0), 0.4, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.38 * k})`;
      ctx.beginPath();
      ctx.ellipse(gx, gy, (w / 2) * k, 2.5 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    draw(ctx) {
      this.lights.length = 0;
      this.thrusters.length = 0;
      const p = this.parts;
      const t = this.t;
      if (!this.chassisSpr) return;
      const legs = p.legs && !p.legs.destroyed ? p.legs : null;
      const lt = legs ? legs.def.legs.type : null;
      const moving = Math.abs(this.vx) > 2.5 && !this.ko && this.fallT < 0;

      let lift = 0;
      if (lt === 'pogo' && !this.ko) lift += Math.round(Math.abs(Math.sin(t * 7)) * 5);
      if (this.victory && !this.ko) lift += Math.round(Math.abs(Math.sin(t * 6)) * 4);
      if (lt === 'biped' && legs.limbsLost >= 1 && moving) lift += Math.round(Math.abs(Math.sin(this.walk * 0.25)) * 3);
      lift += Math.round(this.hop);

      let gx = Math.round(this.x);
      const gy = Math.round(this.y);
      if (this.bodyLunge) {
        const L = this.bodyLunge, k = (t - L.t0) / L.dur;
        if (k > 1.4) this.bodyLunge = null;
        else gx += Math.round(this.facing * (k < 1 ? L.dist * U.easeInQuad(k) : L.dist * (1 - (k - 1) / 0.4)));
      }
      if (this.jolt > 0) gx -= Math.round(this.facing * this.jolt);

      this.drawShadow(ctx, gx, gy, lift);
      ctx.save();
      ctx.translate(gx, gy - lift);
      if (this.facing < 0) ctx.scale(-1, 1);
      if (this.fall) {
        ctx.translate(-8, 0);
        ctx.rotate(-this.fall);
        ctx.translate(8, 0);
      }
      if (this.koLean) {
        ctx.translate(8, 0);
        ctx.rotate(this.koLean);
        ctx.translate(-8, 0);
      }

      // ---- legs ----
      let hipY = -1, overlap = 0, tilt = 0, bob = 0;
      if (legs) {
        const frame = lt === 'treads' ? Math.floor(this.walk / 2) : 0;
        const ls = this.spr(legs, frame);
        const legH = ls.rows - (ls.pivot[1] - 1);
        const sw = moving ? Math.sin(this.walk * 0.35) : 0;
        if (lt === 'biped' || lt === 'pogo') {
          hipY = -legH;
          overlap = 3;
          const lost = legs.limbsLost;
          if (lost < 2) this.drawSprite(ctx, ls, -3, hipY, sw * 0.32, 'dark', legs, 'legs');
          if (lost < 1) this.drawSprite(ctx, ls, 3, hipY, -sw * 0.32, null, legs, 'legs');
          if (lost >= 1) {
            hipY += 2;
            tilt = -0.14 + Math.sin(t * 5) * 0.05;
          }
          if (!moving && lt === 'biped') bob = Math.round(Math.sin(t * 2.2) * 0.6);
          if (legs.def.legs.rush && moving) {
            const m = ctx.getTransform();
            for (const fx of [-6, 0]) this.thrusters.push({ x: m.a * fx + m.e, y: m.f - 1, rocket: true });
          }
        } else if (lt === 'quad') {
          hipY = -legH + 1;
          overlap = 4;
          const lost = legs.limbsLost;
          const L = [
            { x: 2, flip: true, dark: true, ph: 0 },
            { x: 3, flip: false, dark: true, ph: 1 },
            { x: -3, flip: true, dark: false, ph: 1 },
            { x: 4, flip: false, dark: false, ph: 0 },
          ];
          const lostSet = new Set([3, 2, 1, 0].slice(0, lost));
          L.forEach((l, i) => {
            if (lostSet.has(i)) return;
            const ang = (moving ? Math.sin(this.walk * 0.45 + l.ph * Math.PI) * 0.25 : Math.sin(t * 2 + i) * 0.03) * (l.flip ? -1 : 1);
            this.drawSprite(ctx, ls, l.x, hipY, ang, l.dark ? 'dark' : null, legs, 'legs', l.flip);
          });
          if (lost >= 2) tilt = -0.08;
        } else if (lt === 'treads') {
          hipY = -legH;
          overlap = 2;
          this.drawSprite(ctx, ls, moving ? (Math.floor(t * 20) % 2) * 0 : 0, hipY, 0, null, legs, 'legs');
        } else if (lt === 'hover') {
          const hb = Math.round(Math.sin(t * 3) * 1.5);
          hipY = -(ls.rows + 5) + hb;
          overlap = 2;
          this.drawSprite(ctx, ls, 0, hipY, moving ? -0.06 * Math.sign(this.vx) * this.facing : 0, null, legs, 'legs');
          const m = ctx.getTransform();
          for (const fx of [-6, 6]) {
            const px = fx, py = hipY + ls.rows;
            this.thrusters.push({ x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f });
          }
        }
      } else {
        hipY = -1;
        overlap = 0;
        tilt = 0.06;
      }

      // ---- upper body ----
      ctx.save();
      ctx.translate(0, hipY + overlap + bob);
      if (tilt) ctx.rotate(tilt);
      const cs = this.chassisSpr;
      const A = cs.anchors;
      const pv = cs.pivot;
      const rel = (a) => [a[0] - pv[0], a[1] - pv[1]];
      const mountAnchor = (i) => {
        const m = A.mounts && A.mounts[i];
        if (m) return { pos: rel(m), layer: m[2] || 'front' };
        return { pos: [-6 - i * 5, -cs.h + 4 - i * 3], layer: 'back' };
      };

      // back arm
      if (p.armL) {
        if (!p.armL.destroyed) this.drawArm(ctx, p.armL, rel(A.shB), true);
        else this.markStump(ctx, 'armL', rel(A.shB));
      }
      // mounts (back layer)
      const mountKeys = Object.keys(p).filter((k) => k.startsWith('mount')).sort();
      const drawMount = (k, layerWanted) => {
        const part = p[k];
        const i = Number(k.slice(5));
        const ma = mountAnchor(i);
        const layer = part.def.layer === 'back' ? 'back' : ma.layer;
        if (layer !== layerWanted) return;
        if (part.destroyed) return this.markStump(ctx, k, ma.pos);
        const s = this.spr(part);
        let ox = ma.pos[0] - Math.round(part.recoil * 1.5);
        const oy = ma.pos[1] + Math.round(part.recoil);
        this.drawSprite(ctx, s, ox, oy, 0, layer === 'back' ? 'dark' : null, part, k);
      };
      for (const k of mountKeys) drawMount(k, 'back');

      // chassis
      const ch = p.chassis;
      if (A.screen) {
        this._screenHook = { key: 'chassis', fn: (c, dx, dy) => this.drawFace(c, dx, dy, A.screen, '#ff7ae0') };
      }
      this.drawSprite(ctx, cs, 0, 0, 0, null, ch, 'chassis');
      this._screenHook = null;

      // trinkets (visible modules)
      let tri = 0;
      for (const k in p) {
        if (!k.startsWith('module')) continue;
        const d = p[k].def;
        if (!d.trinket || !A.deco) continue;
        const s = this.spr(p[k]);
        const a = rel(A.deco);
        this.drawSprite(ctx, s, a[0] - tri * 5, a[1], Math.sin(t * 3 + tri) * 0.35 + (this.vx * this.facing) * -0.01, null, null, null);
        tri++;
      }

      // Mimic hologram: a flickering copy of the opponent's weapon hovering over the chassis
      if (this.mimicDef && !this.ko) {
        const ms = P.Pixel.get(this.mimicDef.sprite, MechView.HOLO, { glow: '#d0b8ff' });
        if (ms) {
          ctx.globalAlpha = 0.55 + 0.3 * Math.abs(Math.sin(t * 9));
          const n = rel(A.neck);
          this.drawSprite(ctx, ms, n[0] - 12, n[1] - 10 + Math.round(Math.sin(t * 2.5)), 0, null, null, 'mimic');
          ctx.globalAlpha = 1;
          this.lights.push({ x: this.pos.mimic.x, y: this.pos.mimic.y, color: '#c08aff', r: 9, a: 0.45 });
        }
      }

      // head
      if (p.head) {
        const n = rel(A.neck);
        if (!p.head.destroyed) {
          const hs = this.spr(p.head);
          const hb = Math.round(Math.sin(t * 2.2 - 0.7) * 0.6);
          let hr = Math.sin(t * 1.7) * 0.03;
          if (this.ko) hr = 0.5;
          if (this.victory) hr = Math.sin(t * 8) * 0.15;
          const sp = p.head.def.special;
          if (sp === 'crt' && hs.screen) this._screenHook = { key: 'head', fn: (c, dx, dy) => this.drawFace(c, dx, dy, hs.screen, '#8aff9a') };
          if (sp === 'traffic' && hs.lightsAt) {
            this._screenHook = {
              key: 'head',
              fn: (c, dx, dy, s, tp) => {
                const which = this.ko ? null : this.mood > 0.6 ? 'green' : this.mood > 0.3 ? 'yellow' : 'red';
                if (!which) return;
                const col = which === 'green' ? '#7dff6a' : which === 'yellow' ? '#ffe04a' : '#ff4a3a';
                const L = hs.lightsAt[which];
                c.fillStyle = col;
                c.fillRect(dx + L[0], dy + L[1], 2, 2);
                const g = tp(dx + L[0] + 1, dy + L[1] + 1);
                this.lights.push({ x: g.x, y: g.y, color: col, r: 7, a: 0.7 });
              },
            };
          }
          this.drawSprite(ctx, hs, n[0], n[1] + hb, hr, null, p.head, 'head');
          this._screenHook = null;
        } else this.markStump(ctx, 'head', n);
      }

      // mounts (front layer)
      for (const k of mountKeys) drawMount(k, 'front');

      // front arm
      if (p.armR) {
        if (!p.armR.destroyed) this.drawArm(ctx, p.armR, rel(A.shF), false);
        else this.markStump(ctx, 'armR', rel(A.shF));
      }

      // top of mech for UI labels
      const m = ctx.getTransform();
      this.topY = m.f + m.d * (-pv[1] - 14);
      ctx.restore();
      ctx.restore();

      this.drawDrone(ctx);
      this.drawStuck(ctx);
    }

    drawArm(ctx, part, at, back) {
      const t = this.t;
      const spinning = part.def.spriteFrames && (t < part.spinUntil || part.def.weapon.vfx === 'saw');
      const s = this.spr(part, spinning ? Math.floor(t * 18) : 0);
      let ox = at[0], oy = at[1], rot = 0;
      if (this.victory && !this.ko) rot = -0.55 + Math.sin(t * 8 + (back ? 1.5 : 0)) * 0.35;
      else if (this.ko) rot = 0.6;
      else rot = Math.sin(t * 1.9 + (back ? 1 : 0)) * 0.03;
      if (part.recoil > 0) ox -= Math.round(part.recoil * 2.5);
      let springLen = 0;
      if (part.lunge) {
        const L = part.lunge;
        const k = (t - L.t0) / L.dur;
        if (k > 1.35) part.lunge = null;
        else {
          let off;
          if (k < 0.55) off = -2 * (k / 0.55);
          else if (k < 1) off = -2 + (L.dist + 2) * U.easeInQuad((k - 0.55) / 0.45);
          else off = L.dist * (1 - (k - 1) / 0.35);
          if (L.vfx === 'ball') rot += k < 1 ? -0.8 * Math.sin(k * Math.PI) : 0;
          if (L.vfx === 'hammer') rot += k < 0.6 ? -1.3 * (k / 0.6) : k < 1 ? -1.3 + 1.9 * ((k - 0.6) / 0.4) : 0.6 * (1 - (k - 1) / 0.35);
          if (L.vfx === 'glove') springLen = Math.max(0, Math.round(off));
          else ox += Math.round(off);
          if (L.vfx === 'drill') oy += Math.round(Math.sin(t * 90));
        }
      }
      if (springLen > 0) {
        // draw the comedic spring then shift the glove forward
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(rot);
        ctx.fillStyle = back ? '#5a6070' : '#a3abb5';
        for (let i = 0; i < springLen; i++) ctx.fillRect(6 + i, (i % 4 < 2 ? -1 : 1), 1, 2);
        ctx.restore();
        ox += springLen;
      }
      this.drawSprite(ctx, s, ox, oy, rot, back ? 'dark' : null, part, part.key);
    }

    markStump(ctx, key, at) {
      ctx.fillStyle = '#2a2026';
      ctx.fillRect(at[0] - 1, at[1] - 1, 3, 3);
      ctx.fillStyle = '#ff9a3a';
      if (Math.sin(this.t * 13 + at[0]) > 0.6) ctx.fillRect(at[0], at[1], 1, 1);
      const m = ctx.getTransform();
      this.stumps[key] = { x: m.a * at[0] + m.c * at[1] + m.e, y: m.b * at[0] + m.d * at[1] + m.f };
    }

    drawDrone(ctx) {
      if (!this.hasRepairDrone() || this.ko) {
        this.dronePos = null;
        return;
      }
      const t = this.t;
      const base = this.pos.chassis || { x: this.x, y: this.y - 30 };
      let tx = base.x - this.facing * 16 + Math.cos(t * 1.6) * 8;
      let ty = base.y - 24 + Math.sin(t * 2.3) * 4;
      if (this.droneTarget && t < this.droneUntil) {
        const pp = this.pos[this.droneTarget];
        if (pp) {
          tx = pp.x - this.facing * 9;
          ty = pp.y - 9;
        }
      }
      if (!this.dronePos) this.dronePos = { x: tx, y: ty };
      this.dronePos.x = U.lerp(this.dronePos.x, tx, 0.12);
      this.dronePos.y = U.lerp(this.dronePos.y, ty, 0.12);
      const s = P.Pixel.get('fx_drone', this.paint, { glow: '#7dff9a' });
      ctx.save();
      ctx.translate(Math.round(this.dronePos.x), Math.round(this.dronePos.y));
      if (Math.floor(t * 20) % 2) ctx.scale(-1, 1);
      ctx.drawImage(s.canvas, -s.pivot[0], -s.pivot[1]);
      ctx.restore();
      this.lights.push({ x: this.dronePos.x, y: this.dronePos.y + 1, color: '#7dff9a', r: 5, a: 0.6 });
    }

    drawStuck(ctx) {
      for (const k in this.stuck) {
        if (this.t > this.stuck[k] || !this.pos[k] || (this.parts[k] && this.parts[k].destroyed)) {
          delete this.stuck[k];
          continue;
        }
        const pp = this.pos[k];
        const x = Math.round(pp.x), y = Math.round(pp.y);
        const d = -this.facing;
        ctx.fillStyle = '#7b5637';
        ctx.fillRect(x + d * 1, y - 1, d * 6, 1);
        ctx.fillStyle = '#d63b35';
        ctx.fillRect(x - 1, y - 3, 2, 5);
        ctx.fillStyle = '#17151d';
        ctx.fillRect(x - (d > 0 ? 2 : -1), y - 3, 1, 5);
      }
    }
  }

  MechView.HOLO = { id: 'holo', P: '#b9a4ff', S: '#7a5ad0' };
  P.MechView = MechView;

  // Renders a mech into its own small DOM canvas (used for previews in menus)
  P.MechPreview = class {
    constructor(canvas, build, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.view = new MechView(build, { facing: (opts && opts.facing) || 1 });
      this.view.x = canvas.width / 2;
      this.view.y = canvas.height - 4;
    }
    setBuild(b) {
      this.view.setBuild(b);
    }
    frame(dt) {
      this.view.update(dt);
      const c = this.ctx;
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.view.draw(c);
    }
  };
})();
