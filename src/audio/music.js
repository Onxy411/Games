// Part-Time Pilot — procedural music (WebAudio). No audio files: every note is synthesized.
//   P.Music.play('hub' | 'battle' | 'boss' | 'ending' | null)  — crossfades between tracks
//   P.Music.setIntensity(0..1)                                  — adds layers (boss phase 2, low HP)
// A lookahead scheduler queues notes ~150ms ahead on the AudioContext clock, so timing stays tight
// even if frames drop. Melodies are seeded per phrase, so motifs repeat like a real song.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const M = (P.Music = { want: null, tracks: [], intensity: 0 });
  let ctx = null, out = null, rev = null, dly = null, noiseBuf = null, distCurve = null;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  M.onReady = function (audioCtx, noise) {
    if (ctx) return;
    ctx = audioCtx;
    noiseBuf = noise;
    out = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    out.connect(comp);
    comp.connect(ctx.destination);
    M.setVolume(P.State.settings.music);
    // reverb: decaying noise impulse
    rev = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    rev.buffer = ir;
    const revOut = ctx.createGain();
    revOut.gain.value = 0.7;
    rev.connect(revOut);
    revOut.connect(out);
    // tempo-free echo
    dly = ctx.createDelay(1.5);
    dly.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const dlyLp = ctx.createBiquadFilter();
    dlyLp.frequency.value = 2400;
    dly.connect(dlyLp);
    dlyLp.connect(fb);
    fb.connect(dly);
    dlyLp.connect(out);
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      distCurve[i] = Math.tanh(x * 3.2);
    }
    setInterval(tick, 25);
    if (M.want) {
      const w = M.want;
      M.want = null;
      M.play(w);
    }
  };

  M.setVolume = function (v) {
    if (out) out.gain.setTargetAtTime(Math.max(0, v) * 0.55, ctx.currentTime, 0.1);
  };
  M.setIntensity = (x) => (M.intensity = U.clamp(x, 0, 1));

  M.play = function (id) {
    if (M.want === id && (id === null || M.tracks.some((t) => t.id === id && !t.dying))) return;
    M.want = id;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const tr of M.tracks) {
      if (tr.dying) continue;
      tr.dying = true;
      tr.gain.gain.cancelScheduledValues(now);
      tr.gain.gain.setValueAtTime(tr.gain.gain.value, now);
      tr.gain.gain.linearRampToValueAtTime(0.0001, now + 1.4);
      tr.endAt = now + 1.5;
    }
    if (!id || !TRACKS[id]) return;
    M.intensity = 0;
    const def = TRACKS[id];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(def.vol || 1, now + 1.2);
    g.connect(out);
    const revSend = ctx.createGain();
    revSend.gain.value = def.rev || 0.3;
    g.connect(revSend);
    revSend.connect(rev);
    const dlySend = ctx.createGain();
    dlySend.gain.value = 0;
    dlySend.connect(dly);
    dly.delayTime.setValueAtTime((60 / def.bpm) * 0.75, now);
    M.tracks.push({ id, def, gain: g, dlySend, step: 0, next: now + 0.12, dying: false });
  };

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const tr of M.tracks) {
      if (tr.dying && now > tr.endAt) continue;
      const sd = 60 / tr.def.bpm / 4;
      while (tr.next < now + 0.15) {
        const pos = tr.step % 16;
        const swing = pos % 4 === 2 ? (tr.def.swing || 0) * sd : 0;
        try {
          tr.def.step(tr, tr.step, tr.next + swing, sd, inst(tr));
        } catch (e) {
          /* never let a bad note kill the loop */
        }
        tr.next += sd;
        tr.step++;
      }
    }
    M.tracks = M.tracks.filter((t) => !(t.dying && now > t.endAt));
  }

  // ---------------------------------------------------------------- instruments
  function envGain(t, a, peak, d, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest);
    return g;
  }
  function voice(type, f, t, dur, dest, detune) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  function nz(t, dur, dest, type, f0, f1, q) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 0.7;
    s.connect(f);
    f.connect(dest);
    s.start(t, Math.random() * 1.2);
    s.stop(t + dur + 0.02);
  }
  function lp(freq, dest, q) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    f.Q.value = q || 0.5;
    f.connect(dest);
    return f;
  }

  function inst(tr) {
    const dest = tr.gain;
    return {
      keys(t, m, dur, v) {
        const g = envGain(t, 0.006, 0.16 * v, dur * 1.6, lp(2200, dest));
        voice('sine', mtof(m), t, dur * 1.7, g);
        const g2 = envGain(t, 0.004, 0.035 * v, dur * 0.6, dest);
        voice('triangle', mtof(m) * 2, t, dur, g2);
      },
      pluck(t, m, dur, v, echo) {
        const g = envGain(t, 0.004, 0.13 * v, 0.35 + dur * 0.3, lp(3000, dest));
        voice('triangle', mtof(m), t, 0.8, g);
        if (echo) {
          const e = envGain(t, 0.004, 0.08 * v, 0.3, tr.dlySend);
          voice('triangle', mtof(m), t, 0.5, e);
          tr.dlySend.gain.value = 0.6;
        }
      },
      pad(t, notes, dur, v) {
        const f = lp(950, dest);
        for (const m of notes) {
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.03 * v, t + Math.min(0.5, dur * 0.4));
          g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
          g.connect(f);
          voice('sawtooth', mtof(m), t, dur + 0.6, g, -7);
          voice('sawtooth', mtof(m), t, dur + 0.6, g, 7);
        }
      },
      organ(t, notes, dur, v) {
        const f = lp(1800, dest);
        for (const m of notes) {
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.03 * v, t + 0.03);
          g.gain.setValueAtTime(0.03 * v, t + dur * 0.8);
          g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
          g.connect(f);
          voice('square', mtof(m), t, dur + 0.2, g);
          voice('square', mtof(m + 12), t, dur + 0.2, g, 4);
        }
      },
      choir(t, notes, dur, v) {
        for (const m of notes) {
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.04 * v, t + 0.6);
          g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
          g.connect(dest);
          const o = voice('sine', mtof(m), t, dur + 0.7, g);
          const l = ctx.createOscillator(), lg = ctx.createGain();
          l.frequency.value = 5;
          lg.gain.value = mtof(m) * 0.006;
          l.connect(lg);
          lg.connect(o.frequency);
          l.start(t);
          l.stop(t + dur + 0.7);
        }
      },
      bass(t, m, dur, v, bright) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 4;
        f.frequency.setValueAtTime(bright ? 1500 : 600, t);
        f.frequency.exponentialRampToValueAtTime(bright ? 260 : 180, t + dur);
        const g = envGain(t, 0.005, 0.22 * v, dur + 0.05, dest);
        f.connect(g);
        voice('sawtooth', mtof(m), t, dur + 0.1, f);
        const sg = envGain(t, 0.005, 0.18 * v, dur + 0.05, dest);
        voice('sine', mtof(m), t, dur + 0.1, sg);
      },
      softBass(t, m, dur, v) {
        const g = envGain(t, 0.02, 0.26 * v, dur * 1.2, lp(420, dest));
        voice('triangle', mtof(m), t, dur * 1.3, g);
        voice('sine', mtof(m), t, dur * 1.3, g);
      },
      power(t, root, dur, v) {
        const ws = ctx.createWaveShaper();
        ws.curve = distCurve;
        const g = envGain(t, 0.005, 0.055 * v, dur + 0.08, lp(2600, dest));
        ws.connect(g);
        for (const iv of [0, 7, 12]) voice('sawtooth', mtof(root + iv), t, dur + 0.1, ws, iv ? 5 : 0);
      },
      lead(t, m, dur, v) {
        const f = lp(3200, dest);
        const g = envGain(t, 0.008, 0.07 * v, dur + 0.1, f);
        const o = voice('square', mtof(m), t, dur + 0.15, g);
        if (dur > 0.18) {
          const l = ctx.createOscillator(), lg = ctx.createGain();
          l.frequency.value = 6;
          lg.gain.setValueAtTime(0, t);
          lg.gain.linearRampToValueAtTime(mtof(m) * 0.012, t + 0.15);
          l.connect(lg);
          lg.connect(o.frequency);
          l.start(t);
          l.stop(t + dur + 0.15);
        }
        const e = envGain(t, 0.008, 0.035 * v, dur, tr.dlySend);
        voice('square', mtof(m), t, dur + 0.1, e);
        tr.dlySend.gain.value = 0.7;
      },
      bell(t, m, v) {
        const g = envGain(t, 0.002, 0.07 * v, 1.2, dest);
        voice('sine', mtof(m), t, 1.3, g);
        const g2 = envGain(t, 0.002, 0.03 * v, 0.5, dest);
        voice('sine', mtof(m) * 2.76, t, 0.6, g2);
      },
      kick(t, v) {
        const g = envGain(t, 0.002, 0.7 * v, 0.32, dest);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.4);
      },
      snare(t, v) {
        nz(t, 0.16, envGain(t, 0.002, 0.28 * v, 0.16, dest), 'highpass', 1800);
        const g = envGain(t, 0.002, 0.18 * v, 0.08, dest);
        voice('triangle', 190, t, 0.1, g);
      },
      rim(t, v) {
        const g = envGain(t, 0.001, 0.12 * v, 0.04, dest);
        voice('square', 1700, t, 0.05, g);
        nz(t, 0.03, envGain(t, 0.001, 0.08 * v, 0.03, dest), 'bandpass', 2500, null, 2);
      },
      hat(t, v, open) {
        nz(t, open ? 0.25 : 0.04, envGain(t, 0.001, 0.09 * v, open ? 0.25 : 0.035, dest), 'highpass', 8000);
      },
      crash(t, v) {
        nz(t, 1.4, envGain(t, 0.002, 0.14 * v, 1.4, dest), 'highpass', 5000, 3000);
      },
      tom(t, m, v) {
        const g = envGain(t, 0.002, 0.35 * v, 0.25, dest);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(mtof(m), t);
        o.frequency.exponentialRampToValueAtTime(mtof(m) * 0.6, t + 0.2);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.3);
      },
      crackle(t) {
        nz(t, 0.006, envGain(t, 0.0005, 0.05 + Math.random() * 0.08, 0.006, dest), 'highpass', 2500);
      },
    };
  }

  // ---------------------------------------------------------------- song helpers
  // A deterministic melody for a phrase: random walk over a scale, landing on chord tones.
  function phraseMelody(seed, scale, len, density) {
    const r = U.makeRng(seed);
    const notes = [];
    let idx = Math.floor(scale.length / 2);
    for (let i = 0; i < len; i++) {
      if (r() > density && i % 4 !== 0) {
        notes.push(null);
        continue;
      }
      idx = U.clamp(idx + r.pick([-2, -1, -1, 0, 1, 1, 2]), 0, scale.length - 1);
      notes.push({ m: scale[idx], len: r() < 0.25 ? 2 : 1 });
    }
    return notes;
  }
  const cache = {};
  function melodyFor(key, seed, scale, len, density) {
    const k = key + seed;
    return cache[k] || (cache[k] = phraseMelody(seed, scale, len, density));
  }

  // ---------------------------------------------------------------- tracks
  const TRACKS = {
    // Calm lo-fi for the junkyard at night
    hub: {
      bpm: 76, swing: 0.16, vol: 0.9, rev: 0.45,
      progA: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
      progB: [[57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]],
      step(tr, s, t, sd, I) {
        const pos = s % 16, bar = Math.floor(s / 16);
        const prog = Math.floor(bar / 4) % 4 === 2 ? this.progB : this.progA;
        const ch = prog[bar % 4];
        const root = ch[0] - 12;
        if (pos === 0) {
          ch.forEach((m, i) => I.keys(t + i * 0.014, m, sd * 6, 0.9));
          I.pad(t, ch, sd * 15, 0.7);
          I.softBass(t, root - 12, sd * 5, 1);
        }
        if (pos === 10) {
          I.keys(t, ch[2], sd * 3, 0.5);
          I.keys(t + 0.01, ch[3], sd * 3, 0.5);
          I.softBass(t, root - 12 + (bar % 2 ? 7 : 12), sd * 3, 0.7);
        }
        if (pos === 0 || pos === 10 || (pos === 7 && bar % 2)) I.kick(t, pos === 7 ? 0.35 : 0.55);
        if (pos === 4 || pos === 12) I.rim(t, 0.8);
        if (pos % 2 === 0) I.hat(t, pos % 4 === 0 ? 0.35 : 0.22);
        if (bar >= 2) {
          const mel = melodyFor('hub', Math.floor(bar / 2) % 4, [57, 60, 62, 64, 67, 69, 72], 32, 0.35);
          const n = mel[(bar % 2) * 16 + pos];
          if (n && pos % 2 === 0) I.pluck(t, n.m + 12, sd * 2 * n.len, 0.6, true);
        }
        if (Math.random() < 0.18) I.crackle(t + Math.random() * sd);
      },
    },
    // Driving brawl music for bouts
    battle: {
      bpm: 144, vol: 0.85, rev: 0.18,
      roots: { A: [40, 36, 43, 38], B: [36, 38, 40, 40] },
      chords: { 40: [52, 55, 59], 36: [48, 52, 55], 43: [55, 59, 62], 38: [50, 54, 57] },
      step(tr, s, t, sd, I) {
        const pos = s % 16, bar = Math.floor(s / 16);
        const sec = Math.floor(bar / 4) % 4 === 2 ? 'B' : 'A';
        const root = this.roots[sec][bar % 4];
        const ch = this.chords[root];
        const hi = M.intensity > 0.5;
        const fill = bar % 8 === 7 && pos >= 12;
        // drums
        if (bar % 8 === 0 && pos === 0) I.crash(t, 0.9);
        if (pos === 0 || pos === 6 || pos === 8 || (sec === 'B' && pos === 10) || (hi && pos === 14)) I.kick(t, 0.9);
        if (fill) {
          I.snare(t, 0.5 + (pos - 12) * 0.12);
          I.tom(t, 52 - (pos - 12) * 3, 0.7);
        } else if (pos === 4 || pos === 12) I.snare(t, 0.95);
        if (hi ? true : pos % 2 === 0) I.hat(t, pos % 4 === 0 ? 0.5 : 0.3, pos === 14 && !hi);
        // bass: driving 8ths
        if (pos % 2 === 0) I.bass(t, root - 12 + (pos === 6 || pos === 14 ? 12 : 0), sd * 1.8, 0.95, true);
        // power chord stabs
        if ([0, 3, 6, 10].includes(pos) && !fill) I.power(t, root + 12, sd * (pos === 10 ? 4 : 2), pos === 0 ? 1 : 0.75);
        if (pos === 0) I.pad(t, ch, sd * 15, 0.5);
        // lead
        if (sec === 'A' && bar >= 4) {
          const mel = melodyFor('battle', Math.floor(bar / 2) % 4, [64, 67, 69, 71, 74, 76, 79], 32, 0.6);
          const n = mel[(bar % 2) * 16 + pos];
          if (n && pos % 2 === 0) I.lead(t, n.m, sd * 2 * n.len * 0.9, 0.85);
        } else if (sec === 'B' && pos % 2 === 0) {
          I.pluck(t, ch[(pos / 2) % 3] + 12, sd * 1.5, 0.55, false);
        }
      },
    },
    // The Baron: villainous organ + choir, harder in phase 2
    boss: {
      bpm: 152, vol: 0.85, rev: 0.25,
      roots: [36, 32, 41, 43],
      chords: { 36: [60, 63, 67], 32: [56, 60, 63], 41: [53, 56, 60], 43: [55, 59, 62] },
      step(tr, s, t, sd, I) {
        const pos = s % 16, bar = Math.floor(s / 16);
        const root = this.roots[bar % 4];
        const ch = this.chords[root];
        const rage = M.intensity > 0.5;
        if (pos === 0) {
          I.organ(t, ch, sd * (rage ? 7 : 14), 0.9);
          if (bar % 2 === 0) I.choir(t, ch.map((m) => m - 12), sd * 30, 0.8);
          if (bar % (rage ? 2 : 4) === 0) I.crash(t, 0.8);
        }
        if (rage && pos === 8) I.organ(t, ch, sd * 7, 0.8);
        // chugging bass
        I.bass(t, root - 12, sd * 0.9, pos % 4 === 0 ? 1 : 0.6, pos % 4 === 0);
        // drums
        if (rage ? true : pos % 4 === 0 || pos === 10) I.kick(t, rage && pos % 2 ? 0.6 : 0.95);
        if (pos === 4 || pos === 12) I.snare(t, 1);
        if (pos % 2 === 0) I.hat(t, 0.35);
        // harmonic-minor lead
        if (bar >= 2) {
          const mel = melodyFor('boss', Math.floor(bar / 2) % 3, [60, 62, 63, 65, 67, 68, 71, 72, 74, 75], 32, 0.55);
          const n = mel[(bar % 2) * 16 + pos];
          if (n && pos % 2 === 0) I.lead(t, n.m + (rage ? 12 : 0), sd * 2 * n.len * 0.9, 0.8);
        }
        if (rage && pos % 4 === 2) I.bell(t, ch[(pos / 4) % 3 | 0] + 24, 0.7);
      },
    },
    // Champion! (ending)
    ending: {
      bpm: 108, vol: 0.9, rev: 0.4,
      roots: [36, 43, 45, 41],
      chords: { 36: [60, 64, 67], 43: [59, 62, 67], 45: [57, 60, 64], 41: [57, 60, 65] },
      step(tr, s, t, sd, I) {
        const pos = s % 16, bar = Math.floor(s / 16);
        const root = this.roots[bar % 4];
        const ch = this.chords[root];
        if (pos === 0) {
          I.pad(t, ch, sd * 15, 0.8);
          I.softBass(t, root - 12, sd * 6, 1);
          if (bar % 4 === 0) I.crash(t, 0.7);
        }
        if (pos === 8) I.softBass(t, root - 12 + 7, sd * 6, 0.8);
        if (pos % 4 === 2) I.pluck(t, ch[(pos >> 2) % 3] + 12, sd * 2, 0.5, true);
        if (pos === 0 || pos === 10) I.kick(t, 0.7);
        if (pos === 4 || pos === 12) I.snare(t, 0.7);
        if (pos % 2 === 0) I.hat(t, 0.25);
        const mel = melodyFor('end', Math.floor(bar / 2) % 2, [67, 69, 72, 74, 76, 79, 81], 32, 0.5);
        const n = mel[(bar % 2) * 16 + pos];
        if (n && pos % 2 === 0) I.lead(t, n.m, sd * 2 * n.len, 0.7);
      },
    },
  };
  M.TRACKS = TRACKS;
})();
