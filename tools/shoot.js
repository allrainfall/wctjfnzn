/**
 * 用 Chrome DevTools Protocol 截图：真实的等待时间 + 整页捕获。
 * node tools/shoot.js [名称...]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_shots');
const BASE = 'http://127.0.0.1:8765/';

fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SHOTS = [
  { name: '01-home', url: 'index.html', w: 1440, h: 900, full: true, wait: 3200 },
  { name: '02-home-mobile', url: 'index.html', w: 390, h: 844, mobile: true, full: true, wait: 2600 },
  { name: '03-rules', url: 'rules.html', w: 1440, h: 900, full: true, wait: 2600 },
  { name: '04-rules-lab', url: 'rules.html#lab', w: 1440, h: 1000, full: false, wait: 2600 },
  { name: '05-perceive', url: 'perceive.html', w: 1440, h: 900, full: true, wait: 2600 },
  { name: '06-perceive-lab', url: 'perceive.html#lab', w: 1440, h: 1000, full: false, wait: 2200 },
  { name: '07-learn', url: 'learn.html', w: 1440, h: 900, full: true, wait: 2600 },
  { name: '08-learn-lab', url: 'learn.html#lab', w: 1440, h: 1000, full: false, wait: 4200 },
  { name: '09-gallery', url: 'gallery.html', w: 1440, h: 900, full: true, wait: 2600 },
  { name: '10-studio', url: 'studio.html', w: 1440, h: 1200, full: true, wait: 2600 },
  { name: '11-about', url: 'about.html', w: 1440, h: 900, full: true, wait: 2200 },
  { name: '12-gallery-mobile', url: 'gallery.html', w: 390, h: 844, mobile: true, full: true, wait: 2200 },
  { name: '13-studio-mobile', url: 'studio.html', w: 390, h: 844, mobile: true, full: true, wait: 2600 },
  { name: '14-learn-mobile', url: 'learn.html#lab', w: 390, h: 844, mobile: true, full: false, wait: 3200 },
  { name: '15-lightbox', url: 'gallery.html', w: 1440, h: 900, full: false, wait: 1800, click: '.gal-item:nth-of-type(7)' },
  { name: '16-about-top', url: 'about.html', w: 1440, h: 1500, full: false, wait: 2600 },
];

async function fetchJson(url) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* 还没起来 */ }
    await wait(250);
  }
  throw new Error('Chrome 调试端口没有响应');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      } else if (msg.method) {
        const list = this.listeners.get(msg.method) || [];
        for (const fn of list) fn(msg.params, msg.sessionId);
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
}

async function main() {
  const only = process.argv.slice(2);
  const jobs = only.length ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;

  const proc = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--force-device-scale-factor=1',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(OUT, 'profile'),
    'about:blank',
  ], { stdio: 'ignore' });

  const version = await fetchJson(`http://127.0.0.1:${PORT}/json/version`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);

  for (const job of jobs) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: job.w,
      height: job.h,
      deviceScaleFactor: 1,
      mobile: !!job.mobile,
    }, sessionId);

    await cdp.send('Page.navigate', { url: BASE + job.url }, sessionId);
    await wait(700);

    if (!job.full) {
      const hash = job.url.split('#')[1];
      if (hash) {
        const r = await cdp.send('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => {
            const el = document.getElementById('${hash}');
            if (!el) return { ok: false };
            const root = document.documentElement;
            root.style.scrollBehavior = 'auto';
            const y = el.getBoundingClientRect().top + window.scrollY - 8;
            root.scrollTop = y;
            return { ok: true, y: Math.round(y), got: Math.round(root.scrollTop) };
          })()`,
        }, sessionId);
        console.log('   锚点 ' + hash + ' → ' + JSON.stringify(r.result.value));
      }
      await wait(job.wait);
    }

    // 滚一遍整页：让懒加载图片加载、让滚动入场动画触发，然后回到顶部
    if (job.full) await cdp.send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const root = document.documentElement;
        const prev = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto';
        const step = Math.round(window.innerHeight * 0.55);
        const h = root.scrollHeight;
        for (let y = 0; y < h; y += step) { root.scrollTop = y; await new Promise(r => setTimeout(r, 80)); }
        root.scrollTop = h;
        await new Promise(r => setTimeout(r, 200));
        root.scrollTop = 0;
        await new Promise(r => setTimeout(r, 100));
        root.style.scrollBehavior = prev;
      })();`,
    }, sessionId);

    if (job.full) await wait(job.wait);

    if (job.click) {
      await cdp.send('Runtime.evaluate', {
        expression: "document.querySelector('" + job.click + "').click()",
      }, sessionId);
      await wait(1000);
    }

    let clip;
    if (job.full) {
      const m = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
      const height = Math.min(Math.round((m.cssContentSize || m.contentSize).height), 9000);
      clip = { x: 0, y: 0, width: job.w, height, scale: 1 };
    }

    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: !!job.full,
      ...(clip ? { clip } : {}),
    }, sessionId);

    const file = path.join(OUT, job.name + '.png');
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`${job.name.padEnd(22)} ${job.w}x${clip ? clip.height : job.h}  ${kb} KB`);

    await cdp.send('Target.closeTarget', { targetId });
  }

  ws.close();
  proc.kill();
  console.log('完成');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
