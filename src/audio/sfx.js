// Part-Time Pilot — tiny procedural sound effects (WebAudio, no audio files).
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const S = (P.SFX = { ctx: null, master: null, last: {}, voices: 0 });

  S.init = function () {
    if (S.ctx) {
      if (S.ctx.state === 'suspended') S.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    S.ctx = new AC();
    S.master = S.ctx.createGain();
    S.comp = S.ctx.createDynamicsCompressor();
    S.master.connect(S.comp);
    S.comp.connect(S.ctx.destination);
    S.setVolume(P.State.settings.sfx);
    const len = S.ctx.sampleRate * 1.5;
    S.noise = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
    const d = S.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (P.Music) P.Music.onReady(S.ctx, S.noise);
  };
  S.setVolume = function (v) {
    if (S.master) S.master.gain.value = v * 0.6;
  };

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f0, f1, dur, vol, t0, opts) {
    const c = S.ctx;
    const t = c.currentTime + (t0 || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (opts && opts.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = opts.vib;
      lg.gain.value = opts.vibAmt || 20;
      l.connect(lg);
      lg.connect(o.frequency);
      l.start(t);
      l.stop(t + dur + 0.05);
    }
    env(g, t, 0.005, vol, dur);
    o.connect(g);
    g.connect(S.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, filterType, f0, f1, t0, q) {
    const c = S.ctx;
    const t = c.currentTime + (t0 || 0);
    const src = c.createBufferSource();
    src.buffer = S.noise;
    const f = c.createBiquadFilter();
    f.type = filterType || 'lowpass';
    f.frequency.setValueAtTime(f0 || 2000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    f.Q.value = q || 0.8;
    const g = c.createGain();
    env(g, t, 0.004, vol, dur);
    src.connect(f);
    f.connect(g);
    g.connect(S.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  const DEFS = {
    shot: () => {
      noise(0.07, 0.35, 'highpass', 1800, 900);
      tone('square', 520, 180, 0.05, 0.08);
    },
    pellet: () => {
      noise(0.16, 0.55, 'lowpass', 3200, 400);
      tone('triangle', 180, 60, 0.12, 0.25);
    },
    plunger: () => tone('sine', 420, 90, 0.14, 0.35),
    rocket: () => noise(0.25, 0.25, 'bandpass', 600, 2400, 0, 2),
    mortar: () => {
      tone('sine', 140, 50, 0.2, 0.45);
      noise(0.1, 0.3, 'lowpass', 900, 200);
    },
    whistle: () => tone('sine', 1500, 500, 0.9, 0.06),
    toast: () => {
      tone('square', 880, 880, 0.04, 0.08);
      tone('square', 1320, 1320, 0.06, 0.06, 0.05);
      noise(0.08, 0.2, 'lowpass', 1200, 300);
    },
    can: () => {
      tone('square', 300, 200, 0.06, 0.1);
      noise(0.12, 0.2, 'highpass', 4000, 2000);
    },
    boom: () => {
      noise(0.45, 0.8, 'lowpass', 1400, 80);
      tone('sine', 120, 35, 0.35, 0.6);
    },
    boom_big: () => {
      noise(0.9, 1.0, 'lowpass', 1100, 50);
      tone('sine', 90, 25, 0.7, 0.8);
    },
    laser: () => tone('sawtooth', 1400, 180, 0.16, 0.14),
    bigbeam: () => {
      tone('sawtooth', 300, 60, 0.6, 0.25, 0, { vib: 30, vibAmt: 40 });
      noise(0.6, 0.3, 'bandpass', 800, 200, 0, 3);
    },
    charge: () => tone('sine', 120, 900, 1.2, 0.12),
    zap: () => {
      for (let i = 0; i < 4; i++) tone('square', 200 + Math.random() * 1600, 100 + Math.random() * 400, 0.05, 0.08, i * 0.035);
      noise(0.18, 0.25, 'highpass', 3000, 1200);
    },
    flame: () => noise(0.35, 0.3, 'bandpass', 500, 900, 0, 0.7),
    clank: () => {
      tone('square', 640, 600, 0.09, 0.14);
      tone('square', 990, 900, 0.07, 0.1);
      noise(0.08, 0.35, 'highpass', 2500, 1500);
    },
    saw: () => tone('sawtooth', 220, 260, 0.08, 0.1),
    drill: () => {
      tone('square', 90, 90, 0.12, 0.12, 0, { vib: 60, vibAmt: 30 });
      noise(0.1, 0.25, 'bandpass', 1200, 1000, 0, 2);
    },
    boing: () => tone('sine', 180, 520, 0.32, 0.35, 0, { vib: 14, vibAmt: 70 }),
    whoosh: () => noise(0.22, 0.25, 'bandpass', 400, 1600, 0, 1.5),
    hit: () => {
      tone('sine', 160, 60, 0.09, 0.4);
      noise(0.06, 0.25, 'lowpass', 1800, 400);
    },
    crit: () => {
      tone('square', 1200, 1200, 0.05, 0.12);
      tone('square', 1800, 1800, 0.08, 0.1, 0.05);
    },
    break: () => {
      noise(0.5, 0.7, 'lowpass', 2400, 200);
      tone('square', 300, 70, 0.3, 0.2);
      tone('square', 820, 400, 0.12, 0.1, 0.08);
    },
    heal: () => {
      tone('sine', 660, 660, 0.08, 0.12);
      tone('sine', 990, 990, 0.1, 0.1, 0.07);
    },
    shield: () => tone('sine', 520, 300, 0.12, 0.18),
    fall: () => {
      tone('sine', 300, 80, 0.3, 0.3);
      noise(0.25, 0.5, 'lowpass', 900, 100, 0.25);
    },
    quack: () => tone('sawtooth', 480, 380, 0.12, 0.2, 0, { vib: 40, vibAmt: 40 }),
    crowd: () => noise(1.4, 0.35, 'bandpass', 900, 1300, 0, 0.5),
    ui: () => tone('square', 880, 880, 0.03, 0.06),
    ui_ok: () => {
      tone('square', 660, 660, 0.05, 0.08);
      tone('square', 990, 990, 0.07, 0.08, 0.06);
    },
    ui_bad: () => tone('square', 220, 160, 0.12, 0.1),
    coin: () => {
      tone('square', 990, 990, 0.06, 0.1);
      tone('square', 1480, 1480, 0.12, 0.1, 0.07);
    },
    loot: () => {
      [660, 880, 1100, 1320].forEach((f, i) => tone('triangle', f, f, 0.1, 0.12, i * 0.06));
    },
    jackpot: () => {
      [880, 1100, 1320, 1760, 1320, 1760].forEach((f, i) => tone('square', f, f, 0.08, 0.08, i * 0.07));
    },
    win: () => {
      [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('square', f, f, 0.16, 0.12, i * 0.12));
    },
    lose: () => {
      [392, 349, 311, 233].forEach((f, i) => tone('triangle', f, f * 0.98, 0.3, 0.15, i * 0.22));
    },
    bell: () => {
      tone('sine', 1320, 1320, 0.8, 0.2);
      tone('sine', 1980, 1980, 0.5, 0.08);
    },
    phase: () => {
      tone('sawtooth', 80, 40, 1.0, 0.3, 0, { vib: 8, vibAmt: 20 });
      noise(1.0, 0.3, 'lowpass', 600, 100);
    },
    // ---- expansion weapons ----
    nail: () => {
      noise(0.04, 0.22, 'highpass', 3000, 1800);
      tone('square', 900, 400, 0.03, 0.05);
    },
    revolver: () => {
      noise(0.12, 0.5, 'highpass', 1400, 500);
      tone('triangle', 260, 90, 0.1, 0.25);
    },
    click: () => {
      tone('square', 2200, 2200, 0.015, 0.12);
      tone('square', 1500, 1500, 0.015, 0.1, 0.06);
    },
    harpoon: () => {
      tone('sine', 300, 120, 0.12, 0.3);
      noise(0.3, 0.2, 'bandpass', 2400, 600, 0.02, 3);
    },
    swarm: () => noise(0.18, 0.18, 'bandpass', 1200, 3000, 0, 2),
    smoke: () => noise(0.3, 0.3, 'lowpass', 1200, 200),
    mine: () => {
      tone('square', 1400, 1400, 0.04, 0.08);
      tone('square', 1400, 1400, 0.04, 0.08, 0.12);
    },
    boomerang: () => tone('sawtooth', 300, 600, 0.35, 0.08, 0, { vib: 25, vibAmt: 80 }),
    acid: () => noise(0.35, 0.25, 'highpass', 5000, 2500),
    sonic: () => {
      [196, 247, 294].forEach((f) => tone('sawtooth', f, f * 1.01, 0.6, 0.07, 0, { vib: 6, vibAmt: 6 }));
      tone('sawtooth', 98, 98, 0.6, 0.08);
    },
    emp: () => {
      tone('sine', 900, 60, 0.4, 0.3, 0, { vib: 30, vibAmt: 200 });
      noise(0.2, 0.2, 'highpass', 4000, 2000);
    },
    blackhole: () => {
      tone('sine', 60, 30, 1.0, 0.5, 0, { vib: 5, vibAmt: 15 });
      noise(0.9, 0.3, 'lowpass', 400, 60);
    },
    freeze: () => {
      [1800, 2400, 3000, 2100].forEach((f, i) => tone('sine', f, f, 0.15, 0.06, i * 0.04));
      noise(0.3, 0.15, 'highpass', 6000, 3000);
    },
    rail: () => {
      noise(0.5, 0.8, 'highpass', 800, 200);
      tone('sawtooth', 2000, 80, 0.4, 0.3);
    },
    phoenix: () => {
      tone('sawtooth', 200, 900, 0.6, 0.2);
      noise(1.0, 0.6, 'lowpass', 2400, 100, 0.4);
      tone('sine', 110, 40, 0.6, 0.5, 0.4);
    },
    golem: () => {
      noise(0.15, 0.3, 'lowpass', 800, 200);
      tone('square', 120, 80, 0.1, 0.15);
    },
    rush: () => {
      noise(0.35, 0.5, 'bandpass', 500, 2500, 0, 1.2);
      tone('sine', 140, 50, 0.2, 0.4, 0.15);
    },
    lottery: () => [1046, 1318, 1568].forEach((f, i) => tone('triangle', f, f, 0.08, 0.1, i * 0.05)),
    reel: () => tone('square', 1200, 1200, 0.02, 0.05),
    fuse: () => {
      noise(0.6, 0.4, 'lowpass', 600, 120);
      tone('square', 90, 60, 0.5, 0.2, 0, { vib: 20, vibAmt: 15 });
    },
  };

  S.play = function (name, opts) {
    if (!S.ctx || !DEFS[name] || S.ctx.state !== 'running') return;
    const now = performance.now();
    const minGap = (opts && opts.gap) || 35;
    if (S.last[name] && now - S.last[name] < minGap) return;
    S.last[name] = now;
    try {
      DEFS[name]();
    } catch (e) {
      /* ignore audio errors */
    }
  };
})();
