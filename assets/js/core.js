/* ==========================================================================
   生长 GROWTH LAB — 公共脚本
   页头状态 / 阅读进度 / 全屏菜单 / 入场观察 / 光标 / 画布与噪声工具
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------------------------------------------------------------- 工具 */
  var GL = (window.GL = window.GL || {});

  GL.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  GL.lerp = function (a, b, t) { return a + (b - a) * t; };
  GL.reduceMotion = reduceMotion;

  /* 可复现随机数（mulberry32） */
  GL.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* 二维值噪声，返回 0..1 */
  GL.noise2 = (function () {
    function hash(x, y) {
      var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    }
    function smooth(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = x - xi, yf = y - yi;
      var a = hash(xi, yi);
      var b = hash(xi + 1, yi);
      var c = hash(xi, yi + 1);
      var d = hash(xi + 1, yi + 1);
      var u = smooth(xf), v = smooth(yf);
      return GL.lerp(GL.lerp(a, b, u), GL.lerp(c, d, u), v);
    };
  })();

  /* 画布按容器尺寸与设备像素比适配，返回 CSS 像素尺寸 */
  GL.fit = function (canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    var pw = Math.round(w * dpr);
    var ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h, dpr: dpr, ctx: ctx };
  };

  /* 只在元素可见时运行动画 */
  GL.whenVisible = function (el, start, stop) {
    var visible = false;
    if (!('IntersectionObserver' in window)) { start(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !visible) { visible = true; start(); }
        else if (!e.isIntersecting && visible) { visible = false; stop && stop(); }
      });
    }, { threshold: 0.01 });
    io.observe(el);
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { stop && stop(); }
      else if (visible) { start(); }
    });
  };

  /* ------------------------------------------------------------ 页头状态 */
  var head = doc.getElementById('siteHead');
  var bar = doc.getElementById('progress');
  var scrollQueued = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    if (head) head.classList.toggle('is-stuck', y > 20);

    if (bar) {
      var max = doc.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    scrollQueued = false;
  }

  window.addEventListener('scroll', function () {
    if (!scrollQueued) { scrollQueued = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ------------------------------------------------------------ 全屏菜单 */
  var menuBtn = doc.getElementById('menuBtn');
  var menu = doc.getElementById('menu');

  function setMenu(open) {
    doc.body.setAttribute('data-menu', open ? 'open' : 'closed');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    }
    if (menu) menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      var first = menu && menu.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      setMenu(doc.body.getAttribute('data-menu') !== 'open');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && doc.body.getAttribute('data-menu') === 'open') {
        setMenu(false);
        menuBtn.focus({ preventScroll: true });
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 940) setMenu(false);
    });
  }

  /* ------------------------------------------------------------ 入场动画 */
  var revealEls = [].slice.call(doc.querySelectorAll('.reveal, .reveal-img, .mask-line'));
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* -------------------------------------------------------------- 光标 */
  if (finePointer && !reduceMotion) {
    var ghost = doc.getElementById('cursor');
    if (ghost) {
      doc.body.classList.add('has-cursor');
      var gx = -100, gy = -100, tx = -100, ty = -100, raf = 0, alive = false;

      function loop() {
        gx += (tx - gx) * 0.16;
        gy += (ty - gy) * 0.16;
        ghost.style.transform = 'translate3d(' + gx.toFixed(2) + 'px,' + gy.toFixed(2) + 'px,0)';
        if (alive) raf = window.requestAnimationFrame(loop);
      }

      doc.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        tx = e.clientX; ty = e.clientY;
        if (!alive) {
          alive = true; gx = tx; gy = ty;
          ghost.style.opacity = '';
          raf = window.requestAnimationFrame(loop);
        }
      }, { passive: true });

      doc.addEventListener('pointerleave', function () {
        alive = false;
        window.cancelAnimationFrame(raf);
      });

      doc.addEventListener('pointerover', function (e) {
        var hot = e.target.closest('a, button, .room, .gal-item, [data-hot]');
        doc.body.classList.toggle('is-hot', !!hot);
      }, { passive: true });
    }
  }

  /* ------------------------------------------------------- 页面语言细节 */
  // 站内所有以 # 开头的锚点：平滑滚动并保留焦点可访问性
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var target = doc.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    history.replaceState(null, '', id);
  });

  /* 调试出口 */
  GL.ready = true;
})();
