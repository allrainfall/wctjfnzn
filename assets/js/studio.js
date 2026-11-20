/* ==========================================================================
   工作室：海报生成器
   三种算法 + 三套配色 + 一个种子。画面全部在客户端算出来，可导出 PNG。
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('stCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var W = 1200, H = 1600;

  var PAL = {
    paper: { bg: '#f2efe7', ink: '#17150f', acc: '#c04227', soft: '#ddd5c2' },
    night: { bg: '#0d0d0c', ink: '#eeebe1', acc: '#e0543a', soft: '#2a2925' },
    clay:  { bg: '#e9dfd0', ink: '#2b221c', acc: '#a8442a', soft: '#d8c7b0' }
  };
  var ALGO_NAME = { flow: '流场', dots: '网点', wave: '波纹' };

  var algo = 'flow';
  var palette = 'paper';
  var density = 0.55;
  var seed = 2026;
  var title = '生长';
  var busy = false;

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* --------------------------------------------------------------- 算法 */
  function drawFlow(p) {
    var rng = GL.rng(seed);
    var n = Math.round(380 + density * 720);
    ctx.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var x = rng() * W;
      var y = rng() * H;
      var accent = rng() < 0.055;
      var steps = 110 + rng() * 90;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (var s = 0; s < steps; s++) {
        var a = GL.noise2(x * 0.0034 + seed * 0.17, y * 0.0034) * Math.PI * 4;
        x += Math.cos(a) * 3.1;
        y += Math.sin(a) * 3.1;
        if (x < -30 || x > W + 30 || y < -30 || y > H + 30) break;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = accent ? hexA(p.acc, 0.55) : hexA(p.ink, 0.09 + rng() * 0.17);
      ctx.lineWidth = 1 + rng() * 1.3;
      ctx.stroke();
    }
  }

  function drawDots(p) {
    var rng = GL.rng(seed + 11);
    var step = 30 - density * 18;
    var band = H * (0.60 + rng() * 0.1);
    for (var y = step * 0.5; y < H; y += step) {
      for (var x = step * 0.5; x < W; x += step) {
        var nx = (x / W - 0.5) * 1.7;
        var ny = (y / H - 0.44) * 1.3;
        var d = Math.sqrt(nx * nx + ny * ny);
        var f = GL.noise2(x * 0.004 + seed, y * 0.004);
        var t = 1 - GL.clamp(d * 0.95 + (f - 0.5) * 0.5, 0, 1);
        var r = Math.pow(t, 0.9) * step * 0.62;
        if (r < 0.4) continue;
        var inBand = y > band && y < band + H * 0.10;
        ctx.fillStyle = inBand ? hexA(p.acc, 0.92) : hexA(p.ink, 0.9);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawWave(p) {
    var rows = Math.round(70 + density * 130);
    var rng = GL.rng(seed + 5);
    for (var i = 0; i < rows; i++) {
      var y0 = H * (i + 0.5) / rows;
      var amp = 78 * Math.sin(Math.PI * i / rows) ** 0.55;
      var accent = i === Math.round(rows * (0.34 + rng() * 0.4));
      ctx.beginPath();
      for (var x = 0; x <= W; x += 6) {
        var n = GL.noise2(x * 0.0022 + seed * 0.31, i * 0.06);
        var y = y0 + (n - 0.5) * amp * 2.4;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = accent ? hexA(p.acc, 0.85) : hexA(p.ink, 0.26);
      ctx.lineWidth = accent ? 3 : 1.6;
      ctx.stroke();
    }
  }

  /* --------------------------------------------------------------- 排版 */
  function drawType(p) {
    var band = H * 0.795;
    ctx.fillStyle = hexA(p.bg, 0.9);
    ctx.fillRect(0, band, W, H - band);
    ctx.strokeStyle = hexA(p.ink, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, band);
    ctx.lineTo(W * 0.92, band);
    ctx.stroke();

    // 页眉
    ctx.fillStyle = hexA(p.ink, 0.55);
    ctx.font = '500 22px "GrowthMono", Consolas, monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('GROWTH LAB', W * 0.08, H * 0.055);
    ctx.textAlign = 'right';
    ctx.fillText('No.' + seed, W * 0.92, H * 0.055);
    ctx.textAlign = 'left';

    // 朱砂小方块
    ctx.fillStyle = p.acc;
    ctx.fillRect(W * 0.08, H * 0.085, 26, 26);

    // 标题
    var fs = 190;
    if (title.length > 3) fs = 130;
    if (title.length > 4) fs = 104;
    ctx.fillStyle = p.ink;
    ctx.font = '300 ' + fs + 'px "GrowthSerif", "Noto Serif SC", "Songti SC", "SimSun", serif';
    ctx.fillText(title || '', W * 0.075, H * 0.925);

    // 页脚
    ctx.fillStyle = hexA(p.ink, 0.6);
    ctx.font = '500 20px "GrowthMono", Consolas, monospace';
    ctx.fillText(ALGO_NAME[algo] + ' / SEED ' + seed + ' / 2026', W * 0.08, H * 0.962);
    ctx.textAlign = 'right';
    ctx.fillText('1200 × 1600', W * 0.92, H * 0.962);
    ctx.textAlign = 'left';
  }

  /* --------------------------------------------------------------- 渲染 */
  function status(s) {
    var el = document.getElementById('stStatus');
    if (el) el.textContent = s;
  }

  function render() {
    if (busy) return;
    busy = true;
    status('生成中…');
    window.requestAnimationFrame(function () {
      var p = PAL[palette];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      if (algo === 'flow') drawFlow(p);
      else if (algo === 'dots') drawDots(p);
      else drawWave(p);
      drawType(p);

      var s = document.getElementById('stSeedVal');
      if (s) s.textContent = seed;
      var a = document.getElementById('stAlgoVal');
      if (a) a.textContent = ALGO_NAME[algo];
      status('就绪');
      busy = false;
    });
  }

  var t = 0;
  function schedule() {
    clearTimeout(t);
    t = setTimeout(render, 70);
  }

  /* --------------------------------------------------------------- 控件 */
  var algoBox = document.getElementById('stAlgo');
  if (algoBox) {
    algoBox.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var all = algoBox.querySelectorAll('button');
      for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      algo = b.dataset.algo;
      schedule();
    });
  }

  var palBox = document.getElementById('stPalette');
  if (palBox) {
    palBox.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var all = palBox.querySelectorAll('button');
      for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      palette = b.dataset.pal;
      schedule();
    });
  }

  var dens = document.getElementById('stDensity');
  if (dens) {
    dens.addEventListener('input', function () {
      density = +this.value / 100;
      var v = document.getElementById('stDensityVal');
      if (v) v.textContent = density.toFixed(2);
      schedule();
    });
  }

  var titleInput = document.getElementById('stTitle');
  if (titleInput) {
    titleInput.addEventListener('input', function () {
      title = this.value.trim();
      schedule();
    });
  }

  var seedBtn = document.getElementById('stSeed');
  if (seedBtn) {
    seedBtn.addEventListener('click', function () {
      seed = 1000 + Math.floor(Math.random() * 9000);
      schedule();
    });
  }

  var saveBtn = document.getElementById('stSave');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      status('导出中…');
      canvas.toBlob(function (blob) {
        if (!blob) { status('导出失败'); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (title || 'poster') + '-' + seed + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        status('已导出');
      }, 'image/png');
    });
  }

  /* --------------------------------------------------------------- 启动 */
  canvas.width = W;
  canvas.height = H;
  render();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      clearTimeout(t);
      t = setTimeout(render, 120);
    });
  }
})();
