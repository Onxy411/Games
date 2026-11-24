// Part-Time Pilot — title screen and Chapter 1 ending.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const h = U.h;
  const UI = P.UI;
  const S = P.State;
  P.Scenes = P.Scenes || {};

  // ================================== TITLE ==================================
  P.Scenes.title = {
    enter() {
      P.R.setWorld(320, 180);
      this.env = P.Env.hub();
      this.fx = new P.FX();
      this.fx.groundY = 108;
      const hasSave = S.load();
      const build = hasSave ? S.build() : {
        name: 'Rustbucket', paint: 'rust',
        parts: { chassis: { id: 'dumpster_frame' }, head: { id: 'bucket_head' }, legs: { id: 'scrap_stompers' }, armR: { id: 'hydraulic_claw' }, armL: { id: 'rivet_gun' }, mount0: { id: 'bottle_rockets' } },
      };
      this.view = new P.MechView(build, { facing: 1, x: 157, y: 108 });
      this.t = 0;
      P.Music.play('hub');
      UI.clear();
      const menu = h('div', { class: 'title-menu' });
      const root = h('div', { class: 'title-screen' },
        h('div', { class: 'title-logo' },
          h('div', { class: 'tl-top' }, 'PART-TIME'),
          h('div', { class: 'tl-big' }, 'PILOT'),
          h('div', { class: 'tl-sub' }, hasSave && S.d.ch2 ? P.t('Chapter Two: The Public Arena') : P.t('Chapter One: The Scrap Pit')),
          h('div', { class: 'tl-tag' }, P.t('Minimum wage. Maximum scrap.'))),
        menu,
        h('div', { class: 'title-foot' }, P.t('Automated mech battles · build, watch, loot, repeat · playable prototype')));
      if (hasSave) {
        const d = S.d;
        menu.appendChild(UI.button(h('span', null, P.t('Continue'), h('small', null, `${P.tc('chapters', S.chapterId(), 'short', S.chapter().short)} · ${P.t('Day')} ${d.day} · ${U.fmtMoney(d.money)} · ${S.beatenCount()}/${S.bouts().length} ${P.t('bouts')}`)), () => this.start(false), 'primary big'));
      }
      menu.appendChild(UI.button(P.t('New Game'), async () => {
        if (S.hasSave() && !(await UI.confirm(P.t('Start a new game? Your current save will be overwritten.'), P.t('Start over')))) return;
        this.start(true);
      }, hasSave ? 'big' : 'primary big'));
      menu.appendChild(UI.button(P.t('Watch a replay file…'), async () => {
        const txt = await U.pickFile('.json,application/json');
        if (!txt) return;
        let rep;
        try {
          rep = JSON.parse(txt);
        } catch (e) {
          return UI.toast(P.t('That file is not valid JSON.'), 'bad');
        }
        const err = S.validateReplay(rep);
        if (err) return UI.toast(err, 'bad');
        P.Game.go(P.Scenes.battle, { replay: rep, returnTo: 'title' });
      }));
      // language picker
      const langRow = h('div', { class: 'title-lang' }, '🌐 ', P.I18N.langs.map((l) => UI.button(l.name, () => {
        if (P.I18N.lang === l.id) return;
        S.settings.lang = l.id;
        P.I18N.set(l.id);
        S.saveSettings();
        P.Game.refit();
        P.Game.go(P.Scenes.title);
      }, 'small' + (P.I18N.lang === l.id ? ' on' : ''))));
      root.appendChild(langRow);
      UI.root.appendChild(root);
    },
    start(fresh) {
      P.SFX.init();
      if (fresh || !S.d) S.newGame();
      const intro = !S.d.flags.introSeen;
      S.d.flags.introSeen = true;
      S.save();
      P.Game.go(P.Scenes.hub, intro ? { dialog: P.tLines('dialogue', 'intro', P.DIALOGUE.intro) } : {});
    },
    exit() {
      this.env.dispose();
    },
    update(dt) {
      this.t += dt;
      this.view.update(dt);
      this.fx.update(dt, this.t);
      for (const em of this.env.emitters) if (em.kind === 'fire' && Math.random() < dt * 14) this.fx.fireBurst(em.x + (Math.random() - 0.5) * 6, em.y, 1);
      if (Math.random() < dt * 1.2) {
        this.fx.spark(104, 88, 8, ['#fff6c0', '#ffd25a', '#8fe8ff'], 70, { up: 30, glow: true });
        this.fx.light(104, 88, 14, '#9fe8ff', 0.12, 0.8);
      }
    },
    render(dt) {
      const R = P.R;
      R.beginFrame();
      this.env.drawBack(this.t, { sway: 1 });
      R.beginWorld();
      this.view.draw(R.wctx);
      this.fx.drawWorld(R.wctx);
      R.presentWorld();
      for (const l of this.view.lights) R.glow(l.x, l.y, l.r, l.color, l.a);
      this.fx.drawScreen();
      this.env.drawFront(this.t, dt, { sway: 1 });
    },
  };

  // ================================== ENDINGS ==================================
  // Chapter 1: you beat the Baron and the league takes you public (TV lights, camera flashes).
  // Chapter 2: you beat Team Apex... and the Vexmoor invasion begins (sirens, drop pods).
  P.Scenes.ending = {
    enter(params) {
      this.chapter = (params && params.chapter) || 'ch1';
      const ch2 = this.chapter === 'ch2';
      P.R.setWorld(480, 270);
      this.env = P.Env.arena(ch2 ? 'apex' : 'gold');
      this.fx = new P.FX();
      this.fx.decal = this.env.decal;
      this.fx.groundY = 214;
      this.player = new P.MechView(S.build(null, 0), { facing: 1, x: 200, y: 214 });
      this.player.victory = true;
      const eb = S.enemyBuild(ch2 ? 'vance' : 'baron');
      this.wreck = new P.MechView(eb, { facing: -1, x: 330, y: 214 });
      for (const k of Object.keys(this.wreck.parts)) if (k !== 'chassis') this.wreck.parts[k].destroyed = true;
      this.wreck.ko = true;
      this.wreck.koT = 5;
      this.t = 0;
      this.alert = 0;
      this.tv = 0;
      this.flashes = [];
      this.pods = [];
      if (ch2) S.d.campaign.ending2Seen = true;
      else S.d.campaign.endingSeen = true;
      S.save();
      P.Music.play('ending');
      UI.clear();
      P.SFX.play('win');
      P.SFX.play('crowd');
      const lines = ch2 ? P.tLines('dialogue', 'ending2', P.DIALOGUE.ending2) : P.tLines('dialogue', 'ending', P.DIALOGUE.ending);
      // celebrate... then the twist: TV cameras (Ch1) or the invasion (Ch2)
      setTimeout(() => {
        UI.dialog(lines.slice(0, 3))
          .then(() => {
            if (ch2) {
              this.alert = 0.01;
              P.Music.play(null);
              P.SFX.play('phase');
            } else {
              this.tv = 0.01;
              P.SFX.play('crowd');
            }
            return UI.dialog(lines.slice(3));
          })
          .then(() => this.showCredits());
      }, 1200);
    },
    exit() {
      this.env.dispose();
    },
    showCredits() {
      const st = S.d.stats;
      const ch2 = this.chapter === 'ch2';
      const n = ch2 ? 2 : 1;
      const buttons = ch2
        ? [UI.button(P.t('Continue in free play'), () => P.Game.go(P.Scenes.hub), 'primary big'), UI.button(P.t('Title screen'), () => P.Game.go(P.Scenes.title))]
        : [
          UI.button(P.t('Go public: start Chapter Two'), () => {
            const fresh = S.startChapter2();
            P.Game.go(P.Scenes.hub, fresh ? { dialog: P.tLines('dialogue', 'ch2intro', P.DIALOGUE.ch2intro) } : {});
          }, 'primary big'),
          UI.button(P.t('Stay in the Scrap Pit (free play)'), () => P.Game.go(P.Scenes.hub)),
          UI.button(P.t('Title screen'), () => P.Game.go(P.Scenes.title)),
        ];
      const road = (c) => P.tc('roadmap', c.n, 'title', c.title);
      const panel = h('div', { class: 'panel ending-panel' },
        h('div', { class: 'end-kicker' }, ch2 ? P.t('Chapter Two Complete') : P.t('Chapter One Complete')),
        h('div', { class: 'end-title' }, ch2 ? P.t('National Champions') : P.t('Champion of the Scrap Pit')),
        h('div', { class: 'end-stats' },
          h('div', null, h('b', null, st.battles), h('span', null, P.t('bouts fought'))),
          h('div', null, h('b', null, st.wins), h('span', null, P.t('wins'))),
          h('div', null, h('b', null, st.dmgDealt), h('span', null, P.t('damage dealt'))),
          h('div', null, h('b', null, st.partsDestroyed), h('span', null, P.t('enemy parts wrecked'))),
          h('div', null, h('b', null, st.partsLost), h('span', null, P.t('of your parts lost'))),
          h('div', null, h('b', null, U.fmtMoney(st.moneyEarned)), h('span', null, P.t('earned')))),
        h('div', { class: 'end-next' }, ch2 ? P.t('To be continued in ') : P.t('Up next: '), h('b', null, P.t('Chapter {n}: {title}', { n: n + 1, title: road(P.ROADMAP[n]) }))),
        h('div', { class: 'roadmap' }, P.ROADMAP.map((c) => UI.attachTip(h('div', { class: 'road-step' + (c.n <= n ? ' done' : c.n === n + 1 ? ' next' : '') }, h('b', null, c.n), h('span', null, road(c))), `<b>${P.t('Chapter {n}: {title}', { n: c.n, title: road(c) })}</b><br>${P.tc('roadmap', c.n, 'blurb', c.blurb)}`))),
        h('div', { class: 'dim' }, ch2
          ? P.t('Free play: rematch any team for loot and fame. Rematches after the championship roll one tier tougher. Chapter Three is not built yet.')
          : P.t('Chapter Two is playable now: team bouts, hired pilots, sponsors and fame. Your money, parts and facilities come with you. You can also stay and rematch anyone in the Scrap Pit.')),
        h('div', { class: 'row center' }, buttons));
      UI.root.appendChild(h('div', { class: 'ending-wrap' }, panel));
    },
    update(dt) {
      this.t += dt;
      this.player.update(dt);
      this.wreck.update(dt);
      this.fx.update(dt, this.t);
      if (!this.alert) {
        const colors = ['#ff5a5a', '#ffd25a', '#5ad0ff', '#7dff8a', '#ff7ae0', '#ffffff', '#e9bb4c'];
        if (Math.random() < dt * 30) this.fx.pix.push({ x: Math.random() * 480, y: -4, vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 40, life: 7, max: 7, color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() < 0.5 ? 2 : 1, g: 6, drag: 0.995 });
      }
      if (Math.random() < dt * 4) this.fx.smoke(330 + (Math.random() - 0.5) * 20, 190, 1, { size: 1.3, color: '#1e1a1c', a: 0.5, life: 2.5 });
      for (const em of this.env.emitters) if (em.kind === 'fire' && Math.random() < dt * 14) this.fx.fireBurst(em.x, em.y, 1);
      if (this.tv) {
        this.tv += dt;
        if (Math.random() < dt * 9) this.flashes.push({ x: 20 + Math.random() * 440, y: 120 + Math.random() * 40, t: 0 });
        for (const fl of this.flashes) fl.t += dt;
        this.flashes = this.flashes.filter((fl) => fl.t < 0.25);
      }
      if (this.alert) {
        this.alert += dt;
        // air-raid siren
        if (Math.floor(this.alert / 1.2) !== Math.floor((this.alert - dt) / 1.2)) P.SFX.play('emp');
        // Vexmoor drop pods rain into the arena
        if (this.pods.length < 7 && Math.random() < dt * 0.9) this.pods.push({ x: 60 + Math.random() * 360, y: -30, vy: 160 + Math.random() * 60, landed: false, t: 0, depth: 150 + Math.random() * 30 });
        for (const p of this.pods) {
          if (p.landed) {
            p.t += dt;
            continue;
          }
          p.y += p.vy * dt;
          if (Math.random() < dt * 30) this.fx.smoke(p.x, p.y - 8, 1, { size: 0.8, color: '#5a5458', a: 0.5, life: 0.8, rise: 0.1 });
          if (p.y >= p.depth) {
            p.y = p.depth;
            p.landed = true;
            this.fx.explosion(p.x, p.depth, 1.2);
            this.fx.shake(4);
          }
        }
      }
    },
    render(dt) {
      const R = P.R;
      R.beginFrame();
      this.env.drawBack(this.t);
      R.beginWorld();
      const w = R.wctx;
      for (const p of this.pods) this.drawPod(w, p);
      this.wreck.draw(w);
      this.player.draw(w);
      this.fx.drawWorld(w);
      R.presentWorld();
      for (const l of this.player.lights) R.glow(l.x, l.y, l.r, l.color, l.a);
      for (const p of this.pods) {
        if (p.landed && p.t > 0.6) {
          R.glow(p.x - 2, p.y - 10, 4, '#ff3a2a', 0.9);
          R.glow(p.x + 2, p.y - 10, 4, '#ff3a2a', 0.9);
        } else if (!p.landed) R.glow(p.x, p.y + 4, 10, '#ffb04a', 0.8);
      }
      for (const fl of this.flashes) R.glow(fl.x, fl.y, 10 + fl.t * 30, '#ffffff', 0.9 * (1 - fl.t / 0.25));
      if (this.alert || this.tv) {
        const v = R.vctx;
        // sweeping searchlights
        v.save();
        v.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const ang = Math.sin(this.t * 0.9 + i * 2.2) * 0.5;
          const ox = R.sx(i ? 420 : 60), oy = R.sy(-10);
          const len = R.view.height * 1.3;
          const g = v.createLinearGradient(ox, oy, ox + Math.sin(ang) * len, oy + Math.cos(ang) * len);
          g.addColorStop(0, 'rgba(255,240,200,0.28)');
          g.addColorStop(1, 'rgba(255,240,200,0)');
          v.fillStyle = g;
          v.beginPath();
          v.moveTo(ox, oy);
          v.lineTo(ox + Math.sin(ang - 0.09) * len, oy + Math.cos(ang - 0.09) * len);
          v.lineTo(ox + Math.sin(ang + 0.09) * len, oy + Math.cos(ang + 0.09) * len);
          v.fill();
        }
        v.restore();
        if (this.alert) {
          // red alert wash
          v.globalAlpha = 0.12 + 0.12 * Math.max(0, Math.sin(this.alert * 5.2));
          v.fillStyle = '#ff1a1a';
          v.fillRect(0, 0, R.view.width, R.view.height);
          v.globalAlpha = 1;
        }
      }
      this.fx.drawScreen();
      this.env.drawFront(this.t, dt);
    },
    // Vexmoor drop pod: dark capsule whose red visor lights up after landing
    drawPod(ctx, p) {
      const x = Math.round(p.x), y = Math.round(p.y);
      ctx.fillStyle = '#17151d';
      ctx.fillRect(x - 6, y - 18, 12, 18);
      ctx.fillRect(x - 4, y - 21, 8, 3);
      ctx.fillStyle = '#3c414c';
      ctx.fillRect(x - 5, y - 17, 10, 15);
      ctx.fillStyle = '#6a1a1a';
      ctx.fillRect(x - 5, y - 13, 10, 2);
      ctx.fillStyle = p.landed && p.t > 0.6 ? '#ff3a2a' : '#2a1a1a';
      ctx.fillRect(x - 3, y - 10, 2, 1);
      ctx.fillRect(x + 1, y - 10, 2, 1);
      if (!p.landed) {
        ctx.fillStyle = '#ffd25a';
        ctx.fillRect(x - 3, y, 6, 2);
      }
    },
  };
})();
