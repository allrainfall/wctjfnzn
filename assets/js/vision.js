/* ==========================================================================
   实验 02：卷积核
   左边是程序画出来的一张静物，右边是同一个画面经过 3×3 卷积之后的样子。
   ========================================================================== */
(function () {
  'use strict';

  var src = document.getElementById('visSrc');
  var dst = document.getElementById('visDst');
  if (!src || !dst) return;

  var sctx = src.getContext('2d');
  var dctx = dst.getContext('2d');

  var W = 1, H = 1;
  var luma = null;
  var sceneCanvas = document.createElement('canvas');
  var sceneCtx = sceneCanvas.getContext('2d');
  var outData = null;
  var current = 'edgex';
  var hover = null;
  var rafPending = false;

  var KERNELS = {
    edgex:   { v: [-1, 0, 1, -2, 0, 2, -1, 0, 1], name: '横向边缘' },
    edgey:   { v: [-1, -2, -1, 0, 0, 0, 1, 2, 1], name: '纵向边缘' },
    emboss:  { v: [-2, -1, 0, -1, 1, 1, 0, 1, 2], name: '浮雕' },
    sharpen: { v: [0, -1, 0, -1, 5, -1, 0, -1, 0], name: '锐化' },
    blur:    { v: [1, 1, 1, 1, 1, 1, 1, 1, 1], name: '模糊' }
  };

  /* ------------------------------------------------------------ 画一张图 */
  function drawScene(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f8f5ee');
    g.addColorStop(1, '#e4ddcb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    function shadow(cx, cy, rx, ry, a) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx, ry);
      var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      rg.addColorStop(0, 'rgba(58,52,42,' + a + ')');
      rg.addColorStop(1, 'rgba(58,52,42,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    var m = Math.min(w, h);

    /* 球 */
    var r = m * 0.155;
    var sx = w * 0.34, sy = h * 0.235;
    shadow(sx + r * 0.35, sy + r * 1.16, r * 1.55, r * 0.42, 0.32);
    var rg = ctx.createRadialGradient(sx - r * 0.36, sy - r * 0.46, r * 0.06, sx, sy, r * 1.06);
    rg.addColorStop(0, '#fdfaf3');
    rg.addColorStop(0.42, '#ded6c5');
    rg.addColorStop(0.82, '#a89e8c');
    rg.addColorStop(1, '#6f6656');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    /* 圆柱 */
    var cw = m * 0.30, chh = m * 0.30;
    var cx = w * 0.66, cy = h * 0.185;
    shadow(cx + cw * 0.4, cy + chh + cw * 0.2, cw * 0.95, cw * 0.3, 0.28);
    var lg = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    lg.addColorStop(0, '#877e6e');
    lg.addColorStop(0.28, '#e9e2d3');
    lg.addColorStop(0.62, '#cdc4b1');
    lg.addColorStop(1, '#7c7364');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.rect(cx - cw / 2, cy, cw, chh);
    ctx.fill();
    ctx.fillStyle = '#f0ebdf';
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, cw * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(90,82,70,0.30)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + chh, cw / 2, cw * 0.17, 0, 0, Math.PI);
    ctx.fill();

    /* 立方体 */
    var u = m * 0.115;
    var bx = w * 0.44, by = h * 0.655;
    function poly(pts, fill) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    shadow(bx + u * 0.3, by + u * 1.55, u * 1.6, u * 0.42, 0.3);
    poly([[bx, by - u * 0.5], [bx + u, by], [bx, by + u * 0.5], [bx - u, by]], '#f2ede1');
    poly([[bx - u, by], [bx, by + u * 0.5], [bx, by + u * 1.55], [bx - u, by + u * 1.05]], '#c8bfac');
    poly([[bx + u, by], [bx, by + u * 0.5], [bx, by + u * 1.55], [bx + u, by + u * 1.05]], '#9a9280');

    /* 颗粒 */
    var id = ctx.getImageData(0, 0, w, h);
    var d = id.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * 4.5;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(id, 0, 0);
    return id;
  }

  /* ------------------------------------------------------------ 卷积 */
  function build() {
    var m = Math.min(window.devicePixelRatio || 1, 2);

    var r1 = src.getBoundingClientRect();
    W = Math.max(2, Math.round(r1.width * m));
    H = Math.max(2, Math.round(r1.height * m));
    if (src.width !== W || src.height !== H) { src.width = W; src.height = H; }
    if (dst.width !== W || dst.height !== H) { dst.width = W; dst.height = H; }
    sceneCanvas.width = W;
    sceneCanvas.height = H;

    var id = drawScene(sceneCtx, W, H);
    luma = new Float32Array(W * H);
    var d = id.data;
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      luma[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }

    outData = dctx.createImageData(W, H);
    apply(current);
    src.setAttribute('data-ready', '1');
  }

  function apply(name) {
    current = name;
    var k = KERNELS[name].v;
    var out = new Float32Array(W * H);
    var min = 1e9, max = -1e9;

    for (var y = 1; y < H - 1; y++) {
      var row = y * W;
      for (var x = 1; x < W - 1; x++) {
        var s =
          k[0] * luma[row - W + x - 1] + k[1] * luma[row - W + x] + k[2] * luma[row - W + x + 1] +
          k[3] * luma[row + x - 1]     + k[4] * luma[row + x]     + k[5] * luma[row + x + 1] +
          k[6] * luma[row + W + x - 1] + k[7] * luma[row + W + x] + k[8] * luma[row + W + x + 1];
        out[row + x] = s;
        if (s < min) min = s;
        if (s > max) max = s;
      }
    }
    var span = (max - min) || 1;
    var zeroSum = Math.abs(k[0] + k[1] + k[2] + k[3] + k[4] + k[5] + k[6] + k[7] + k[8]) < 1e-6;
    var maxAbs = Math.max(Math.abs(max), Math.abs(min)) || 1;
    var data = outData.data;
    for (var j = 0; j < out.length; j++) {
      var v;
      if (zeroSum) {
        // 零和核：平坦处没有响应，画成暗底亮边
        var t2 = Math.max(0, Math.abs(out[j]) / maxAbs - 0.07) / 0.93;
        v = Math.round(8 + 242 * Math.pow(t2, 0.75));
      } else {
        v = Math.round(((out[j] - min) / span) * 255);
      }
      if (v < 0) v = 0; else if (v > 255) v = 255;
      data[j * 4] = v;
      data[j * 4 + 1] = v;
      data[j * 4 + 2] = v;
      data[j * 4 + 3] = 255;
    }
    dctx.putImageData(outData, 0, 0);
    render();
    drawKernelGrid();
  }

  function render() {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    sctx.drawImage(sceneCanvas, 0, 0);
    if (hover) {
      var s = Math.round(38 * (W / Math.max(1, src.getBoundingClientRect().width)));
      var x = Math.round(hover.x - s / 2);
      var y = Math.round(hover.y - s / 2);
      sctx.strokeStyle = 'rgba(192,66,39,0.95)';
      sctx.lineWidth = Math.max(1, Math.round(W / 500));
      sctx.strokeRect(x + 0.5, y + 0.5, s, s);
      sctx.beginPath();
      sctx.moveTo(hover.x - 8, hover.y);
      sctx.lineTo(hover.x + 8, hover.y);
      sctx.moveTo(hover.x, hover.y - 8);
      sctx.lineTo(hover.x, hover.y + 8);
      sctx.strokeStyle = 'rgba(192,66,39,0.55)';
      sctx.stroke();
    }
  }

  function drawKernelGrid() {
    var box = document.getElementById('visKernelGrid');
    if (!box) return;
    var k = KERNELS[current].v;
    box.innerHTML = '';
    for (var i = 0; i < 9; i++) {
      var c = document.createElement('span');
      c.className = 'kernel-cell' + (k[i] < 0 ? ' neg' : '');
      c.textContent = k[i];
      box.appendChild(c);
    }
  }

  /* ------------------------------------------------------------ 交互 */
  function readout(px, py) {
    if (!luma) return;
    px = Math.max(1, Math.min(W - 2, Math.round(px)));
    py = Math.max(1, Math.min(H - 2, Math.round(py)));
    var k = KERNELS[current].v;
    var sum = 0;
    for (var j = 0; j < 3; j++) {
      for (var i = 0; i < 3; i++) {
        sum += k[j * 3 + i] * luma[(py - 1 + j) * W + (px - 1 + i)];
      }
    }
    var lt = document.getElementById('visLuma');
    var st = document.getElementById('visSum');
    if (lt) lt.textContent = Math.round(luma[py * W + px]);
    if (st) st.textContent = Math.round(sum);
  }

  src.addEventListener('pointermove', function (e) {
    var r = src.getBoundingClientRect();
    var scale = W / r.width;
    hover = { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale };
    readout(hover.x, hover.y);
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(function () { rafPending = false; render(); });
    }
  });

  src.addEventListener('pointerleave', function () {
    hover = null;
    render();
    var lt = document.getElementById('visLuma');
    var st = document.getElementById('visSum');
    if (lt) lt.textContent = '—';
    if (st) st.textContent = '—';
  });

  var box = document.getElementById('visKernels');
  if (box) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var btns = box.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      apply(b.dataset.k);
      var hint = document.getElementById('visHint');
      if (hint) hint.textContent = '当前核：' + KERNELS[b.dataset.k].name + '　·　把光标移到左边的图上';
    });
  }

  var t = 0;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { hover = null; build(); }, 260);
  });

  build();
})();
