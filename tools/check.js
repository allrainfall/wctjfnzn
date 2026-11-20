/**
 * 静态检查：链接、资源、路径规范
 * node tools/check.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

let problems = 0;
let checked = 0;
const report = [];

function fail(msg) {
  problems++;
  report.push('  ✗ ' + msg);
}

for (const page of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');

  // 1. 禁止绝对路径与 file://
  if (/file:\/\//i.test(html)) fail(page + ' 含有 file:// 链接');
  if (/(?:href|src)\s*=\s*["']\/(?!\/)/i.test(html)) fail(page + ' 含有以 / 开头的绝对路径');

  // 2. href / src 是否存在
  const re = /(?:href|src)\s*=\s*["']([^"'#?]+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (/^(https?:|mailto:|data:|javascript:|tel:)/i.test(url)) {
      fail(page + ' 引用了外部资源：' + url);
      continue;
    }
    if (url.startsWith('#')) continue;
    checked++;
    const target = path.join(ROOT, decodeURIComponent(url));
    if (!fs.existsSync(target)) fail(page + ' 断链：' + url);
  }

  // 3. 每个页面都必须能被首页到达，且首页链接到全部页面
  if (page === 'index.html') {
    for (const other of PAGES) {
      if (other === 'index.html') continue;
      if (!html.includes('href="' + other + '"')) fail('首页没有链接到 ' + other);
    }
  } else {
    if (!html.includes('href="index.html"')) fail(page + ' 没有返回首页的链接');
  }

  // 4. 基本的无障碍检查
  const imgTags = html.match(/<img\b[^>]*>/g) || [];
  for (const tag of imgTags) {
    if (!/\balt=/.test(tag)) fail(page + ' 有图片缺少 alt');
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) fail(page + ' 有图片缺少宽高：' + tag.slice(0, 60));
  }
  if (!/<html lang="zh-CN"/.test(html)) fail(page + ' 缺少 lang 属性');

  // 5. 标题与描述
  if (!/<title>[^<]{4,}<\/title>/.test(html)) fail(page + ' 缺少 title');
  if (!/name="description"/.test(html)) fail(page + ' 缺少 description');
}

// 6. CSS / JS 里引用的资源
const cssDir = path.join(ROOT, 'assets', 'css');
for (const f of fs.readdirSync(cssDir).filter((x) => x.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(cssDir, f), 'utf8');
  const clean = css.replace(/url\(\s*"data:[\s\S]*?"\s*\)/g, '').replace(/url\(\s*'data:[\s\S]*?'\s*\)/g, '');
  const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let m;
  while ((m = re.exec(clean))) {
    const url = m[1];
    if (url.startsWith('data:')) continue;
    checked++;
    const target = path.resolve(cssDir, url);
    if (!fs.existsSync(target)) fail(f + ' 中的资源不存在：' + url);
  }
  if (/@import\s+url\(\s*["']?https?:/i.test(css)) fail(f + ' 远程 @import');
}

// 7. 页面数量
if (PAGES.length < 5) fail('页面数量不足 5 个，实际：' + PAGES.length);

report.unshift('页面 ' + PAGES.length + ' 个，检查资源引用 ' + checked + ' 处');
console.log(report.join('\n'));
console.log(problems === 0 ? '\n全部通过 ✓' : '\n发现 ' + problems + ' 个问题 ✗');
process.exit(problems === 0 ? 0 : 1);
