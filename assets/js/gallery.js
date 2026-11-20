/* ==========================================================================
   画廊：灯箱、键盘导航、焦点管理
   ========================================================================== */
(function () {
  'use strict';

  var items = [].slice.call(document.querySelectorAll('.gal-item'));
  var lb = document.getElementById('lightbox');
  if (!items.length || !lb) return;

  var img = document.getElementById('lbImg');
  var idxEl = document.getElementById('lbIdx');
  var titleEl = document.getElementById('lbTitle');
  var descEl = document.getElementById('lbDesc');
  var algoEl = document.getElementById('lbAlgo');
  var seedEl = document.getElementById('lbSeed');
  var closeBtn = document.getElementById('lbClose');
  var prevBtn = document.getElementById('lbPrev');
  var nextBtn = document.getElementById('lbNext');

  var index = -1;
  var lastFocus = null;

  function pad(n) { return (n < 9 ? '0' : '') + (n + 1); }

  function show(i) {
    index = (i + items.length) % items.length;
    var el = items[index];
    var d = el.dataset;
    img.src = d.full;
    img.alt = d.title + '：' + (d.algo || '');
    titleEl.textContent = d.title;
    descEl.textContent = d.desc;
    algoEl.textContent = d.algo;
    seedEl.textContent = d.seed;
    idxEl.textContent = pad(index) + ' / ' + items.length;
    // 预载相邻两张，避免翻页时白屏
    [items[(index + 1) % items.length], items[(index - 1 + items.length) % items.length]].forEach(function (it) {
      var pre = new Image();
      pre.src = it.dataset.full;
    });
  }

  function open(i, trigger) {
    lastFocus = trigger || document.activeElement;
    show(i);
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-open');
    window.setTimeout(function () { closeBtn.focus({ preventScroll: true }); }, 60);
  }

  function close() {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function step(d) {
    show(index + d);
  }

  items.forEach(function (el, i) {
    el.addEventListener('click', function () { open(i, el); });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });

  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target.classList.contains('lightbox-stage')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'Tab') {
      // 把焦点锁在对话框内
      var focusables = lb.querySelectorAll('button');
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
})();
