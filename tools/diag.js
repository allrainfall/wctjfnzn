/**
 * 诊断：收集控制台错误、失败请求、关键元素的实际布局
 * node tools/diag.js
 */
const { spawn } = require('child_process');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://127.0.0.1:8765/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = ['index.html', 'rules.html', 'perceive.html', 'learn.html', 'gallery.html', 'studio.html', 'about.html'];

async function fetchJson(url) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* retry */ }
    await wait(250);
  }
  throw new Error('no devtools');
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
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params, msg.sessionId);
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
  on(m, fn) {
    if (!this.listeners.has(m)) this.listeners.set(m, []);
    this.listeners.get(m).push(fn);
  }
}

async function main() {
  const proc = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-crash-reporter',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(ROOT, '_shots', 'diagprofile'),
    'about:blank',
  ], { stdio: 'ignore' });

  const version = await fetchJson(`http://127.0.0.1:${PORT}/json/version`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);

  for (const page of PAGES) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    const problems = [];
    cdp.on('Runtime.exceptionThrown', (p, sid) => {
      if (sid !== sessionId) return;
      const d = p.exceptionDetails;
      problems.push('JS 异常: ' + (d.exception && d.exception.description || d.text));
    });
    cdp.on('Runtime.consoleAPICalled', (p, sid) => {
      if (sid !== sessionId) return;
      if (p.type === 'error' || p.type === 'warning') {
        problems.push('console.' + p.type + ': ' + p.args.map((a) => a.value || a.description || '').join(' '));
      }
    });
    cdp.on('Network.responseReceived', (p, sid) => {
      if (sid !== sessionId) return;
      if (p.response.status >= 400) problems.push('HTTP ' + p.response.status + ' ' + p.response.url);
    });
    cdp.on('Network.loadingFailed', (p, sid) => {
      if (sid !== sessionId) return;
      problems.push('加载失败: ' + p.errorText + ' ' + (p.type || ''));
    });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    }, sessionId);

    await cdp.send('Page.navigate', { url: BASE + page }, sessionId);
    await wait(900);

    await cdp.send('Runtime.evaluate', {
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
    await wait(1200);

    const info = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const out = { url: location.pathname, height: document.body.scrollHeight, imgs: [], blocks: [] };
        document.querySelectorAll('img').forEach(img => {
          out.imgs.push({ src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0,
                          nw: img.naturalWidth, w: Math.round(img.getBoundingClientRect().width) });
        });
        document.querySelectorAll('.room').forEach(el => {
          const r = el.getBoundingClientRect();
          out.blocks.push({ cls: 'room', x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY),
                            w: Math.round(r.width), h: Math.round(r.height),
                            op: getComputedStyle(el).opacity,
                            img: (el.querySelector('img') || {}).complete });
        });
        document.querySelectorAll('.gal-item').forEach(el => {
          const r = el.getBoundingClientRect();
          out.blocks.push({ cls: 'gal', y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), op: getComputedStyle(el).opacity });
        });
        return out;
      })()`,
    }, sessionId);

    const v = info.result.value;
    console.log('\n=== ' + page + '  height=' + v.height + ' ===');
    const brokenImgs = v.imgs.filter((i) => !i.ok);
    if (brokenImgs.length) console.log('  断图 ' + brokenImgs.length + ' 张: ' + brokenImgs.map((i) => i.src).join(', '));
    const hidden = v.blocks.filter((b) => parseFloat(b.op) < 0.9);
    if (hidden.length) console.log('  未显示的元素: ' + JSON.stringify(hidden.slice(0, 8)));
    console.log('  区块: ' + v.blocks.map((b) => b.cls + '@' + b.y + ' h' + b.h + ' w' + b.w + ' op' + b.op).join(' | '));
    if (problems.length) console.log('  问题: ' + JSON.stringify([...new Set(problems)].slice(0, 10), null, 1));
    else console.log('  无控制台错误 / 无失败请求');

    await cdp.send('Target.closeTarget', { targetId });
  }

  ws.close();
  proc.kill();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
