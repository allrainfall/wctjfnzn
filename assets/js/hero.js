/* ==========================================================================
   封面的"生长"：从画面底部长出的一丛墨线植物
   - 每根枝条都有自己固定的张角，所以长出来是扇形而不是乱线
   - 增量绘制，只在可见时运行；尊重 prefers-reduced-motion
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var W = 1, H = 1;
  var tips = [];
  var dust = [];
  var segCount = 0;
  var phase = 'grow';           // grow | hold | fade
  var phaseAt = 0;
  var lastFrame = 0;
  var running = false;
  var rafId = 0;
  var pointer = { x: -999, y: -999, active: false };

  var HOLD = 2600;
  var GROW_MAX = 16000;

  var INK = '23, 21, 15';
  var ACCENT = '192, 66, 39';

  function measure() {
    var s = GL.fit(canvas);
    W = s.w;
    H = s.h;
    ctx = s.ctx;
    ctx.lineCap = 'round';
  }

  function plant() {
    tips.length = 0;
    dust.length = 0;
    segCount = 0;
    phase = 'grow';
    phaseAt = performance.now();

    var n = W < 640 ? 5 : 7;
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n;
      tips.push({
        x: W * (0.56 + 0.46 * t) + (Math.random() - 0.5) * 40,
        y: H * (0.99 + Math.random() * 0.08),
        a: -Math.PI / 2,
        spread: (t - 0.5) * 0.72 + (Math.random() - 0.5) * 0.18,
        curve: (Math.random() - 0.5) * 0.9,
        w: 2.6,
        d: 0,
        len: 0,
        wob: Math.random() * 6.28
      });
    }

    var dn = W < 640 ? 24 : 46;
    for (var j = 0; j < dn; j++) {
      dust.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.35,
        vy: -(Math.random() * 0.18 + 0.04),
        vx: (Math.random() - 0.5) * 0.1,
        o: Math.random() * 0.3 + 0.08
      });
    }
  }

  function step(dt) {
    var speed = 2.2 * Math.min(2.4, dt / 16.67);
    var now = performance.now();

    for (var i = tips.length - 1; i >= 0; i--) {
      var p = tips[i];

      /* 目标方向：竖直向上，再按自己的张角偏开；张角随长度缓慢变化，形成弧线 */
      p.spread += p.curve * 0.0012;
      var target = -Math.PI / 2 + p.spread * 0.85;
      var diff = Math.atan2(Math.sin(target - p.a), Math.cos(target - p.a));
      p.a += diff * 0.04;

      /* 细微的摇摆，让线条不是数学直线 */
      p.a += (GL.noise2(p.x * 0.004, p.y * 0.004 + now * 0.00006) - 0.5) * 0.16;
      p.a += Math.sin(p.len * 0.012 + p.wob) * 0.006;

      /* 光标轻微吸引 */
      if (pointer.active) {
        var dx = pointer.x - p.x;
        var dy = pointer.y - p.y;
        if (dx * dx + dy * dy < 300 * 300) {
          var toPtr = Math.atan2(dy, dx);
          var d2 = Math.atan2(Math.sin(toPtr - p.a), Math.cos(toPtr - p.a));
          p.a += d2 * 0.008;
        }
      }

      var nx = p.x + Math.cos(p.a) * speed;
      var ny = p.y + Math.sin(p.a) * speed;

      ctx.strokeStyle = 'rgba(' + INK + ',' + Math.max(0.06, 0.34 - p.d * 0.016).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.4, p.w);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      p.x = nx;
      p.y = ny;
      p.len += speed;
      segCount++;

      /* 分叉 */
      var branchP = 0.016 * Math.max(0.2, 1 - p.d * 0.1);
      if (p.len > 26 && p.d < 6 && tips.length < 130 && Math.random() < branchP) {
        var open = 0.22 + Math.random() * 0.4;
        var side = Math.random() < 0.5 ? -1 : 1;
        tips.push({
          x: nx, y: ny,
          a: p.a + open * side,
          spread: p.spread + open * side * 0.8,
          curve: p.curve * 0.7 + (Math.random() - 0.5) * 0.5,
          w: Math.max(0.32, p.w * 0.79),
          d: p.d + 1,
          len: 0,
          wob: Math.random() * 6.28
        });
        p.w = Math.max(0.32, p.w * 0.95);
      }

      var out = nx < -60 || nx > W + 60 || ny < -80 || ny > H + 60;
      var done = p.d > 7 || p.len > 820 || out || segCount > 26000;
      if (done) {
        if (!out && Math.random() < 0.5) {
          ctx.fillStyle = 'rgba(' + ACCENT + ',0.55)';
          ctx.beginPath();
          ctx.arc(nx, ny, 0.9 + Math.random() * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        tips.splice(i, 1);
      }
    }

    for (var k = 0; k < dust.length; k++) {
      var m = dust[k];
      m.x += m.vx * speed * 0.35;
      m.y += m.vy * speed * 0.35;
      if (m.y < -8) { m.y = H + 8; m.x = Math.random() * W; }
      ctx.fillStyle = 'rgba(' + INK + ',' + (m.o * 0.55).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function fade() {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    var dt = lastFrame ? Math.min(64, now - lastFrame) : 16.67;
    lastFrame = now;

    if (phase === 'grow') {
      step(dt);
      if (!tips.length) { phase = 'hold'; phaseAt = now; }
      else if (now - phaseAt > GROW_MAX) { tips.length = 0; phase = 'hold'; phaseAt = now; }
    } else if (phase === 'hold') {
      if (now - phaseAt > HOLD) { phase = 'fade'; phaseAt = now; }
    } else {
      fade();
      if (now - phaseAt > 1600) {
        ctx.clearRect(0, 0, W, H);
        plant();
        phaseAt = now;
      }
    }
  }

  function start() {
    if (running) return;
    running = true;
    lastFrame = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  function boot() {
    measure();
    ctx.clearRect(0, 0, W, H);

    if (GL.reduceMotion) {
      plant();
      var guard = 0;
      while (tips.length && guard < 1400) { step(16.67); guard++; }
      return;
    }

    plant();
    GL.whenVisible(canvas, start, stop);
  }

  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.active = true;
  });
  canvas.addEventListener('pointerleave', function () { pointer.active = false; });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      ctx.clearRect(0, 0, W, H);
      plant();
      lastFrame = 0;
      if (GL.reduceMotion) {
        var g = 0;
        while (tips.length && g < 1400) { step(16.67); g++; }
      }
    }, 240);
  });

  boot();
})();
