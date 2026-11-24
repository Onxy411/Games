// Part-Time Pilot — renderer core: display canvas + low-res "world" buffer that is upscaled with
// nearest-neighbour (crisp pixel art), while lights/fog/text are drawn at full screen resolution.
(function () {
  'use strict';
  const P = (window.PTP = window.PTP || {});
  const U = P.util;
  const R = (P.R = {});

  R.W = 480;
  R.H = 270;
  R.scale = 3;
  R.shakeX = 0;
  R.shakeY = 0;
  const resizeCbs = [];

  R.init = function (canvas) {
    R.view = canvas;
    R.vctx = canvas.getContext('2d');
    R.world = document.createElement('canvas');
    R.wctx = R.world.getContext('2d');
    R.setWorld(480, 270);
  };

  R.setWorld = function (w, h) {
    R.W = w;
    R.H = h;
    R.world.width = w;
    R.world.height = h;
    R.wctx.imageSmoothingEnabled = false;
    R.scale = R.view.width / w;
  };

  R.onResize = (cb) => resizeCbs.push(cb);
  R.offResize = (cb) => {
    const i = resizeCbs.indexOf(cb);
    if (i >= 0) resizeCbs.splice(i, 1);
  };

  R.resize = function (cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    const maxW = 2400;
    if (w > maxW) {
      h = Math.round((h * maxW) / w);
      w = maxW;
    }
    R.view.width = w;
    R.view.height = h;
    R.scale = w / R.W;
    for (const cb of resizeCbs.slice()) cb();
  };

  R.beginFrame = function () {
    const v = R.vctx;
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.globalAlpha = 1;
    v.globalCompositeOperation = 'source-over';
    v.fillStyle = '#05050a';
    v.fillRect(0, 0, R.view.width, R.view.height);
  };
  R.beginWorld = function () {
    R.wctx.setTransform(1, 0, 0, 1, 0, 0);
    R.wctx.clearRect(0, 0, R.W, R.H);
    R.wctx.imageSmoothingEnabled = false;
  };
  R.presentWorld = function (alpha) {
    const v = R.vctx;
    v.imageSmoothingEnabled = false;
    v.globalAlpha = alpha == null ? 1 : alpha;
    v.drawImage(R.world, R.shakeX, R.shakeY, R.W * R.scale, R.H * R.scale);
    v.globalAlpha = 1;
  };

  // world -> screen
  R.sx = (x) => x * R.scale + R.shakeX;
  R.sy = (y) => y * R.scale + R.shakeY;

  // Upscale a native-res layer to a screen-res canvas, optionally blurred (depth of field).
  R.bake = function (src, blurPx, scale) {
    scale = scale || R.scale;
    const c = document.createElement('canvas');
    c.width = Math.ceil(src.width * scale);
    c.height = Math.ceil(src.height * scale);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (blurPx > 0) x.filter = `blur(${blurPx}px)`;
    x.drawImage(src, 0, 0, c.width, c.height);
    x.filter = 'none';
    return c;
  };

  // Soft radial glow sprites (cached per color)
  const glowCache = new Map();
  R.glowSprite = function (color) {
    let c = glowCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, U.rgba(color, 1));
    g.addColorStop(0.25, U.rgba(color, 0.55));
    g.addColorStop(0.6, U.rgba(color, 0.14));
    g.addColorStop(1, U.rgba(color, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
    return c;
  };
  const puffCache = new Map();
  R.puffSprite = function (color) {
    let c = puffCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, U.rgba(color, 0.9));
    g.addColorStop(0.5, U.rgba(color, 0.45));
    g.addColorStop(1, U.rgba(color, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    puffCache.set(color, c);
    return c;
  };

  // Additive glow in world coords (radius in world px)
  R.glow = function (x, y, radius, color, alpha) {
    const v = R.vctx;
    const r = radius * R.scale;
    v.globalCompositeOperation = 'lighter';
    v.globalAlpha = U.clamp(alpha == null ? 1 : alpha, 0, 1);
    v.drawImage(R.glowSprite(color), R.sx(x) - r, R.sy(y) - r, r * 2, r * 2);
    v.globalAlpha = 1;
    v.globalCompositeOperation = 'source-over';
  };

  // Outlined text at screen res, positioned in world coords
  R.text = function (str, x, y, opts) {
    const v = R.vctx;
    opts = opts || {};
    const size = (opts.size || 10) * R.scale * 0.45;
    v.font = `${opts.weight || 700} ${Math.round(size * (P.I18N && P.I18N.lang === 'vi' ? 1.15 : 1))}px ${P.canvasFont()}`;
    v.textAlign = opts.align || 'center';
    v.textBaseline = 'middle';
    v.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    v.lineJoin = 'round';
    v.lineWidth = Math.max(2, size * 0.18);
    v.strokeStyle = opts.stroke || '#120c10';
    const sx = R.sx(x), sy = R.sy(y);
    v.strokeText(str, sx, sy);
    v.fillStyle = opts.color || '#fff';
    v.fillText(str, sx, sy);
    v.globalAlpha = 1;
  };

  R.vignette = function (strength, color) {
    const v = R.vctx;
    const w = R.view.width, h = R.view.height;
    const key = w + 'x' + h + strength + color;
    if (R._vigKey !== key) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(w / 2, h * 0.52, h * 0.25, w / 2, h * 0.52, h * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, U.rgba(color || '#000000', strength));
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      const g2 = x.createLinearGradient(0, 0, 0, h * 0.25);
      g2.addColorStop(0, U.rgba(color || '#000000', strength * 0.7));
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2;
      x.fillRect(0, 0, w, h * 0.25);
      R._vig = c;
      R._vigKey = key;
    }
    v.drawImage(R._vig, 0, 0);
  };
})();
