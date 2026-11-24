// Part-Time Pilot — battle playback + post-battle report.
// The fight is fully simulated up front (P.Sim.run); this scene plays the event log back
// at the chosen speed and turns each event into animation, effects, sound and HUD updates.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const h = U.h;
  const UI = P.UI;
  const S = P.State;
  P.Scenes = P.Scenes || {};

  const GY = 214;
  const PROJ = { bullet: 1, pellet: 1, plunger: 1, rocket: 1, mortar: 1, toast: 1, can: 1, nail: 1, revolver: 1, harpoon: 1, swarm: 1, smoke: 1, mine: 1, boomerang: 1 };
  const ARC = { mortar: 75, toast: 28, plunger: 10, can: 16, smoke: 45, mine: 40, harpoon: 5 };
  const FIRE_SFX = {
    bullet: 'shot', pellet: 'pellet', plunger: 'plunger', rocket: 'rocket', mortar: 'mortar', toast: 'toast', can: 'can', flame: 'flame',
    claw: 'whoosh', saw: 'saw', drill: 'drill', glove: 'boing', ball: 'whoosh', ram: 'whoosh', bigbeam: 'charge',
    nail: 'nail', revolver: 'revolver', harpoon: 'harpoon', swarm: 'swarm', smoke: 'smoke', mine: 'mine', boomerang: 'boomerang',
    acid: 'acid', hammer: 'whoosh', rail: 'charge', sonic: 'sonic', emp: 'emp', blackhole: 'blackhole', cryo: 'freeze',
  };
  const T = (s) => s; // marks a string for translation; P.t() runs where it is drawn
  const CHAMBER_TXT = { blank: [T('*CLICK*'), '#a8a4b0'], normal: null, ricochet: [T('RICOCHET!'), '#ffe7a0'], golden: [T('GOLDEN BULLET!'), '#ffd76a'], explosive: [T('BOOM ROUND!'), '#ffa143'], fan: [T('FAN THE HAMMER!'), '#ffd76a'] };
  const LOTTO_TXT = { overdrive: [T('OVERDRIVE!'), '#ff6a5a'], shield: [T('FREE SHIELD!'), '#7fd9ff'], patch: [T('PATCH-UP!'), '#8aff9a'], turbo: [T('TURBO!'), '#ffe04a'], dud: [T('...NOTHING.'), '#a8a4b0'], jackpot: [T('JACKPOT!!!'), '#ffd76a'] };
  const SHORT = { chassis: T('Core'), head: T('Head'), legs: T('Legs'), armR: T('R.Arm'), armL: T('L.Arm') };
  const other = (s) => (s === 'A' ? 'B' : 'A');
  const teamOf = (id) => id[0];
  const LANE_Y = [0, -11, 9]; // depth lanes for team bouts: point, wing (further back), rear (nearer the camera)
  const VEND = { soda: [T('SODA!'), '#ff8a8a'], coffee: [T('HOT COFFEE!'), '#ffb070'], snack: [T('SNACK BREAK! (heal)'), '#8aff9a'], jackpot: [T('JACKPOT!!!'), '#ffe04a'] };

  const Battle = {
    enter(params) {
      this.params = params;
      this.mode = params.replay ? 'replay' : 'campaign';
      if (params.replay) {
        const rep = params.replay;
        this.teamA = Array.isArray(rep.A) ? rep.A : [rep.A];
        this.teamB = Array.isArray(rep.B) ? rep.B : [rep.B];
        this.seed = rep.seed;
        this.arena = rep.arena || 'pit';
        this.bout = S.boutById(rep.boutId);
        this.title = (this.bout && P.boutTitle(this.bout)) || rep.title || P.t('Replay');
        this.replayObj = rep;
        const oneV1 = this.teamA.length === 1 && this.teamB.length === 1;
        if (rep.simVersion !== P.Sim.VERSION && !(oneV1 && P.Sim.COMPAT.includes(rep.simVersion))) setTimeout(() => UI.toast(P.t('This replay was recorded with a different game version — the fight may play out differently.'), 'bad'), 400);
      } else {
        this.bout = params.bout;
        if (this.bout.team) {
          // team bout: the lineup's mechs, point first
          this.lineup = params.lineup || S.lineupFor(this.bout);
          this.teamA = this.lineup.map((mi) => S.build(null, mi));
          this.teamB = S.boutTeam(this.bout, !!params.rematch);
          this.equipSnaps = this.lineup.map((mi) => Object.assign({}, S.mechRec(mi).equip));
        } else {
          // Chapter 1 bouts: your own mech (garage slot #1)
          this.teamA = [S.build(null, 0)];
          this.teamB = [S.boutBuild(this.bout, !!params.rematch)];
          this.equipSnap = Object.assign({}, S.mechRec(0).equip);
        }
        this.seed = U.newSeed();
        this.arena = this.bout.arena;
        this.title = P.boutTitle(this.bout);
      }
      this.A = this.teamA[0];
      this.B = this.teamB[0];
      const simA = this.teamA.length > 1 || this.teamB.length > 1 ? this.teamA : this.A;
      const simB = this.teamA.length > 1 || this.teamB.length > 1 ? this.teamB : this.B;
      this.sim = P.Sim.run({ seed: this.seed, A: simA, B: simB });
      this.team = !!this.sim.team;
      if (this.mode === 'campaign') this.replayObj = S.makeReplay(this.bout, this.seed, simA, simB, this.sim, this.arena);
      this.ids = this.team ? this.sim.units.map((u) => u.id) : ['A', 'B'];
      this.idsA = this.ids.filter((id) => teamOf(id) === 'A');
      this.idsB = this.ids.filter((id) => teamOf(id) === 'B');
      this.builds = {};
      this.idsA.forEach((id, i) => (this.builds[id] = this.teamA[i]));
      this.idsB.forEach((id, i) => (this.builds[id] = this.teamB[i]));
      this.maxHp = {};
      this.names = {};
      for (const s of this.ids) {
        this.maxHp[s] = {};
        for (const k in this.sim.stats[s].parts) this.maxHp[s][k] = this.sim.stats[s].parts[k].max;
        this.names[s] = P.mechLabel(this.builds[s]) || (teamOf(s) === 'A' ? 'Player' : 'Enemy');
      }
      this.teamName = { A: this.team ? P.t('Your team') : this.names.A, B: this.team && this.bout && this.bout.team ? S.boutFoe(this.bout).name : this.names.B };
      const perSide = (v) => Object.fromEntries(this.ids.map((s) => [s, typeof v === 'function' ? v() : v]));

      P.R.setWorld(480, 270);
      this.env = P.Env.arena(this.arena);
      this.fx = new P.FX();
      this.fx.decal = this.env.decal;
      this.fx.groundY = GY;
      const fr = this.sim.frames;
      this.views = {};
      for (const s of this.ids) {
        const lane = this.team ? (s.length > 1 ? Number(s.slice(1)) : 0) : 0;
        this.views[s] = new P.MechView(this.builds[s], { facing: teamOf(s) === 'A' ? 1 : -1, x: fr[s][0], y: GY + LANE_Y[lane] });
        this.views[s].lane = lane;
      }
      // draw back lanes first
      this.drawOrder = this.ids.slice().sort((a, b) => this.views[a].y - this.views[b].y || (teamOf(a) === 'B' ? -1 : 1));
      this.t = 0;
      this.real = 0;
      this.cursor = 0;
      this.phase = 'intro';
      this.introT = 0;
      this.outroT = 0;
      this.speed = S.settings.speed || 1;
      this.paused = false;
      this.hitstop = 0;
      this.shots = {};
      this.burning = perSide(() => ({}));
      this.annT = -10;
      this.firstBlood = false;
      this.burnAnn = {};
      this.shieldFlash = perSide(0);
      this.frozen = perSide(-1);
      this.blind = perSide(-1);
      this.jammed = perSide(() => ({}));
      this.mines = {};
      this.buffs = perSide(() => ({ dmg: -1, turbo: -1 }));
      this.quiet = false;
      this.outroQueue = [];
      this.buildHUD();
      this.isBoss = this.teamB.some((b) => b && b.boss);
      P.Music.play(this.isBoss ? 'boss' : 'battle');
      this.keyHandler = (e) => this.onKey(e);
      window.addEventListener('keydown', this.keyHandler);
      P.SFX.play('crowd');
    },
    exit() {
      this.env.dispose();
      window.removeEventListener('keydown', this.keyHandler);
    },

    onKey(e) {
      if (this.phase === 'report') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.phase === 'intro') this.endIntro();
        else this.setPaused(!this.paused);
      } else if (e.code === 'Digit1') this.setSpeed(1);
      else if (e.code === 'Digit2') this.setSpeed(2);
      else if (e.code === 'Digit3') this.setSpeed(4);
      else if (e.code === 'KeyS') this.skip();
    },

    // =====================================================================================
    // HUD
    // =====================================================================================
    buildHUD() {
      UI.clear();
      const hud = h('div', { class: 'battle-hud' });
      this.hud = Object.fromEntries(this.ids.map((s) => [s, {}]));
      const plate = (side) => {
        const b = this.builds[side];
        const pilot = teamOf(side) === 'A' ? (b.pilot === 'You' || !b.pilot ? P.t('You') : b.pilot) : b.pilot;
        const core = h('div', { class: 'core-bar' }, h('div', { class: 'fill' }), h('div', { class: 'shield' }), h('span', { class: 'core-txt' }));
        const list = h('div', { class: 'part-list' });
        const parts = this.sim.stats[side].parts;
        for (const k of Object.keys(parts)) {
          if (k === 'chassis') continue;
          const ps = parts[k];
          const fill = h('div', { class: 'fill' });
          const row = h('div', { class: 'pl-row' }, h('span', { class: 'pl-slot' }, SHORT[k] ? P.t(SHORT[k]) : k.startsWith('mount') ? P.t('HP{n}', { n: Number(k.slice(5)) + 1 }) : k), h('span', { class: 'pl-name' }, ps.name), h('div', { class: 'pl-bar' }, fill));
          this.hud[side][k] = { row, fill };
          list.appendChild(row);
        }
        this.hud[side].chassis = { row: core, fill: core.querySelector('.fill'), txt: core.querySelector('.core-txt'), shield: core.querySelector('.shield') };
        return h('div', { class: 'nameplate panel ' + (teamOf(side) === 'A' ? 'left' : 'right') + (this.team ? ' compact' : '') },
          h('div', { class: 'np-pilot' }, pilot),
          h('div', { class: 'np-mech' }, P.mechLabel(b)),
          core, list);
      };
      const plates = (tm) => (this.team ? h('div', { class: 'plate-stack ' + (tm === 'A' ? 'left' : 'right') }, (tm === 'A' ? this.idsA : this.idsB).map(plate)) : plate(tm));
      this.timerEl = h('div', { class: 'timer' }, '1:30');
      hud.appendChild(h('div', { class: 'bh-top' + (this.team ? ' team' : '') }, plates('A'), h('div', { class: 'bh-center' }, h('div', { class: 'bout-title' }, this.title + (this.mode === 'replay' ? ' · ' + P.t('REPLAY') : '')), this.timerEl), plates('B')));
      this.ticker = h('div', { class: 'ticker' });
      hud.appendChild(this.ticker);
      this.speedBtns = {};
      const ctrl = h('div', { class: 'speed-ctrl panel' });
      this.pauseBtn = UI.button('❚❚', () => this.setPaused(!this.paused), 'small', { title: P.t('Pause (Space)') });
      ctrl.appendChild(this.pauseBtn);
      for (const s of [1, 2, 4]) {
        this.speedBtns[s] = UI.button(s + 'x', () => this.setSpeed(s), 'small', { title: P.t('Speed {s}x ({k})', { s, k: s === 4 ? 3 : s }) });
        ctrl.appendChild(this.speedBtns[s]);
      }
      ctrl.appendChild(UI.button(P.t('Skip') + ' ⏭', () => this.skip(), 'small', { title: P.t('Skip to result (S)') }));
      hud.appendChild(ctrl);
      this.bannerEl = h('div', { class: 'big-banner' });
      hud.appendChild(this.bannerEl);
      // intro card
      const eA = this.A, eB = this.B;
      const quote = this.bout ? S.boutFoe(this.bout).quote : '';
      const side = (tm, lead) => (this.team
        ? [h('div', { class: 'ic-pilot' }, this.teamName[tm]), h('div', { class: 'ic-mech' }, (tm === 'A' ? this.teamA : this.teamB).map((b) => b.pilot || P.t('You')).join(' · '))]
        : [h('div', { class: 'ic-pilot' }, lead.pilot === 'You' ? P.t('You') : lead.pilot || (tm === 'A' ? P.t('You') : P.t('Opponent'))), h('div', { class: 'ic-mech' }, P.mechLabel(lead))]);
      this.introEl = h('div', { class: 'intro-card' },
        h('div', { class: 'ic-side left' }, side('A', eA)),
        h('div', { class: 'ic-vs' }, 'VS'),
        h('div', { class: 'ic-side right' }, side('B', eB)),
        h('div', { class: 'ic-title' }, this.title),
        quote ? h('div', { class: 'ic-quote' }, '“' + quote + '”') : null,
        h('div', { class: 'ic-skip' }, P.t('click or Space to skip')));
      this.introEl.addEventListener('click', () => this.endIntro());
      hud.appendChild(this.introEl);
      UI.root.appendChild(hud);
      this.hudRoot = hud;
      this.setSpeed(this.speed);
      for (const s of this.ids) for (const k in this.maxHp[s]) {
        const ps = this.sim.stats[s].parts[k];
        this.setPartHp(s, k, ps && ps.start != null ? ps.start : this.maxHp[s][k]);
      }
    },
    setSpeed(s) {
      this.speed = s;
      for (const k in this.speedBtns) this.speedBtns[k].classList.toggle('on', Number(k) === s);
      if (this.paused) this.setPaused(false);
    },
    setPaused(p) {
      this.paused = p;
      this.pauseBtn.textContent = p ? '▶' : '❚❚';
      this.pauseBtn.classList.toggle('on', p);
    },
    setPartHp(side, key, hp) {
      const el = this.hud[side][key];
      if (!el) return;
      const max = this.maxHp[side][key] || 1;
      const f = U.clamp(hp / max, 0, 1);
      el.fill.style.width = f * 100 + '%';
      el.fill.className = 'fill' + (f < 0.3 ? ' low' : f < 0.6 ? ' mid' : '');
      if (key === 'chassis') el.txt.textContent = `${P.t('CORE')} ${Math.max(0, Math.round(hp))}/${max}`;
      if (hp <= 0) el.row.classList.add('lost');
      el.row.classList.remove('hit');
      void el.row.offsetWidth;
      el.row.classList.add('hit');
      this.views[side].setHp(key, f);
    },
    announce(key, vars, prio) {
      if (this.quiet) return;
      if (!prio && this.real - this.annT < 1.9) return;
      const lines = P.announcerLines(key);
      if (!lines) return;
      let s = lines[Math.floor(Math.random() * lines.length)];
      s = s.replace(/\{(\w)\}/g, (m, k) => (vars && vars[k]) || '');
      this.say('Chip', s);
    },
    say(who, text, cls) {
      this.annT = this.real;
      const line = h('div', { class: 'tk-line ' + (cls || '') }, h('b', null, who + ': '), text);
      this.ticker.appendChild(line);
      while (this.ticker.children.length > 3) this.ticker.firstChild.remove();
      setTimeout(() => line.classList.add('old'), 4500);
    },
    banner(text, cls) {
      this.bannerEl.className = 'big-banner show ' + (cls || '');
      this.bannerEl.textContent = text;
    },

    endIntro() {
      if (this.phase !== 'intro') return;
      this.phase = 'fight';
      this.introEl.classList.add('out');
      setTimeout(() => this.introEl.remove(), 500);
      this.banner(P.t('FIGHT!'), 'fight');
      setTimeout(() => {
        if (this.phase === 'fight') this.bannerEl.className = 'big-banner';
      }, 900);
      P.SFX.play('bell');
    },

    skip() {
      if (this.phase === 'intro') return this.endIntro();
      if (this.phase !== 'fight') {
        if (this.phase === 'outro') this.outroT = 99;
        return;
      }
      // jump to the end position first so debris spawns where the mechs actually are
      this.t = this.sim.duration;
      for (const s of this.ids) {
        this.views[s].x = this.posAt(s, this.t);
        this.views[s].prevX = this.views[s].x;
        P.R.beginWorld();
        this.views[s].draw(P.R.wctx);
      }
      this.quiet = true;
      const ev = this.sim.events;
      while (this.cursor < ev.length) this.onEvent(ev[this.cursor++]);
      this.quiet = false;
    },

    // =====================================================================================
    // UPDATE / RENDER
    // =====================================================================================
    posAt(side, t) {
      const arr = this.sim.frames[side];
      const fi = t / this.sim.dt;
      const i = U.clamp(Math.floor(fi), 0, arr.length - 1);
      const j = Math.min(i + 1, arr.length - 1);
      return arr[i] + (arr[j] - arr[i]) * U.clamp(fi - i, 0, 1);
    },
    update(dt) {
      this.real += dt;
      let step = 0;
      if (this.phase === 'intro') {
        this.introT += dt;
        if (this.introT > 3.2) this.endIntro();
      } else if (this.phase === 'fight' || this.phase === 'outro' || this.phase === 'report') {
        if (!this.paused || this.phase !== 'fight') step = dt * (this.phase === 'fight' ? this.speed : 1);
        if (this.hitstop > 0) {
          this.hitstop -= dt;
          step *= 0.1;
        }
        this.t += step;
        if (this.phase === 'fight') {
          const ev = this.sim.events;
          while (this.cursor < ev.length && ev[this.cursor].t <= this.t) this.onEvent(ev[this.cursor++]);
        }
      }
      for (const s of this.ids) {
        const v = this.views[s];
        v.x = this.posAt(s, Math.min(this.t, this.sim.duration));
        v.update(this.phase === 'intro' ? dt : this.frozen[s] > this.t ? 0 : step);
        if (this.shieldFlash[s] > 0) this.shieldFlash[s] -= dt;
      }
      this.fx.update(this.phase === 'intro' ? dt : step, this.t);
      this.ambient(dt, step || (this.paused ? 0 : dt));
      if (this.phase === 'outro') this.updateOutro(dt);
      // timer + shields
      const left = Math.max(0, P.Sim.MAX_T - Math.min(this.t, this.sim.duration));
      const txt = U.fmtTime(left);
      if (this.timerEl.textContent !== txt) this.timerEl.textContent = txt;
      if (left < 10 && this.phase === 'fight') this.timerEl.classList.add('urgent');
      for (const s of this.ids) {
        const sh = this.shieldNow(s);
        const el = this.hud[s].chassis;
        const w = sh > 0 ? Math.min(100, (sh / (this.maxHp[s].chassis || 1)) * 100) : 0;
        if (el._sh !== w) {
          el.shield.style.width = w + '%';
          el._sh = w;
        }
      }
    },
    shieldNow(side) {
      const arr = this.sim.frames['s' + side];
      const i = U.clamp(Math.floor(Math.min(this.t, this.sim.duration) / this.sim.dt), 0, arr.length - 1);
      return arr[i] || 0;
    },
    ambient(dt, step) {
      const fx = this.fx;
      for (const em of this.env.emitters) {
        if (em.kind === 'fire' && Math.random() < dt * 16) fx.fireBurst(em.x + (Math.random() - 0.5) * 6, em.y, 1);
        if (em.kind === 'fire' && Math.random() < dt * 1.2) fx.smoke(em.x, em.y - 8, 1, { size: 1, color: '#2e2a2c', a: 0.35, life: 2 });
        if (em.kind === 'steam' && Math.random() < dt * 4) fx.smoke(em.x, em.y, 1, { size: 0.9, color: '#c8c0c0', a: 0.18, life: 1.6 });
        if (em.kind === 'zap' && Math.random() < dt * 1.5) {
          fx.spark(em.x, em.y, 6, ['#cff6ff', '#4ad0ff'], 60, { g: 20, glow: true });
          fx.light(em.x, em.y, 18, '#8fe8ff', 0.15, 0.8);
        }
      }
      if (!step) return;
      for (const s of this.ids) {
        const v = this.views[s];
        for (const k in v.parts) {
          const p = v.parts[k];
          const pos = v.pos[k];
          if (!pos) continue;
          if (p.destroyed) {
            const sp = v.stumps[k];
            if (sp && !v.ko && Math.random() < step * 3) fx.spark(sp.x, sp.y, 3, ['#ffd25a', '#ff8a2a'], 50, { glow: true });
            continue;
          }
          if (p.hpFrac < 0.5 && Math.random() < step * (p.hpFrac < 0.25 ? 5 : 2)) fx.smoke(pos.x, pos.y - 2, 1, { size: 0.7, color: '#2a2628', a: 0.45, life: 1.2 });
          if (p.hpFrac < 0.25 && Math.random() < step * 2) fx.spark(pos.x, pos.y, 3, ['#ffd25a', '#ffffff'], 60, { glow: true });
        }
        for (const k in this.burning[s]) {
          const pos = v.pos[k];
          if (this.burning[s][k] < this.t || !pos || (v.parts[k] && v.parts[k].destroyed)) {
            delete this.burning[s][k];
            continue;
          }
          if (Math.random() < step * 14) fx.fireBurst(pos.x + (Math.random() - 0.5) * 6, pos.y + (Math.random() - 0.5) * 4, 1);
        }
        for (const th of v.thrusters) {
          if (th.rocket) {
            if (Math.random() < step * 30) fx.pix.push({ x: th.x, y: th.y, vx: -v.facing * (40 + Math.random() * 40), vy: Math.random() * 10, life: 0.2, max: 0.2, color: Math.random() < 0.5 ? '#ffb04a' : '#fff2a0', size: 1, g: 0, drag: 1, glow: true });
          } else if (Math.random() < step * 20) fx.pix.push({ x: th.x + (Math.random() - 0.5) * 3, y: th.y, vx: 0, vy: 40 + Math.random() * 30, life: 0.15, max: 0.15, color: Math.random() < 0.5 ? '#9ff6ff' : '#ffffff', size: 1, g: 0, drag: 1, glow: true });
        }
        // status effects
        for (const k in this.jammed[s]) {
          const pos = v.pos[k];
          if (this.jammed[s][k] < this.t || !pos || (v.parts[k] && v.parts[k].destroyed)) {
            delete this.jammed[s][k];
            continue;
          }
          if (Math.random() < step * 10) fx.spark(pos.x + (Math.random() - 0.5) * 8, pos.y + (Math.random() - 0.5) * 6, 2, ['#ffffff', '#d8dcff', '#8fa8ff'], 40, { g: 0, glow: true });
        }
        if (this.blind[s] > this.t && Math.random() < step * 6) fx.smoke(v.x + (Math.random() - 0.5) * 24, v.y - 30 + (Math.random() - 0.5) * 16, 1, { size: 1.6, color: '#6a6468', a: 0.45, life: 1.6, rise: 0.2 });
        if (this.frozen[s] > 0 && this.frozen[s] <= this.t) {
          this.frozen[s] = -1;
          for (let i = 0; i < 24; i++) fx.pix.push({ x: v.x + (Math.random() - 0.5) * 30, y: v.y - Math.random() * 40, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80, life: 0.9, max: 0.9, color: ['#ffffff', '#cfeeff', '#8fd8ff'][i % 3], size: Math.random() < 0.5 ? 2 : 1, g: 300, drag: 0.98, bounce: true });
          P.SFX.play('break');
        }
        if (v.hasRepairDrone() && v.dronePos && Math.random() < step * 3) fx.pix.push({ x: v.dronePos.x, y: v.dronePos.y + 2, vx: 0, vy: 10, life: 0.2, max: 0.2, color: '#7dff9a', size: 1, g: 0, drag: 1, glow: true });
      }
    },

    render(dt) {
      const R = P.R;
      R.beginFrame();
      this.env.drawBack(this.real);
      R.beginWorld();
      const w = R.wctx;
      this.fx.drawDebris(w);
      const mineSpr = P.Pixel.get('fx_mine', P.PAINTS[0], {});
      for (const id in this.mines) {
        const mn = this.mines[id];
        w.drawImage(mineSpr.canvas, Math.round(mn.x) - mineSpr.pivot[0], GY + 2 - mineSpr.pivot[1]);
      }
      for (const s of this.drawOrder) this.views[s].draw(w);
      this.fx.drawWorld(w);
      R.presentWorld();
      for (const id in this.mines) {
        const mn = this.mines[id];
        if (Math.sin(this.real * 10 + mn.x) > 0) R.glow(mn.x, GY - 1, 6, '#ff3a2a', 0.8);
      }
      for (const s of this.ids) {
        const v = this.views[s];
        for (const l of v.lights) R.glow(l.x, l.y, l.r, l.color, l.a);
        const b = this.buffs[s];
        const c = v.pos.chassis || { x: v.x, y: v.y - 24 };
        if (b.dmg > this.t) R.glow(c.x, c.y, 30, '#ff4a3a', 0.3 + Math.sin(this.real * 12) * 0.1);
        if (b.turbo > this.t) R.glow(c.x, c.y + 8, 26, '#ffe04a', 0.28 + Math.sin(this.real * 15) * 0.1);
        if (this.frozen[s] > this.t) this.drawIce(v);
        if (v.phase2) R.glow(v.pos.chassis ? v.pos.chassis.x : v.x, (v.pos.chassis ? v.pos.chassis.y : v.y - 20), 26, '#ff3a3a', 0.35 + Math.sin(this.real * 8) * 0.1);
        this.drawShield(s);
      }
      this.fx.drawScreen();
      this.env.drawFront(this.real, dt);
    },
    drawIce(v) {
      const R = P.R;
      const vc = R.vctx;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const k in v.pos) {
        const p = v.pos[k];
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
      if (x0 > x1) return;
      x0 -= 12;
      x1 += 12;
      y0 -= 14;
      y1 = Math.max(y1 + 6, v.y);
      const sx = R.sx(x0), sy = R.sy(y0), sw = (x1 - x0) * R.scale, sh = (y1 - y0) * R.scale;
      vc.save();
      vc.fillStyle = 'rgba(190,235,255,0.32)';
      vc.fillRect(sx, sy, sw, sh);
      vc.strokeStyle = 'rgba(255,255,255,0.75)';
      vc.lineWidth = R.scale * 0.6;
      vc.strokeRect(sx, sy, sw, sh);
      vc.globalAlpha = 0.6;
      vc.beginPath();
      vc.moveTo(sx + sw * 0.15, sy + sh * 0.1);
      vc.lineTo(sx + sw * 0.35, sy + sh * 0.1);
      vc.lineTo(sx + sw * 0.1, sy + sh * 0.45);
      vc.moveTo(sx + sw * 0.8, sy + sh * 0.55);
      vc.lineTo(sx + sw * 0.6, sy + sh * 0.9);
      vc.stroke();
      vc.restore();
    },
    drawShield(s) {
      const sh = this.shieldNow(s);
      const fl = this.shieldFlash[s];
      if (sh <= 0 && fl <= 0) return;
      const v = this.views[s];
      const c = v.pos.chassis || { x: v.x, y: v.y - 24 };
      const R = P.R;
      const vc = R.vctx;
      const rx = 26 * R.scale, ry = 32 * R.scale;
      const a = U.clamp(sh / 30, 0.2, 1) * (0.5 + Math.sin(this.real * 4) * 0.1) + Math.max(0, fl) * 2;
      vc.save();
      vc.globalCompositeOperation = 'lighter';
      vc.translate(R.sx(c.x), R.sy(c.y - 2));
      vc.scale(1, ry / rx);
      const g = vc.createRadialGradient(0, 0, rx * 0.6, 0, 0, rx);
      g.addColorStop(0, 'rgba(90,200,255,0)');
      g.addColorStop(0.85, `rgba(90,200,255,${0.18 * a})`);
      g.addColorStop(1, `rgba(180,240,255,${0.5 * a})`);
      vc.fillStyle = g;
      vc.beginPath();
      vc.arc(0, 0, rx, 0, Math.PI * 2);
      vc.fill();
      vc.restore();
    },

    // =====================================================================================
    // EVENTS
    // =====================================================================================
    onEvent(e) {
      const q = this.quiet;
      const fx = this.fx;
      const V = this.views;
      const pn = (side, key) => (this.sim.partNames[side] && this.sim.partNames[side][key]) || key;
      switch (e.type) {
        case 'start':
          this.announce('start', {}, true);
          break;
        case 'fire': {
          this.shots[e.id] = e;
          if (q) break;
          const sh = V[e.src], tg = V[e.dst || other(e.src)];
          const dist = Math.abs(sh.x - tg.x);
          sh.onFire(e.part, e.vfx, dist);
          const f = sh.muzzles[e.part] || sh.pos[e.part] || { x: sh.x + sh.facing * 10, y: sh.y - 26 };
          const toFn = () => tg.pos[e.target] || tg.pos.chassis || { x: tg.x, y: tg.y - 22 };
          if (PROJ[e.vfx]) {
            let arc = e.vfx === 'rocket' ? 8 + Math.random() * 22 : e.vfx === 'swarm' ? (Math.random() - 0.3) * 50 : ARC[e.vfx] || 0;
            const color = e.vfx === 'can' ? ['#d63b35', '#3d71e0', '#5cba62', '#f0c040'][e.id % 4] : null;
            const p = { id: e.id, kind: e.vfx, from: { x: f.x, y: f.y }, toFn, t0: e.t, t1: e.impactT, arc, dir: sh.facing, color };
            if (e.vfx === 'mine') p.toFn = () => ({ x: e.mx, y: GY + 1 });
            if (e.vfx === 'harpoon') p.ropeFn = () => sh.muzzles[e.part];
            if (e.vfx === 'boomerang') {
              p.t2 = e.retT;
              p.homeFn = () => sh.muzzles[e.part] || { x: sh.x, y: sh.y - 24 };
            }
            fx.projectile(p);
            if (e.vfx === 'bullet' || e.vfx === 'nail' || e.vfx === 'revolver' || (e.vfx === 'pellet' && !e.pellet)) {
              fx.muzzle(f.x, f.y, '#ffd27a', e.vfx === 'pellet' ? 1.6 : 1);
              fx.pix.push({ x: f.x - sh.facing * 4, y: f.y, vx: -sh.facing * 40, vy: -60, life: 0.6, max: 0.6, color: '#e9bb4c', size: 1, g: 300, drag: 0.99, bounce: true });
            }
            if (e.vfx === 'rocket' || e.vfx === 'mortar') {
              fx.smoke(f.x, f.y, 3, { size: 0.8, color: '#7a7478', a: 0.5, life: 0.8 });
              fx.light(f.x, f.y, 14, '#ffb04a', 0.12, 0.8);
            }
            if (e.vfx === 'mortar') P.SFX.play('whistle');
          } else if (e.vfx === 'flame') {
            fx.flameStream(f, toFn(), 12);
          } else if (e.vfx === 'acid') {
            fx.stream(f, toFn(), 9, ['#a8ff3a', '#6ad41a', '#e0ff8a'], '#a8ff3a', 120);
          } else if (e.vfx === 'sonic') {
            fx.sonic(f, toFn());
          } else if (e.vfx === 'emp') {
            fx.ring(f.x, f.y, '#d8dcff', 10, 0.25, 1);
          } else if (e.vfx === 'bigbeam' || e.vfx === 'rail') {
            fx.charge(() => sh.muzzles[e.part], e.vfx === 'rail' ? '#7fd0ff' : '#b6f5ff', Math.max(0.2, e.impactT - e.t));
          } else if (e.vfx === 'blackhole') {
            fx.charge(() => sh.muzzles[e.part], '#b07aff', Math.max(0.2, e.impactT - e.t));
          } else if (e.vfx === 'laser' || e.vfx === 'arc' || e.vfx === 'tesla') {
            fx.light(f.x, f.y, 10, e.vfx === 'laser' ? '#ff5a6a' : '#8fe8ff', 0.15, 0.9);
          }
          if (!(e.vfx === 'pellet' && e.pellet)) P.SFX.play(FIRE_SFX[e.vfx] || 'shot', { gap: e.vfx === 'flame' ? 150 : 40 });
          break;
        }
        case 'hit': {
          const tg = V[e.dst], sh = V[e.src];
          this.setPartHp(e.dst, e.part, e.hp);
          if (q) break;
          const pos = tg.pos[e.part] || tg.pos.chassis || { x: tg.x, y: tg.y - 20 };
          const shot = this.shots[e.id];
          const vfx = shot ? shot.vfx : null;
          if (!e.sec && vfx !== 'boomerang') fx.killProjectile(e.id, false);
          tg.onHit(e.part, e.crit || e.dmg >= 15);
          if (vfx && !e.sec) {
            const f = sh.muzzles[shot.part] || sh.pos[shot.part];
            if (f) {
              if (vfx === 'laser') {
                fx.beam({ kind: 'laser', x1: f.x, y1: f.y, x2: pos.x, y2: pos.y, color: '#ff3a4a', life: 0.18, width: 0.8 });
                P.SFX.play('laser');
              }
              if (vfx === 'arc' || vfx === 'tesla') {
                fx.beam({ kind: vfx, x1: f.x, y1: f.y, x2: pos.x, y2: pos.y, color: '#8fe8ff', life: 0.25 });
                P.SFX.play('zap');
              }
              if (vfx === 'cryo') {
                fx.beam({ kind: 'cryo', x1: f.x, y1: f.y, x2: pos.x, y2: pos.y, color: '#cfeeff', life: 0.22 });
              }
              if (vfx === 'rail') {
                const dx = pos.x - f.x || sh.facing, dy = pos.y - f.y;
                const k = 520 / Math.abs(dx);
                fx.beam({ kind: 'laser', x1: f.x, y1: f.y, x2: f.x + dx * k, y2: f.y + dy * k, color: '#7fd0ff', life: 0.4, width: 1.8 });
                fx.screenFlash('#cff6ff', 0.3);
                fx.shake(4);
                P.SFX.play('rail');
              }
              if (vfx === 'blackhole') {
                fx.vortex(pos.x, pos.y - 4, 0.9);
                P.SFX.play('blackhole');
              }
              if (vfx === 'bigbeam') {
                fx.beam({ kind: 'laser', x1: f.x, y1: f.y, x2: pos.x + tg.facing * 200, y2: pos.y + (pos.y - f.y) * 0.3, color: '#7fe8ff', life: 0.5, width: 2.4 });
                fx.shake(5);
                fx.screenFlash('#bff6ff', 0.25);
                fx.scorch(pos.x, GY + 4, 10);
                P.SFX.play('bigbeam');
              }
            }
          }
          if (e.from && tg.pos[e.from]) {
            const fp = tg.pos[e.from];
            if (vfx === 'tesla' || vfx === 'arc') fx.beam({ kind: 'tesla', x1: fp.x, y1: fp.y, x2: pos.x, y2: pos.y, color: '#8fe8ff', life: 0.22 });
            else fx.beam({ kind: 'laser', x1: fp.x, y1: fp.y, x2: pos.x, y2: pos.y, color: vfx === 'rail' ? '#7fd0ff' : '#ffe7a0', life: 0.14, width: 0.4 });
          }
          fx.impact(pos.x, pos.y, e.dtype, e.crit, vfx);
          const col = (P.DMG_TYPES[e.dtype] || P.DMG_TYPES.melee).color;
          const size = e.dtype === 'burn' ? 7 : 9 + Math.min(8, e.dmg / 4) + (e.crit ? 4 : 0);
          fx.text(pos.x, pos.y - 8, String(e.dmg) + (e.crit ? '!' : ''), { color: col, size, crit: e.crit, stroke: e.dst === 'A' ? '#3a0a0a' : '#120c10' });
          if (e.crit) {
            fx.text(pos.x, pos.y - 20, P.t('CRIT'), { color: '#ffe04a', size: 8, life: 0.8 });
            P.SFX.play('crit');
            this.env.excite = 1;
            this.announce('crit', { a: this.names[e.src], d: this.names[e.dst] });
            if (sh.parts.head && sh.parts.head.def.special === 'duck' && !sh.parts.head.destroyed) {
              const hp = sh.pos.head;
              if (hp) fx.text(hp.x, hp.y - 10, P.t('QUACK!'), { color: '#ffe04a', size: 9 });
              P.SFX.play('quack');
            }
            if (sh.parts.chassis.def.special === 'screen') fx.text(sh.pos.chassis.x, sh.pos.chassis.y - 16, '1UP!', { color: '#ff7ae0', size: 8 });
            if (e.dtype === 'melee') this.hitstop = 0.07;
          }
          if (vfx === 'glove' && !e.sec) fx.text(pos.x, pos.y - 26, P.t('BOING!'), { color: '#ff8a8a', size: 10, life: 0.8 });
          if (vfx === 'ball' && !e.sec) fx.text(pos.x, pos.y - 26, P.t('CLANG!'), { color: '#ffd25a', size: 10, life: 0.8 });
          if (e.dtype === 'melee') P.SFX.play('clank');
          else if (e.dtype === 'ballistic') P.SFX.play('hit', { gap: 50 });
          if (!this.firstBlood && e.src !== e.dst && e.dtype !== 'self') {
            this.firstBlood = true;
            this.announce('firstBlood', { a: this.names[e.src] }, true);
          }
          break;
        }
        case 'miss': {
          const tg = V[e.dst];
          if (q) break;
          const pos = tg.pos[e.part] || tg.pos.chassis || { x: tg.x, y: tg.y - 20 };
          fx.killProjectile(e.id, true);
          const label = e.reason === 'dazzle' ? P.t('DAZZLED') : e.reason === 'whiff' ? P.t('WHIFF') : e.reason === 'blank' ? P.t('*CLICK* BLANK!') : P.t('MISS');
          if (e.reason === 'blank') P.SFX.play('click');
          fx.text(pos.x + tg.facing * -4, pos.y - 4, label, { color: e.reason === 'dazzle' ? '#ff9aff' : '#b8b4c0', size: 7, life: 0.7, vy: -14 });
          const shot = this.shots[e.id];
          if (shot && (shot.vfx === 'laser' || shot.vfx === 'arc' || shot.vfx === 'tesla')) {
            const sh = V[e.src];
            const f = sh.muzzles[shot.part] || sh.pos[shot.part];
            if (f) fx.beam({ kind: shot.vfx === 'laser' ? 'laser' : shot.vfx, x1: f.x, y1: f.y, x2: pos.x + tg.facing * 30, y2: pos.y - 14, color: shot.vfx === 'laser' ? '#ff3a4a' : '#8fe8ff', life: 0.15, width: 0.7 });
          }
          if (e.reason === 'dazzle') fx.spark(pos.x, pos.y - 10, 8, ['#ffffff', '#ff9aff', '#9affff'], 60, { g: 0, glow: true });
          break;
        }
        case 'absorb': {
          this.shieldFlash[e.dst] = 0.25;
          if (q) break;
          const tg = V[e.dst];
          const c = tg.pos.chassis || { x: tg.x, y: tg.y - 24 };
          fx.killProjectile(e.id, false);
          fx.text(c.x + tg.facing * -12, c.y - 18, P.t('ABSORB {n}', { n: e.amt }), { color: '#7fd9ff', size: 8, life: 0.8 });
          fx.spark(c.x - tg.facing * 20, c.y, 6, ['#bff6ff', '#4ad0ff'], 50, { g: 0, glow: true });
          P.SFX.play('shield');
          break;
        }
        case 'block': {
          if (q) break;
          const tg = V[e.dst];
          const pos = tg.pos[e.part];
          if (pos) fx.text(pos.x, pos.y - 14, P.t('BLOCK!'), { color: '#cfe6f0', size: 9, life: 0.8 });
          this.announce('block', { d: this.names[e.dst] });
          break;
        }
        case 'limb': {
          const tg = V[e.dst];
          const deb = tg.loseLimb(e.n);
          if (q) {
            for (const d of deb) fx.debrisFrom(d, tg.x, 0.6);
            break;
          }
          for (const d of deb) fx.debrisFrom(d, tg.x - tg.facing * 10, 1);
          const pos = tg.pos.legs || { x: tg.x, y: GY - 8 };
          fx.callout(P.t('LEG SNAPPED!'), pos.x, pos.y - 34, '#ffb04a');
          fx.shake(3);
          P.SFX.play('break');
          this.env.excite = 1;
          this.announce('limb', { d: this.names[e.dst] }, true);
          break;
        }
        case 'destroy': {
          const tg = V[e.dst];
          const pos = tg.pos[e.part] || { x: tg.x, y: tg.y - 20 };
          if (e.part === 'chassis') {
            this.setPartHp(e.dst, 'chassis', 0);
            if (this.team) this.unitKo(e.dst, q);
            break;
          }
          const deb = tg.destroyPart(e.part);
          for (const d of deb) fx.debrisFrom(d, tg.x - tg.facing * 8, e.part === 'head' ? 1.5 : 1);
          if (q) break;
          fx.explosion(pos.x, pos.y, 0.7, { silent: true });
          const nm = pn(e.dst, e.part);
          fx.callout(e.how === 'rip' ? P.t('RIPPED OFF: {name}', { name: nm.toUpperCase() }) : P.t('{name} DESTROYED!', { name: nm.toUpperCase() }), pos.x, Math.min(pos.y - 30, (tg.topY || GY - 60) - 6), e.dst === 'A' ? '#ff6a5a' : '#ffcf5a');
          P.SFX.play('break');
          this.env.excite = 1;
          const cat = P.slotCat(e.part);
          const key = cat === 'arm' ? 'destroy_arm' : cat === 'head' ? 'destroy_head' : cat === 'legs' ? 'destroy_legs' : 'destroy_mount';
          this.announce(key, { d: this.names[e.dst], p: nm }, true);
          break;
        }
        case 'stumble': {
          V[e.dst].stumble(e.dur);
          if (q) break;
          const v = V[e.dst];
          fx.text(v.x, GY - 50, P.t('TIMBER!'), { color: '#ffd25a', size: 9, life: 0.9 });
          setTimeout(() => {
            fx.smoke(v.x - v.facing * 18, GY, 5, { size: 1.2, color: '#6a5a50', a: 0.4 });
            fx.shake(2);
          }, 200 / this.speed);
          P.SFX.play('fall');
          this.announce('stumble', { d: this.names[e.dst] });
          break;
        }
        case 'burn':
          this.burning[e.dst][e.part] = e.until;
          if (q) break;
          if (!this.burnAnn[e.dst]) {
            this.burnAnn[e.dst] = true;
            this.announce('burn', { d: this.names[e.dst] });
          }
          break;
        case 'slow': {
          const tg = V[e.dst];
          tg.stuck[e.part] = tg.t + (e.until - e.t);
          if (q) break;
          const pos = tg.pos[e.part];
          if (pos) fx.text(pos.x, pos.y - 16, P.t('SLOWED'), { color: '#ff9a8a', size: 7, life: 0.8 });
          break;
        }
        case 'heal': {
          const tg = V[e.dst];
          this.setPartHp(e.dst, e.part, e.hp);
          if (q) break;
          const pos = tg.pos[e.part] || tg.pos.chassis;
          if (!pos) break;
          if (e.why === 'drone') {
            tg.droneTarget = e.part;
            tg.droneUntil = tg.t + 0.8;
            if (tg.dronePos) fx.beam({ kind: 'laser', x1: tg.dronePos.x, y1: tg.dronePos.y + 2, x2: pos.x, y2: pos.y, color: '#7dff9a', life: 0.35, width: 0.5 });
          }
          fx.text(pos.x, pos.y - 10, '+' + e.amt, { color: '#8aff9a', size: 8, life: 0.9 });
          fx.spark(pos.x, pos.y, 5, ['#8aff9a', '#ffffff'], 40, { g: -40, glow: true });
          P.SFX.play('heal', { gap: 200 });
          if (e.why === 'drone') this.announce('heal', {});
          if (e.why === 'pit') {
            fx.callout(P.t('PIT STOP!'), pos.x, (tg.topY || GY - 60) - 6, '#ffd76a');
            P.SFX.play('clank');
            this.announce('pit', { d: this.names[e.dst] }, true);
          }
          if (e.why === 'magnet') fx.text(pos.x, pos.y - 20, P.t('SCRAP MAGNET'), { color: '#c7a56a', size: 7 });
          break;
        }
        case 'lucky': {
          if (q) break;
          const tg = V[e.dst];
          const pos = tg.pos[e.part] || tg.pos.chassis;
          if (pos) fx.text(pos.x, pos.y - 22, P.t('LUCKY!'), { color: '#7dff8a', size: 10, life: 1.2 });
          this.announce('lucky', { d: this.names[e.dst], p: pn(e.dst, e.part) }, true);
          break;
        }
        case 'rip':
          if (!q) this.announce('rip', { a: this.names[e.src], p: pn(e.dst, e.part) }, true);
          break;
        case 'disarm':
          if (!q) this.announce('disarm', { d: this.names[e.dst] }, true);
          break;
        case 'lowhp':
          if (!this.isBoss) P.Music.setIntensity(0.8);
          if (!q) this.announce('lowhp', { d: this.names[e.dst] });
          break;
        case 'vend': {
          if (q) break;
          const sh = V[e.src];
          const m = sh.muzzles.mount0 || sh.muzzles.mount1 || sh.pos.chassis;
          const lab = VEND[e.item];
          if (m && lab) fx.text(m.x, m.y - 10, P.t(lab[0]), { color: lab[1], size: 8, life: 0.9 });
          if (e.item === 'jackpot') {
            P.SFX.play('jackpot');
            this.announce('jackpot', {}, true);
          }
          break;
        }
        case 'phase': {
          const v = V[e.dst];
          v.phase2 = true;
          if (q) break;
          P.Music.setIntensity(1);
          fx.screenFlash('#ff3a3a', 0.7);
          fx.shake(7);
          fx.callout(P.t('LIMITER OFF!'), v.x, (v.topY || 140) - 10, '#ff4a3a');
          fx.smoke(v.x, GY - 30, 12, { size: 1.6, color: '#e8e0e0', a: 0.35, life: 1.5 });
          P.SFX.play('phase');
          const pb = this.builds[e.dst];
          const line = teamOf(e.dst) === 'B' && this.bout ? (this.team ? (P.ENEMIES[(P.TEAMS[this.bout.team].units[this.idsB.indexOf(e.dst)] || {}).enemy] || {}).phase2 : S.boutFoe(this.bout).phase2) : pb.pilotFx && pb.pilotFx.phase2 ? P.tc('enemies', 'baron', 'phase2', P.ENEMIES.baron.phase2) : null;
          if (line) this.say(pb.pilot || this.names[e.dst], line, teamOf(e.dst) === 'B' ? 'enemy' : '');
          setTimeout(() => this.announce('phase', {}, true), 1500);
          break;
        }
        case 'chamber': {
          if (q) break;
          const c = CHAMBER_TXT[e.kind];
          if (!c || e.kind === 'blank') break;
          const shot = this.shots[e.id];
          const tg = V[(shot && shot.dst) || other(e.src)];
          const pos = tg.pos.chassis || { x: tg.x, y: tg.y - 24 };
          fx.text(pos.x, pos.y - 30, P.t(c[0]), { color: c[1], size: e.kind === 'golden' || e.kind === 'fan' ? 11 : 8, life: 1 });
          if (e.kind === 'golden' || e.kind === 'fan') {
            P.SFX.play('jackpot');
            this.announce('chamber', { a: this.names[e.src] }, true);
          }
          break;
        }
        case 'corrode': {
          if (q) break;
          const tg = V[e.dst];
          const pos = tg.pos[e.part] || tg.pos.chassis;
          if (pos) {
            fx.text(pos.x, pos.y - 18, P.t('ARMOR -1'), { color: '#a8ff3a', size: 8, life: 0.9 });
            for (let i = 0; i < 6; i++) fx.pix.push({ x: pos.x + (Math.random() - 0.5) * 8, y: pos.y, vx: 0, vy: 10 + Math.random() * 20, life: 1.2, max: 1.2, color: '#a8ff3a', size: 1, g: 60, drag: 0.98, glow: true, bounce: true });
          }
          P.SFX.play('acid', { gap: 200 });
          if (e.total === 1 || e.total === 4) this.announce('corrode', { d: this.names[e.dst] });
          break;
        }
        case 'frost': {
          if (q) break;
          const tg = V[e.dst];
          const pos = tg.pos.chassis || { x: tg.x, y: tg.y - 24 };
          fx.text(pos.x, pos.y - 24, P.t('FROST {n}/4', { n: e.n }), { color: '#cfeeff', size: 7, life: 0.8 });
          break;
        }
        case 'freeze': {
          this.frozen[e.dst] = e.t + e.dur;
          if (q) break;
          const tg = V[e.dst];
          fx.callout(P.t('FROZEN SOLID!'), tg.x, (tg.topY || GY - 60) - 8, '#cfeeff');
          fx.screenFlash('#e8f8ff', 0.2);
          P.SFX.play('freeze');
          this.announce('freeze', { d: this.names[e.dst] }, true);
          break;
        }
        case 'jam': {
          this.jammed[e.dst][e.part] = e.until;
          if (q) break;
          const pos = V[e.dst].pos[e.part];
          if (pos) fx.text(pos.x, pos.y - 14, P.t('JAMMED!'), { color: '#d8dcff', size: 8, life: 1 });
          P.SFX.play('zap');
          this.announce('jam', { d: this.names[e.dst], p: pn(e.dst, e.part) });
          break;
        }
        case 'blind': {
          this.blind[e.dst] = e.until;
          if (q) break;
          const tg = V[e.dst];
          fx.smoke(tg.x, tg.y - 26, 14, { size: 2, color: '#6a6468', a: 0.6, life: 2.2, spread: 6, rise: 0.3 });
          fx.text(tg.x, (tg.topY || GY - 60) - 4, P.t('BLINDED!'), { color: '#c8c4cc', size: 8, life: 1 });
          this.announce('blind', { d: this.names[e.dst] });
          break;
        }
        case 'pull': {
          if (q) break;
          const sh = V[e.src], tg = V[e.dst];
          const shot = this.shots[e.id];
          if (shot && shot.vfx === 'harpoon') {
            const mz = sh.muzzles[shot.part];
            const c = tg.pos.chassis;
            if (mz && c) fx.beam({ kind: 'rope', x1: mz.x, y1: mz.y, x2: c.x, y2: c.y, color: '#8a6a44', life: 0.45 });
            fx.text(tg.x, (tg.topY || GY - 60) - 2, P.t('REELED IN!'), { color: '#ffd9a0', size: 8, life: 0.9 });
            this.announce('pull', { a: this.names[e.src], d: this.names[e.dst] });
          }
          break;
        }
        case 'mine':
          this.mines[e.id] = { x: e.x, src: e.src, t: e.t };
          if (!q) {
            fx.spark(e.x, GY + 1, 4, ['#8a7a6a', '#5a4a3a'], 40, { up: 30 });
            P.SFX.play('mine', { gap: 100 });
          }
          break;
        case 'mineBoom':
          delete this.mines[e.id];
          if (q) break;
          fx.explosion(e.x, GY - 2, 1.3);
          fx.ring(e.x, GY, '#ffb04a', 30, 0.35, 1.6);
          fx.text(e.x, GY - 40, P.t('KA-BOOM!'), { color: '#ffa143', size: 10, life: 0.9 });
          this.env.excite = 1;
          this.announce('mine', { d: this.names[e.dst || other(e.src)] }, true);
          break;
        case 'mineGone':
          if (this.mines[e.id] && !q) fx.smoke(this.mines[e.id].x, GY, 2, { size: 0.6, color: '#5a5048', a: 0.4 });
          delete this.mines[e.id];
          break;
        case 'phoenix': {
          this.setPartHp(e.dst, 'chassis', e.hp);
          const v = V[e.dst];
          v.hpReborn = true;
          if (q) break;
          const c = v.pos.chassis || { x: v.x, y: v.y - 24 };
          fx.screenFlash('#ffb04a', 0.7);
          fx.explosion(c.x, c.y, 1.8, { color: '#ff7a2a' });
          fx.ring(c.x, c.y, '#ff8a2a', 90, 0.7, 3);
          fx.ring(c.x, c.y, '#ffe08a', 60, 0.5, 2);
          for (let i = 0; i < 40; i++) {
            const a = Math.random() * Math.PI * 2;
            fx.pix.push({ x: c.x, y: c.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 90, life: 0.6, max: 0.6, color: ['#ffd25a', '#ff8a2a', '#ff5a1a'][i % 3], size: 2, g: -20, drag: 0.95, glow: true, flame: true });
          }
          fx.callout(P.t('PHOENIX PROTOCOL!'), c.x, (v.topY || GY - 60) - 10, '#ffb04a');
          P.SFX.play('phoenix');
          this.announce('phoenix', { d: this.names[e.dst] }, true);
          break;
        }
        case 'golem': {
          this.maxHp[e.dst].chassis = e.max;
          this.setPartHp(e.dst, 'chassis', e.hp);
          if (q) break;
          const c = V[e.dst].pos.chassis;
          if (c) {
            fx.text(c.x, c.y - 20, P.t('+SCRAP x{n}', { n: e.n }), { color: '#7dff8a', size: 8, life: 0.9 });
            fx.light(c.x, c.y, 24, '#7dff8a', 0.4, 0.6);
          }
          P.SFX.play('golem', { gap: 150 });
          if (e.n === 5 || e.n === 10) this.announce('golem', { d: this.names[e.dst] });
          break;
        }
        case 'mimic': {
          const v = V[e.src];
          v.mimicDef = P.PARTS[e.wid] || null;
          if (q) break;
          fx.text(v.x, (v.topY || GY - 60) - 6, P.t('MIMIC: {name}!', { name: (P.PARTS[e.wid] ? P.partName(e.wid) : e.name).toUpperCase() }), { color: '#c08aff', size: 9, life: 1.6, vy: -8 });
          P.SFX.play('zap');
          setTimeout(() => this.announce('mimic', { a: this.names[e.src] }, true), 600);
          break;
        }
        case 'rush': {
          if (q) break;
          const sh = V[e.src], tg = V[e.dst];
          sh.onFire('ram', 'ram', Math.abs(sh.x - tg.x));
          fx.fireBurst(sh.x - sh.facing * 10, GY - 4, 8);
          const pos = tg.pos[e.part] || tg.pos.chassis;
          if (pos) {
            fx.spark(pos.x, pos.y, 16, ['#ffffff', '#ffd25a', '#ff8a2a'], 150, { glow: true });
            fx.text(pos.x, pos.y - 26, P.t('ROCKET RUSH!'), { color: '#ffb04a', size: 9, life: 0.9 });
          }
          fx.shake(3);
          P.SFX.play('rush');
          break;
        }
        case 'adapt': {
          if (q) break;
          const v = V[e.dst];
          const hp = v.pos.head || v.pos.chassis;
          if (hp) fx.text(hp.x, hp.y - 12, e.n === 1 ? P.t('ADAPTING...') : P.t('SEEN IT BEFORE!'), { color: '#ff7ae0', size: 8, life: 1 });
          break;
        }
        case 'lottery': {
          const L = LOTTO_TXT[e.prize];
          const b = this.buffs[e.dst];
          if (e.prize === 'overdrive' || e.prize === 'jackpot') b.dmg = e.t + 4;
          if (e.prize === 'turbo' || e.prize === 'jackpot') b.turbo = e.t + 4;
          if (q) break;
          const v = V[e.dst];
          fx.text(v.x, (v.topY || GY - 60) - 4, '🎰 ' + P.t(L[0]), { color: L[1], size: e.prize === 'jackpot' ? 11 : 8, life: 1.1 });
          P.SFX.play(e.prize === 'jackpot' ? 'jackpot' : e.prize === 'dud' ? 'ui_bad' : 'lottery');
          if (e.prize === 'jackpot') this.announce('jackpot', {}, true);
          break;
        }
        case 'end':
          this.startOutro(e);
          break;
      }
    },

    // =====================================================================================
    // OUTRO
    // =====================================================================================
    startOutro(e) {
      P.Music.play(null);
      this.phase = 'outro';
      this.outroT = 0;
      this.endEvent = e;
      const winner = e.winner, loser = other(winner);
      // the losing team's last mech standing (or the lead in a 1v1) gets the big K.O.; every winner celebrates
      const loserIds = this.ids.filter((s) => teamOf(s) === loser);
      const lastLoser = this.team ? loserIds.find((s) => !this.views[s].ko && this.sim.final[s].chassis.destroyed) || loserIds.find((s) => !this.views[s].ko) || loserIds[0] : loser;
      const lv = this.views[lastLoser];
      const winViews = this.ids.filter((s) => teamOf(s) === winner && !this.views[s].ko).map((s) => this.views[s]);
      const wv = winViews[0] || this.views[winner];
      const fx = this.fx;
      const q = (at, fn) => this.outroQueue.push({ at, fn });
      if (e.reason === 'ko') {
        this.banner(P.t('K.O.!'), 'ko');
        P.SFX.play('boom_big');
        fx.screenFlash('#ffffff', 0.5);
        this.env.excite = 1;
        const boom = (sz) => () => {
          const keys = Object.keys(lv.pos);
          const k = keys[Math.floor(Math.random() * keys.length)];
          const p = lv.pos[k] || { x: lv.x, y: lv.y - 20 };
          fx.explosion(p.x + (Math.random() - 0.5) * 10, p.y, sz);
        };
        q(0, boom(1.4));
        q(0.35, boom(0.9));
        q(0.7, boom(1.1));
        q(1.0, () => {
          for (const k of Object.keys(lv.parts)) {
            if (k === 'chassis' || lv.parts[k].destroyed) continue;
            for (const d of lv.destroyPart(k)) fx.debrisFrom(d, lv.x, k === 'head' ? 1.8 : 1.2);
          }
          lv.ko = true;
          fx.explosion(lv.x, lv.y - 20, 1.8);
          fx.smoke(lv.x, lv.y - 24, 10, { size: 1.6, color: '#1e1a1c', a: 0.6, life: 2.5 });
        });
        this.announce('ko', { d: this.team ? this.teamName[loser] : this.names[loser] }, true);
      } else {
        this.banner(P.t('TIME!'), 'time');
        P.SFX.play('bell');
        this.announce('timeout', {}, true);
        q(0.9, () => {
          this.banner(P.t("JUDGES' DECISION"), 'time');
          lv.mood = 0;
        });
      }
      q(e.reason === 'ko' ? 1.6 : 2.2, () => {
        wv.victory = true;
        for (const v of winViews) v.victory = true;
        const playerWon = winner === 'A';
        if (this.mode === 'replay') this.banner(`${(this.team ? this.teamName[winner] : this.names[winner]).toUpperCase()} ${P.t('WINS')}`, playerWon ? 'win' : 'lose');
        else this.banner(playerWon ? P.t('VICTORY!') : P.t('DEFEAT...'), playerWon ? 'win' : 'lose');
        P.SFX.play(playerWon ? 'win' : 'lose');
        if (playerWon) P.SFX.play('crowd');
      });
      q(e.reason === 'ko' ? 4.0 : 4.4, () => this.showReport());
    },
    // a teammate goes down mid-fight (team bouts): the rest keep fighting
    unitKo(id, quiet) {
      const v = this.views[id];
      if (v.ko) return;
      for (const k of Object.keys(v.parts)) {
        if (k === 'chassis' || v.parts[k].destroyed) continue;
        for (const d of v.destroyPart(k)) this.fx.debrisFrom(d, v.x, 1);
      }
      v.ko = true;
      if (quiet) return;
      this.fx.explosion(v.x, v.y - 20, 1.4);
      this.fx.smoke(v.x, v.y - 24, 8, { size: 1.4, color: '#1e1a1c', a: 0.6, life: 2.2 });
      this.fx.shake(5);
      P.SFX.play('boom_big');
      this.env.excite = 1;
      const left = this.ids.filter((s) => teamOf(s) === teamOf(id) && !this.views[s].ko).length;
      if (left > 0) {
        this.fx.callout(P.t('{name} IS OUT!', { name: this.names[id].toUpperCase() }), v.x, (v.topY || GY - 60) - 8, teamOf(id) === 'A' ? '#ff6a5a' : '#ffcf5a');
        this.announce('teamKo', { d: this.names[id] }, true);
      }
    },
    updateOutro(dt) {
      this.outroT += dt;
      for (const it of this.outroQueue) {
        if (!it.done && this.outroT >= it.at) {
          it.done = true;
          it.fn();
        }
      }
      if (this.outroT >= 99 && this.phase === 'outro') {
        for (const it of this.outroQueue) if (!it.done) {
          it.done = true;
          it.fn();
        }
      }
      for (const s of this.ids) {
        const v = this.views[s];
        if (v.ko && Math.random() < dt * 6) this.fx.smoke(v.x + (Math.random() - 0.5) * 16, v.y - 16, 1, { size: 1.1, color: '#1e1a1c', a: 0.5, life: 2 });
      }
      if (this.ids.some((s) => this.views[s].victory)) {
        if (Math.random() < dt * 20) {
          const colors = ['#ff5a5a', '#ffd25a', '#5ad0ff', '#7dff8a', '#ff7ae0', '#ffffff'];
          this.fx.pix.push({ x: Math.random() * 480, y: -4, vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 40, life: 6, max: 6, color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() < 0.5 ? 2 : 1, g: 6, drag: 0.995 });
        }
      }
    },

    // =====================================================================================
    // REPORT
    // =====================================================================================
    showReport() {
      if (this.phase === 'report') return;
      this.phase = 'report';
      this.bannerEl.className = 'big-banner';
      P.Music.play('hub');
      const sim = this.sim;
      const won = sim.winner === 'A';
      let res = null;
      if (this.mode === 'campaign') {
        res = this.team
          ? S.applyTeamBattle(this.bout, sim, this.lineup, this.equipSnaps, !!this.params.rematch, this.teamB)
          : S.applyBattle(this.bout, sim, this.equipSnap, !!this.params.rematch, this.B);
        S.addReplay(this.replayObj);
        this.result = res;
      }
      const sA = (sim.teamStats || sim.stats).A, sB = (sim.teamStats || sim.stats).B;
      const acc = (s) => (s.shots ? Math.round((s.hits / s.shots) * 100) + '%' : '—');
      const wrap = h('div', { class: 'report-wrap' });
      const panel = h('div', { class: 'panel report' });
      wrap.appendChild(panel);
      const head = this.mode === 'replay' ? P.t('{name} wins', { name: this.team ? this.teamName[sim.winner] : this.names[sim.winner] }) : won ? P.t('Victory!') : P.t('Defeat');
      panel.appendChild(h('div', { class: 'rep-head ' + (won ? 'win' : 'lose') },
        h('div', { class: 'rep-title' }, head),
        h('div', { class: 'rep-sub' }, P.t('{title} · {how} at {time} · seed {seed}', { title: this.title, how: sim.reason === 'ko' ? P.t('K.O.') : P.t("Judges' decision (Earl)"), time: U.fmtTime(sim.duration), seed: sim.seed }))));

      // summary
      const sum = (label, a, b, good) => h('div', { class: 'sum' }, h('label', null, label), h('div', { class: 'sum-vals' }, h('b', { class: 'a' }, a), h('span', null, 'vs'), h('b', { class: 'b' }, b)));
      panel.appendChild(h('div', { class: 'sum-row' },
        sum(P.t('Damage dealt'), sA.dmgDealt, sB.dmgDealt),
        sum(P.t('Accuracy'), acc(sA), acc(sB)),
        sum(P.t('Crits'), sA.crits, sB.crits),
        sum(P.t('Parts destroyed'), sA.partsDestroyed, sB.partsDestroyed),
        sum(P.t('Repairs / shields'), `${sA.healed}/${Math.round(sA.absorbed)}`, `${sB.healed}/${Math.round(sB.absorbed)}`)));

      // rewards first — that's what the player wants to see
      if (res) panel.appendChild(this.rewardsBox(res));

      // chart
      const chart = h('canvas', { class: 'rep-chart', width: 520, height: 90 });
      panel.appendChild(h('div', { class: 'chart-box' }, h('div', { class: 'list-head' }, P.t('Cumulative damage dealt'), h('span', { class: 'leg a' }, this.teamName.A), h('span', { class: 'leg b' }, this.teamName.B)), chart));
      this.drawChart(chart);

      // part tables
      const partTable = (side) => {
        const st = sim.stats[side];
        const rows = Object.entries(st.parts).map(([k, p]) => {
          const f = p.hpEnd / p.max;
          const status = p.destroyed ? h('span', { class: 'st-lost' }, `${p.how === 'rip' ? P.t('RIPPED OFF') : P.t('DESTROYED')} @${U.fmtTime(p.at)}`) : h('span', { class: f < 0.4 ? 'st-low' : 'st-ok' }, P.t('{p}% HP', { p: Math.round(f * 100) }));
          return h('tr', { class: p.destroyed ? 'lost' : '' },
            h('td', { class: 'dim' }, P.slotLabel(k)), h('td', null, p.name), h('td', { class: 'num' }, p.dmgTaken), h('td', { class: 'num' }, p.hits),
            h('td', null, h('div', { class: 'mini-bar' }, h('div', { style: { width: (p.dmgTaken / Math.max(1, st.dmgTaken)) * 100 + '%' } }))), h('td', null, status));
        });
        return h('table', { class: 'rep-table' }, h('thead', null, h('tr', null, h('th', null, P.t('Slot')), h('th', null, P.t('Part')), h('th', null, P.t('Dmg taken')), h('th', null, P.t('Hits')), h('th', null, P.t('Share')), h('th', null, P.t('Status')))), h('tbody', null, rows));
      };
      const weaponTable = (side) => {
        const st = sim.stats[side];
        const rows = Object.entries(st.weapons).map(([k, w]) => h('tr', null,
          h('td', null, w.name), h('td', { class: 'num' }, w.shots), h('td', { class: 'num' }, w.hits), h('td', { class: 'num' }, w.shots ? Math.round((w.hits / w.shots) * 100) + '%' : '—'), h('td', { class: 'num' }, w.crits), h('td', { class: 'num b' }, w.dmg),
          h('td', null, h('div', { class: 'mini-bar' }, h('div', { style: { width: (w.dmg / Math.max(1, st.dmgDealt)) * 100 + '%' } })))));
        if (!rows.length) rows.push(h('tr', null, h('td', { colspan: 7, class: 'dim' }, P.t('No weapons fired.'))));
        return h('table', { class: 'rep-table' }, h('thead', null, h('tr', null, h('th', null, P.t('Weapon')), h('th', null, P.t('Shots')), h('th', null, P.t('Hits')), h('th', null, P.t('Acc')), h('th', null, P.t('Crits')), h('th', null, P.t('Damage')), h('th', null, P.t('Share')))), h('tbody', null, rows));
      };
      // one column per team; in team bouts, tabs pick which mech's tables to show
      const column = (tm) => {
        const ids = tm === 'A' ? this.idsA : this.idsB;
        const col = h('div');
        let cur = ids[0];
        const draw = () => {
          col.innerHTML = '';
          if (ids.length > 1) {
            col.appendChild(h('div', { class: 'tabs unit-tabs' }, ids.map((id) => UI.button(this.names[id] + (sim.final[id].chassis && sim.final[id].chassis.destroyed ? ' ✖' : ''), () => {
              cur = id;
              draw();
            }, id === cur ? 'tab on' : 'tab'))));
          }
          const nm = this.names[cur];
          col.append(h('div', { class: 'list-head ' + tm.toLowerCase() }, `${nm} — ${P.t('parts')}`), partTable(cur), h('div', { class: 'list-head ' + tm.toLowerCase() }, `${nm} — ${P.t('weapons')}`), weaponTable(cur));
        };
        draw();
        return col;
      };
      panel.appendChild(h('div', { class: 'rep-cols' }, column('A'), column('B')));

      const btnRow = h('div', { class: 'row end rep-buttons' });
      btnRow.append(
        UI.button(P.t('Export replay'), () => U.download(`ptp-replay-${this.replayObj.id || Date.now()}.json`, JSON.stringify(this.replayObj, null, 1)), 'small'),
        UI.button(P.t('Export battle log'), () => U.download(`ptp-battle-log-${sim.seed}.txt`, S.eventLogText(this.replayObj, sim), 'text/plain'), 'small'),
      );
      if (this.mode === 'replay') {
        btnRow.append(
          UI.button('↺ ' + P.t('Watch again'), () => P.Game.go(P.Scenes.battle, this.params), 'small'),
          UI.button(P.t('Back'), () => P.Game.go(this.params.returnTo === 'title' ? P.Scenes.title : P.Scenes.hub), 'primary'),
        );
      } else {
        btnRow.append(UI.button(P.t('Continue') + ' ▸', () => this.leave(), 'primary big'));
      }
      panel.appendChild(btnRow);
      this.hudRoot.appendChild(wrap);
    },

    rewardsBox(res) {
      const box = h('div', { class: 'rewards' });
      box.appendChild(h('div', { class: 'list-head' }, P.t('Payout')));
      const net = res.money - res.fee - (res.wages || 0);
      box.appendChild(h('div', { class: 'big-money ' + (res.won ? '' : 'dim') }, `${net >= 0 ? '+' : ''}${U.fmtMoney(net)} ${P.t('net')}`));
      const line = (label, v, cls) => h('span', { class: 'pay-item ' + (cls || '') }, label + ' ', h('b', null, (v < 0 ? '' : '+') + U.fmtMoney(v)));
      box.appendChild(h('div', { class: 'pay-lines' },
        line(res.won ? (this.params.rematch ? P.t('Rematch purse') : P.t('Prize money')) : P.t('Hazard pay'), res.purse),
        res.bonus ? line(P.t('Sponsorship Office'), res.bonus) : null,
        res.gate ? line(P.t('Gate share'), res.gate) : null,
        ...(res.sponsors || []).filter((s) => s.pay || s.bonus).map((s) => line(s.name + (s.met ? ' ★' : ''), s.pay + s.bonus)),
        res.merch ? line(P.t('Merch stand'), res.merch) : null,
        res.wages ? line(P.t('Pilot wages'), -res.wages, 'neg') : null,
        res.fee ? line(P.t('Entry fee'), -res.fee, 'neg') : null,
        res.team ? h('span', { class: 'pay-item fame' }, '📺 ' + P.t('Fame') + ' ', h('b', null, (res.fame >= 0 ? '+' : '') + res.fame), ' → ' + S.d.fame) : null));
      if (res.sponsorsEnded) box.appendChild(h('div', { class: 'dim' }, P.t('Contract finished: {list}. Sign new sponsors in the Team Office.', { list: res.sponsorsEnded.join(', ') })));
      if (res.lost.length) {
        box.appendChild(h('div', { class: 'lost-box' }, h('b', null, P.t('Destroyed and gone for good:') + ' '), res.lost.map((l) => l.name + ` (${res.team ? l.mech + ', ' : ''}${P.slotLabel(l.slot)})`).join(', '), h('div', { class: 'dim' }, P.t('Replace them in the garage.'))));
      } else box.appendChild(h('div', { class: 'dim' }, P.t('No parts lost.')));
      box.appendChild(this.repairBox());
      if (res.scrapSweep) box.appendChild(h('div', { class: 'unlock' }, P.t('Nothing survived to salvage — you swept up ⚙ {n} scrap from the wreckage instead.', { n: res.scrapSweep })));
      if (res.unlockPaint) box.appendChild(h('div', { class: 'unlock' }, P.t('New paint unlocked: {name}', { name: P.paintName(res.unlockPaint) })));
      if (res.blueprint) box.appendChild(UI.blueprintCard(res.blueprint, P.t('First-clear reward')));
      if (res.ventureUnlock) box.appendChild(h('div', { class: 'unlock' }, P.t('New Pit Exchange venture: {name}', { name: res.ventureUnlock })));
      if (res.pilotUnlock) box.appendChild(h('div', { class: 'unlock' }, P.t('New pilot for hire: {name}', { name: res.pilotUnlock.join(', ') })));
      if (res.newBay) box.appendChild(h('div', { class: 'unlock' }, P.t('Third mech bay unlocked! Marge built Rustbucket III out of the concession stand.')));
      this.claimed = !res.salvage.length;
      this.picksLeft = res.salvagePicks || 1;
      if (res.salvage.length) {
        box.appendChild(h('div', { class: 'list-head' }, this.picksLeft > 1 ? P.t('Salvage rights — take {n} intact parts from the wreck', { n: this.picksLeft }) : P.t('Salvage rights — take ONE intact part from the wreck')));
        const row = h('div', { class: 'salvage-row' });
        const cards = res.salvage.map((it) => {
          const c = UI.itemCard(it, {
            onClick: () => {
              if (this.picksLeft <= 0 || c.classList.contains('claimed')) return;
              this.picksLeft--;
              this.claimed = true;
              S.addItem(it);
              S.save();
              c.classList.add('claimed');
              if (this.picksLeft <= 0) cards.forEach((o) => !o.classList.contains('claimed') && o.classList.add('sold'));
              P.SFX.play('loot');
              UI.toast(P.t('Salvaged {name}', { name: P.itemName(it) }), 'good');
            },
          });
          row.appendChild(c);
          return c;
        });
        box.appendChild(row);
      }
      if (res.crates) {
        box.appendChild(h('div', { class: 'list-head' }, res.crates > 1 ? P.t('Loot crates (Luck bonus!)') : P.t('Loot crate')));
        const row = h('div', { class: 'salvage-row' });
        this.cratesLeft = res.crates;
        for (let i = 0; i < res.crates; i++) {
          const crate = h('div', { class: 'crate' }, h('div', { class: 'crate-art' }), h('div', null, P.t('Open crate')));
          crate.addEventListener('click', () => {
            if (crate.classList.contains('opened')) return;
            const it = P.Loot.rollItem({ luck: S.luck(), tier: S.tier() });
            const inst = S.addItem(it);
            S.save();
            this.cratesLeft--;
            crate.classList.add('opened');
            const rar = P.PARTS[it.id].rarity;
            const card = UI.itemCard(inst, { cls: 'reveal rar-' + rar });
            crate.replaceWith(card);
            P.SFX.play(P.RARITY_ORDER.indexOf(rar) >= 3 ? 'jackpot' : 'loot');
            this.fx.screenFlash(P.RARITY[rar].color, P.RARITY_ORDER.indexOf(rar) >= 2 ? 0.35 : 0.1);
            // sometimes there's a blueprint rattling around in the bottom of the crate
            if (U.rng() < P.Loot.crateBlueprintChance(S.luck())) {
              const bp = S.randomUnknownBlueprint();
              if (bp && S.learnBlueprint(bp)) {
                card.after(UI.blueprintCard(bp, P.t('Found in the crate!')));
                P.SFX.play('jackpot');
              }
            }
          });
          row.appendChild(crate);
        }
        box.appendChild(row);
      }
      return box;
    },

    // Repair bill for the parts that survived (damage carries over until it's fixed)
    repairBox() {
      const wrap = h('div', { class: 'repair-box' });
      const draw = () => {
        wrap.innerHTML = '';
        const dmg = S.repairSort(S.damaged(true));
        const bill = S.repairBill(true);
        if (!dmg.length) {
          wrap.appendChild(h('div', { class: 'dim' }, P.t('Your mech is fully repaired.')));
          return;
        }
        const cash = Math.floor(S.d.money);
        wrap.append(
          h('div', { class: 'list-head' }, P.t('Repair bill'), h('span', { class: 'dim' }, P.t('damage carries over until you fix it'))),
          h('div', { class: 'repair-lines' }, dmg.map((it) => h('span', { class: 'rl' }, P.itemName(it), ' ', h('i', { class: 'bad' }, '-' + U.pct(it.wear)), ' ', h('b', null, it.free ? P.t('free') : U.fmtMoney(S.repairCost(it)))))),
          h('div', { class: 'row' },
            UI.button(bill > cash && cash > 0 ? P.t('Patch with {v}', { v: U.fmtMoney(cash) }) : P.t('Repair all ({v})', { v: U.fmtMoney(bill) }), () => {
              const r = S.repairMany(dmg);
              P.SFX.play(r.spent || !bill ? 'clank' : 'ui_bad');
              draw();
            }, 'small' + (cash > 0 || !bill ? ' primary' : ''), cash > 0 || !bill ? null : { disabled: true }),
            h('span', { class: 'dim small-print' }, P.t('Or repair later at the Workbench. Damaged parts start the next bout with less HP.'))));
      };
      draw();
      return wrap;
    },

    async leave() {
      const res = this.result;
      if (res && res.won && !this.claimed && !(await UI.confirm(P.t('You have not claimed your salvage. Leave it in the pit?'), P.t('Leave it'), P.t('Go back')))) return;
      if (res && this.cratesLeft > 0) {
        // auto-open unopened crates so nothing is lost
        for (let i = 0; i < this.cratesLeft; i++) {
          const it = P.Loot.rollItem({ luck: S.luck(), tier: S.tier() });
          S.addItem(it);
          UI.toast(P.t('Auto-opened crate: {name}', { name: P.itemName(it) }), 'good');
        }
        S.save();
      }
      if (res && res.won && this.bout.boss && res.firstClear) return P.Game.go(P.Scenes.ending, { chapter: this.bout.team ? 'ch2' : 'ch1' });
      const dlg = res.won ? (res.firstClear ? P.tLines('afterWin', this.bout.id, P.DIALOGUE.afterWin[this.bout.id] || []) : []) : P.tLines('dialogue', 'afterLoss', P.DIALOGUE.afterLoss);
      const toasts = [];
      if (res.pilotUnlock) toasts.push(P.t('New pilot for hire: {name}', { name: res.pilotUnlock.join(', ') }));
      if (res.unlockPaint) toasts.push(P.t('Paint unlocked: {name}', { name: P.paintName(res.unlockPaint) }));
      if (res.blueprint) toasts.push(P.t('New blueprint: {name} — craft it at the Workbench', { name: P.partName(res.blueprint) }));
      P.Game.go(P.Scenes.hub, { dialog: dlg, toasts });
    },

    drawChart(cv) {
      const c = cv.getContext('2d');
      const tl = this.sim.timeline;
      const W = cv.width, H = cv.height;
      const maxT = Math.max(1, tl[tl.length - 1][0]);
      const maxD = Math.max(1, ...tl.map((r) => Math.max(r[1], r[2])));
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let i = 1; i < 4; i++) {
        c.beginPath();
        c.moveTo(0, (H * i) / 4);
        c.lineTo(W, (H * i) / 4);
        c.stroke();
      }
      const line = (idx, col) => {
        c.strokeStyle = col;
        c.lineWidth = 2;
        c.beginPath();
        tl.forEach((r, i) => {
          const x = (r[0] / maxT) * (W - 8) + 4, y = H - 6 - (r[idx] / maxD) * (H - 14);
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        });
        c.stroke();
      };
      line(1, '#5fd3ff');
      line(2, '#ff6a5a');
      c.fillStyle = '#c9c3b3';
      c.font = '10px ' + P.canvasFont();
      c.fillText(maxD + ' dmg', 6, 12);
      c.fillText(U.fmtTime(maxT), W - 34, H - 4);
    },
  };

  P.Scenes.battle = Battle;
})();
