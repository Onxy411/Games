// Part-Time Pilot — boot, scene manager, main loop.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const Game = (P.Game = { scene: null, fps: 60 });

  Game.go = function (scene, params) {
    try {
      if (Game.scene && Game.scene.exit) Game.scene.exit();
    } catch (e) {
      console.error(e);
    }
    P.UI.clear();
    document.querySelectorAll('.modal-wrap, .dialog').forEach((el) => el.remove());
    Game.scene = scene;
    scene.enter(params || {});
  };

  Game.refit = () => fitStage();
  function fitStage() {
    const stage = document.getElementById('stage');
    const ww = window.innerWidth, wh = window.innerHeight;
    let w = ww, hh = Math.round((ww * 9) / 16);
    if (hh > wh) {
      hh = wh;
      w = Math.round((wh * 16) / 9);
    }
    stage.style.width = w + 'px';
    stage.style.height = hh + 'px';
    stage.style.fontSize = Math.max(9, w / 92) * (P.I18N.lang === 'vi' ? 1.1 : 1) + 'px';
    P.R.resize(w, hh);
  }

  let last = performance.now();
  let errShown = false;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    Game.fps = Game.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
    try {
      if (Game.scene) {
        Game.scene.update(dt);
        Game.scene.render(dt);
      }
    } catch (e) {
      console.error(e);
      if (!errShown) {
        errShown = true;
        P.UI.toast(P.t('Something broke: {msg}', { msg: e.message }), 'bad');
      }
    }
    requestAnimationFrame(frame);
  }

  function boot() {
    P.R.init(document.getElementById('view'));
    P.UI.init();
    fitStage();
    window.addEventListener('resize', fitStage);
    const unlock = () => P.SFX.init();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // M toggles music
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyM' || (e.target && e.target.tagName === 'INPUT')) return;
      const S = P.State.settings;
      if (S.music > 0) {
        S.musicWas = S.music;
        S.music = 0;
      } else S.music = S.musicWas || 0.45;
      P.Music.setVolume(S.music);
      P.State.saveSettings();
      P.UI.toast(S.music > 0 ? P.t('Music on') : P.t('Music muted (M)'));
    });
    Game.go(P.Scenes.title);
    requestAnimationFrame(frame);
    // re-bake layers once web fonts land (canvas text uses them)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitStage());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
