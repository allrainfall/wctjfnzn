/* ==========================================================================
   实验 01：一维元胞自动机
   横轴是空间，纵轴是时间。每一行都由上一行和八个开关决定。
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('caCanvas');
  if (!canvas) return;

  var stage = canvas.parentElement;
  var ctx = canvas.getContext('2d');
  var N = 241;
  var rows = 160;
  var scale = 1;
  var W = 1, H = 1;

  var cur = new Uint8Array(N);
  var off = document.createElement('canvas');
  var octx = off.getContext('2d');

  var rule = 90;
  var speed = 4;
  var gen = 0;
  var seedMode = 0;           // 0 单点 / 1 随机 / 2 三格
  var running = false;
  var raf = 0;
  var acc = 0;
  var last = 0;

  var paper = '#f2efe7';
  var ink = '#17150f';

  /* ------------------------------------------------------------ 初始化 */
  function readTheme() {
    var cs = getComputedStyle(document.body);
    paper = (cs.getPropertyValue('--paper') || '#f2efe7').trim();
    ink = (cs.getPropertyValue('--ink') || '#17150f').trim();
  }

  function seed() {
    cur.fill(0);
    if (seedMode === 0) {
      cur[(N - 1) >> 1] = 1;
    } else if (seedMode === 1) {
      for (var i = 2; i < N - 2; i++) cur[i] = Math.random() < 0.36 ? 1 : 0;
    } else {
      var c = (N - 1) >> 1;
      cur[c - 1] = 1; cur[c] = 1; cur[c + 1] = 1;
    }
    gen = 0;
  }

  function layout() {
    var s = GL.fit(canvas);
    W = s.w; H = s.h;
    ctx = s.ctx;
    N = Math.max(121, Math.min(361, Math.round(W / 3.6) | 1));
    scale = W / N;
    rows = Math.max(40, Math.ceil(H / scale) + 2);

    off.width = N;
    off.height = rows;
    octx = off.getContext('2d');

    ctx.imageSmoothingEnabled = false;
    octx.fillStyle = paper;
    octx.fillRect(0, 0, N, rows);

    cur = new Uint8Array(N);
    seed();
    drawBadges();
    drawBits();
  }

  /* ------------------------------------------------------------ 演化 */
  function evolve() {
    var next = new Uint8Array(N);
    for (var i = 0; i < N; i++) {
      var l = i > 0 ? cur[i - 1] : 0;
      var c = cur[i];
      var r = i < N - 1 ? cur[i + 1] : 0;
      next[i] = (rule >> ((l << 2) | (c << 1) | r)) & 1;
    }
    cur = next;
    gen++;
  }

  function paintRow(rowIndex) {
    octx.fillStyle = paper;
    octx.fillRect(0, rowIndex, N, 1);
    octx.fillStyle = ink;
    for (var i = 0; i < N; i++) {
      if (cur[i]) octx.fillRect(i, rowIndex, 1, 1);
    }
  }

  function scroll() {
    octx.globalCompositeOperation = 'copy';
    octx.drawImage(off, 0, 1, N, rows - 1, 0, 0, N, rows - 1);
    octx.globalCompositeOperation = 'source-over';
  }

  function blit() {
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0, N, rows, 0, 0, N * scale, rows * scale);
  }

  function oneGeneration() {
    scroll();
    paintRow(rows - 1);
    evolve();
    updateReadout();
  }

  function updateReadout() {
    var live = 0;
    for (var i = 0; i < N; i++) if (cur[i]) live++;
    var g = document.getElementById('caGen');
    var d = document.getElementById('caDensity');
    if (g) g.textContent = gen.toLocaleString('en-US');
    if (d) d.textContent = live + ' / ' + N;
  }

  /* ------------------------------------------------------------ 循环 */
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min(80, now - last) : 16;
    last = now;
    acc += dt;
    var interval = 130 - speed * 11;      // 每代毫秒数
    var guard = 0;
    while (acc > interval && guard < 12) {
      oneGeneration();
      acc -= interval;
      guard++;
    }
    blit();
  }

  function start() {
    if (running || GL.reduceMotion) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function restart() {
    octx.fillStyle = paper;
    octx.fillRect(0, 0, N, rows);
    seed();
    // 预先铺满，避免开场留白
    for (var k = 0; k < rows - 1; k++) oneGeneration();
    updateReadout();
    blit();
  }

  /* ------------------------------------------------------------ 控件 */
  function drawBits() {
    var box = document.getElementById('caBits');
    if (!box) return;
    box.innerHTML = '';
    for (var b = 7; b >= 0; b--) {
      var bit = (rule >> b) & 1;
      var s = document.createElement('span');
      s.textContent = bit;
      s.title = '邻域 ' + b.toString(2).padStart(3, '0');
      if (bit) s.className = 'on';
      box.appendChild(s);
    }
  }

  function drawBadges() {
    var t = document.getElementById('caRuleTag');
    if (t) t.textContent = 'RULE ' + String(rule).padStart(3, '0');
    var v = document.getElementById('caRuleVal');
    if (v) v.textContent = rule;
  }

  function setRule(n) {
    rule = GL.clamp(n | 0, 0, 255);
    var slider = document.getElementById('caRule');
    if (slider) slider.value = rule;
    drawBits();
    drawBadges();
    var btns = document.querySelectorAll('#caRules button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', (+btns[i].dataset.rule === rule) ? 'true' : 'false');
    }
  }

  var ruleSlider = document.getElementById('caRule');
  if (ruleSlider) {
    ruleSlider.addEventListener('input', function () { setRule(+this.value); });
  }

  var presetBox = document.getElementById('caRules');
  if (presetBox) {
    presetBox.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      setRule(+b.dataset.rule);
      restart();
    });
  }

  var speedSlider = document.getElementById('caSpeed');
  if (speedSlider) {
    speedSlider.addEventListener('input', function () {
      speed = +this.value;
      var v = document.getElementById('caSpeedVal');
      if (v) v.textContent = speed;
    });
    speed = +speedSlider.value;
  }

  var resetBtn = document.getElementById('caReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () { seedMode = (seedMode + 1) % 3; restart(); });
  }

  canvas.addEventListener('click', function () {
    seedMode = (seedMode + 1) % 3;
    restart();
  });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      readTheme();
      layout();
      restart();
    }, 240);
  });

  /* ------------------------------------------------------------ 启动 */
  readTheme();
  layout();
  restart();

  if (GL.reduceMotion) {
    // 静态呈现：一次算满整块画布
    for (var q = 0; q < rows - 1; q++) oneGeneration();
    blit();
  } else {
    GL.whenVisible(stage, start, stop);
  }
})();
