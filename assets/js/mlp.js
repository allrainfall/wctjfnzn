/* ==========================================================================
   实验 03：训练场
   一个 2 → N → N → 1 的全连接网络，反向传播 + Adam，全部在这里跑。
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('mlpCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var W = 1, H = 1, S = 1, FX = 0, FY = 0;

  var GRID = 112;
  var fieldCanvas = document.createElement('canvas');
  var fctx = fieldCanvas.getContext('2d');
  fieldCanvas.width = GRID;
  fieldCanvas.height = GRID;
  var fieldData = fctx.createImageData(GRID, GRID);

  var net = null;
  var points = [];
  var dataset = 'xor';
  var lr = 0.03;
  var width = 8;
  var actName = 'tanh';
  var running = true;
  var everRan = false;
  var step = 0;
  var lossHist = [];
  var losses = 0, accs = 0;
  var fieldDirty = true;
  var frameCount = 0;
  var rafId = 0;
  var alive = false;

  var INK = '23, 21, 15';
  var ACC = '192, 66, 39';

  /* --------------------------------------------------------------- 网络 */
  function makeNet(sizes, act) {
    var n = { sizes: sizes.slice(), act: act, W: [], b: [], mW: [], vW: [], mb: [], vb: [],
              gW: [], gb: [], a: [], d: [], t: 0 };
    for (var l = 1; l < sizes.length; l++) {
      var fi = sizes[l - 1], fo = sizes[l];
      var lim = Math.sqrt(6 / (fi + fo));
      var w = new Float32Array(fi * fo);
      for (var i = 0; i < w.length; i++) w[i] = (Math.random() * 2 - 1) * lim;
      n.W.push(w);
      n.b.push(new Float32Array(fo));
      n.mW.push(new Float32Array(fi * fo));
      n.vW.push(new Float32Array(fi * fo));
      n.mb.push(new Float32Array(fo));
      n.vb.push(new Float32Array(fo));
      n.gW.push(new Float32Array(fi * fo));
      n.gb.push(new Float32Array(fo));
      n.a.push(new Float32Array(sizes[l - 1]));
      n.d.push(new Float32Array(fo));
    }
    n.a.push(new Float32Array(sizes[sizes.length - 1]));
    return n;
  }

  function forward(n, x0, x1) {
    var a = n.a;
    a[0][0] = x0;
    a[0][1] = x1;
    for (var l = 0; l < n.W.length; l++) {
      var fi = n.sizes[l], fo = n.sizes[l + 1];
      var w = n.W[l], b = n.b[l], prev = a[l], out = a[l + 1];
      var last = l === n.W.length - 1;
      for (var j = 0; j < fo; j++) {
        var s = b[j], off = j * fi;
        for (var i = 0; i < fi; i++) s += w[off + i] * prev[i];
        if (last) out[j] = 1 / (1 + Math.exp(-s));
        else if (n.act === 'tanh') out[j] = Math.tanh(s);
        else out[j] = s > 0 ? s : s * 0.01;
      }
    }
    return a[n.a.length - 1][0];
  }

  function backward(n, target) {
    var L = n.W.length;
    n.d[L - 1][0] = n.a[L][0] - target;
    for (var l = L - 1; l >= 0; l--) {
      var fi = n.sizes[l], fo = n.sizes[l + 1];
      var prev = n.a[l], d = n.d[l], gW = n.gW[l], gb = n.gb[l], w = n.W[l];
      for (var j = 0; j < fo; j++) {
        var dj = d[j], off = j * fi;
        gb[j] += dj;
        for (var i = 0; i < fi; i++) gW[off + i] += dj * prev[i];
      }
      if (l > 0) {
        var dp = n.d[l - 1];
        for (var i2 = 0; i2 < fi; i2++) {
          var s = 0;
          for (var j2 = 0; j2 < fo; j2++) s += w[j2 * fi + i2] * d[j2];
          var av = prev[i2];
          dp[i2] = s * (n.act === 'tanh' ? (1 - av * av) : (av > 0 ? 1 : 0.01));
        }
      }
    }
  }

  function zeroGrads(n) {
    for (var l = 0; l < n.gW.length; l++) {
      n.gW[l].fill(0);
      n.gb[l].fill(0);
    }
  }

  function adam(n, rate) {
    n.t++;
    var b1 = 0.9, b2 = 0.999, eps = 1e-8;
    var c1 = 1 - Math.pow(b1, n.t), c2 = 1 - Math.pow(b2, n.t);
    function upd(p, g, m, v) {
      for (var i = 0; i < p.length; i++) {
        var gi = g[i];
        m[i] = b1 * m[i] + (1 - b1) * gi;
        v[i] = b2 * v[i] + (1 - b2) * gi * gi;
        p[i] -= rate * (m[i] / c1) / (Math.sqrt(v[i] / c2) + eps);
      }
    }
    for (var l = 0; l < n.W.length; l++) {
      upd(n.W[l], n.gW[l], n.mW[l], n.vW[l]);
      upd(n.b[l], n.gb[l], n.mb[l], n.vb[l]);
    }
  }

  function trainSteps(n, count) {
    if (!points.length) return;
    for (var s = 0; s < count; s++) {
      var batch = Math.min(16, points.length);
      zeroGrads(n);
      for (var k = 0; k < batch; k++) {
        var p = points[(Math.random() * points.length) | 0];
        forward(n, p[0], p[1]);
        backward(n, p[2]);
      }
      for (var l = 0; l < n.gW.length; l++) {
        for (var i = 0; i < n.gW[l].length; i++) n.gW[l][i] /= batch;
        for (var j = 0; j < n.gb[l].length; j++) n.gb[l][j] /= batch;
      }
      adam(n, lr);
      step++;
    }
  }

  function evaluate(n) {
    if (!points.length) return { loss: 0, acc: 0 };
    var loss = 0, hit = 0;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var y = forward(n, p[0], p[1]);
      var t = p[2];
      var e = Math.max(1e-7, Math.min(1 - 1e-7, y));
      loss += -(t * Math.log(e) + (1 - t) * Math.log(1 - e));
      if ((y > 0.5 ? 1 : 0) === t) hit++;
    }
    return { loss: loss / points.length, acc: hit / points.length };
  }

  /* ------------------------------------------------------------- 数据 */
  function randn() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function makeDataset(name) {
    var pts = [];
    var i, t, r;
    if (name === 'xor') {
      for (i = 0; i < 220; i++) {
        var sx = Math.random() < 0.5 ? -1 : 1;
        var sy = Math.random() < 0.5 ? -1 : 1;
        var x = sx * (0.28 + Math.random() * 0.42) + randn() * 0.06;
        var y = sy * (0.28 + Math.random() * 0.42) + randn() * 0.06;
        pts.push([x, y, sx * sy > 0 ? 0 : 1]);
      }
    } else if (name === 'circle') {
      for (i = 0; i < 210; i++) {
        t = Math.random() * Math.PI * 2;
        r = Math.sqrt(Math.random()) * 0.42;
        pts.push([Math.cos(t) * r, Math.sin(t) * r, 0]);
      }
      for (i = 0; i < 210; i++) {
        t = Math.random() * Math.PI * 2;
        r = 0.72 + Math.random() * 0.22;
        pts.push([Math.cos(t) * r, Math.sin(t) * r, 1]);
      }
    } else if (name === 'moons') {
      for (i = 0; i < 220; i++) {
        t = Math.random() * Math.PI;
        pts.push([Math.cos(t) * 0.72 - 0.2, Math.sin(t) * 0.72 - 0.22, 0]);
      }
      for (i = 0; i < 220; i++) {
        t = Math.random() * Math.PI;
        pts.push([0.72 - Math.cos(t) * 0.72 + 0.2, 0.34 - Math.sin(t) * 0.62, 1]);
      }
    } else if (name === 'spiral') {
      for (i = 0; i < 260; i++) {
        var arm = i % 2;
        r = 0.12 + (i / 260) * 0.92;
        t = r * 3.4 * Math.PI + arm * Math.PI + randn() * 0.05;
        pts.push([Math.cos(t) * r, Math.sin(t) * r, arm]);
      }
    }
    return pts;
  }

  /* ------------------------------------------------------------- 画布 */
  function layout() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W, H) * 0.94;
    FX = (W - S) / 2;
    FY = (H - S) / 2;
    fieldDirty = true;
  }

  function toData(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var x = (clientX - r.left - FX) / S * 2 - 1;
    var y = (clientY - r.top - FY) / S * 2 - 1;
    return [x, y];
  }

  function drawField() {
    if (!net) return;
    var d = fieldData.data;
    var p = 0;
    var PR = 242, PG = 239, PB = 231;
    var IR = 23, IG = 21, IB = 15;
    var AR = 192, AG = 66, AB = 39;
    for (var gy = 0; gy < GRID; gy++) {
      var y = ((gy + 0.5) / GRID) * 2 - 1;
      for (var gx = 0; gx < GRID; gx++) {
        var x = ((gx + 0.5) / GRID) * 2 - 1;
        var v = forward(net, x, y);
        var t = Math.min(1, Math.abs(v - 0.5) * 2);
        var a = Math.pow(t, 0.72) * (v < 0.5 ? 0.185 : 0.26);
        var r, g, b;
        if (Math.abs(v - 0.5) < 0.028) {
          r = PR + (IR - PR) * 0.38;
          g = PG + (IG - PG) * 0.38;
          b = PB + (IB - PB) * 0.38;
        } else if (v < 0.5) {
          r = PR + (IR - PR) * a;
          g = PG + (IG - PG) * a;
          b = PB + (IB - PB) * a;
        } else {
          r = PR + (AR - PR) * a;
          g = PG + (AG - PG) * a;
          b = PB + (AB - PB) * a;
        }
        d[p] = r;
        d[p + 1] = g;
        d[p + 2] = b;
        d[p + 3] = 255;
        p += 4;
      }
    }
    fctx.putImageData(fieldData, 0, 0);
    fieldDirty = false;
  }

  function drawPoints() {
    var i, p, px, py;
    for (i = 0; i < points.length; i++) {
      p = points[i];
      px = FX + ((p[0] + 1) / 2) * S;
      py = FY + ((p[1] + 1) / 2) * S;
      ctx.beginPath();
      ctx.arc(px, py, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = p[2] === 1 ? 'rgba(192,66,39,0.92)' : 'rgba(23,21,15,0.88)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(242,239,231,0.75)';
      ctx.stroke();
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#efeade';
    ctx.fillRect(0, 0, W, H);
    if (fieldDirty) drawField();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fieldCanvas, FX, FY, S, S);
    ctx.strokeStyle = 'rgba(23,21,15,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(FX + 0.5, FY + 0.5, S - 1, S - 1);
    drawPoints();
  }

  /* ------------------------------------------------------------- 曲线 */
  function drawSpark() {
    var sp = document.getElementById('mlpSpark');
    if (!sp) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = sp.getBoundingClientRect();
    var w = Math.max(10, Math.round(r.width));
    var h = Math.max(10, Math.round(r.height));
    if (sp.width !== w * dpr || sp.height !== h * dpr) {
      sp.width = w * dpr;
      sp.height = h * dpr;
    }
    var c = sp.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(23,21,15,0.14)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, h - 0.5);
    c.lineTo(w, h - 0.5);
    c.stroke();
    if (lossHist.length < 2) return;
    var max = 0.0001;
    for (var i = 0; i < lossHist.length; i++) if (lossHist[i] > max) max = lossHist[i];
    c.beginPath();
    for (var j = 0; j < lossHist.length; j++) {
      var x = (j / (lossHist.length - 1)) * w;
      var y = h - (lossHist[j] / max) * (h - 4) - 2;
      if (j === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = '#c04227';
    c.lineWidth = 1.4;
    c.stroke();
  }

  function updateReadout() {
    var e = document.getElementById('mlpStep');
    var l = document.getElementById('mlpLoss');
    var a = document.getElementById('mlpAcc');
    if (e) e.textContent = step.toLocaleString('en-US');
    if (l) l.textContent = losses ? losses.toFixed(3) : '—';
    if (a) a.textContent = points.length ? Math.round(accs * 100) + '%' : '—';
  }

  /* ------------------------------------------------------------- 主循环 */
  function frame() {
    if (!alive) return;
    rafId = requestAnimationFrame(frame);
    if (running) {
      trainSteps(net, points.length > 400 ? 4 : 6);
      if (frameCount % 3 === 0) {
        var m = evaluate(net);
        losses = m.loss;
        accs = m.acc;
        if (frameCount % 9 === 0) {
          lossHist.push(m.loss);
          if (lossHist.length > 240) lossHist.shift();
          drawSpark();
        }
        updateReadout();
        fieldDirty = true;
      }
    }
    frameCount++;
    render();
  }

  function start() {
    if (alive) return;
    alive = true;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    alive = false;
    cancelAnimationFrame(rafId);
  }

  /* ------------------------------------------------------------- 重建 */
  function rebuild(keepPoints) {
    net = makeNet([2, width, width, 1], actName);
    step = 0;
    lossHist = [];
    losses = 0;
    accs = 0;
    if (!keepPoints) points = makeDataset(dataset);
    fieldDirty = true;
    drawSpark();
    updateReadout();
    render();
  }

  /* ------------------------------------------------------------- 交互 */
  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var d = toData(e.clientX, e.clientY);
    if (Math.abs(d[0]) > 1 || Math.abs(d[1]) > 1) return;
    points.push([d[0], d[1], e.shiftKey ? 1 : 0]);
    fieldDirty = true;
    render();
  });

  var dataBox = document.getElementById('mlpData');
  if (dataBox) {
    dataBox.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var btns = dataBox.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      dataset = b.dataset.set;
      points = makeDataset(dataset);
      rebuild(true);
    });
  }

  var lrSlider = document.getElementById('mlpLr');
  if (lrSlider) {
    lrSlider.addEventListener('input', function () {
      var v = +this.value;
      lr = Math.pow(10, -3 + (v / 60) * 2);
      var out = document.getElementById('mlpLrVal');
      if (out) out.textContent = lr.toFixed(3);
    });
    lr = Math.pow(10, -3 + (+lrSlider.value / 60) * 2);
    var l0 = document.getElementById('mlpLrVal');
    if (l0) l0.textContent = lr.toFixed(3);
  }

  var wSlider = document.getElementById('mlpWidth');
  if (wSlider) {
    wSlider.addEventListener('input', function () {
      width = +this.value;
      var out = document.getElementById('mlpWidthVal');
      if (out) out.textContent = width;
      rebuild(true);
    });
    width = +wSlider.value;
  }

  var actBox = document.getElementById('mlpAct');
  if (actBox) {
    actBox.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var btns = actBox.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      actName = b.dataset.act;
      rebuild(true);
    });
  }

  var playBtn = document.getElementById('mlpPlay');
  function setRunning(v) {
    running = v;
    var s = document.getElementById('mlpStatus');
    if (s) s.textContent = running ? '训练中' : '已暂停';
    if (playBtn) playBtn.textContent = running ? '暂停' : '继续';
  }
  if (playBtn) playBtn.addEventListener('click', function () { setRunning(!running); });

  var resetBtn = document.getElementById('mlpReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      points = makeDataset(dataset);
      rebuild(true);
      setRunning(true);
    });
  }

  var hoverLab = false;
  var labFrame = canvas.closest('.lab-frame') || canvas;
  labFrame.addEventListener('pointerenter', function () { hoverLab = true; });
  labFrame.addEventListener('pointerleave', function () { hoverLab = false; });

  document.addEventListener('keydown', function (e) {
    if (!hoverLab) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.code === 'Space') {
      e.preventDefault();
      setRunning(!running);
    } else if (e.key === 'r' || e.key === 'R') {
      points = makeDataset(dataset);
      rebuild(true);
    }
  });

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(layout, 220);
  });

  /* ------------------------------------------------------------- 启动 */
  layout();
  rebuild(false);

  if (GL.reduceMotion) {
    // 无障碍：直接给一个训练好的结果，不做动画
    for (var q = 0; q < 2400; q++) trainSteps(net, 4);
    var m = evaluate(net);
    losses = m.loss;
    accs = m.acc;
    updateReadout();
    fieldDirty = true;
    render();
    setRunning(false);
  } else {
    GL.whenVisible(canvas.parentElement, start, stop);
  }
})();
