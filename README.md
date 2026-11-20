# 生长 GROWTH LAB

> 一条规则，重复足够多次，会长出规则里根本没有的东西。
> 这件事有个名字，叫「涌现」。

一个面向所有人的互动专题：六个房间，三个可以亲手操作的实验，十二幅由代码生成的画。
没有框架、没有第三方库、没有一张来自图库的图片。

---

## 一、它讲的是什么

站点围绕一个概念展开：**涌现（emergence）**——整体的行为无法从任何一个部分里读出来。

- 康威用四条规则写出了会走路的图案；
- 一条 30 号规则能产出通过随机性检验的序列；
- 一百零五个数字被梯度推着走几万次，就能在一片空间里划出一条谁也没画过的边界；
- 十二幅画里没有一条线是手绘的，却都像是有意安排的。

首页把这条线索拆成三步（规则 → 重复 → 形状），下面六个房间分别演示它的一个侧面。

---

## 二、打开方式

**最简单的：双击 `index.html`。**

全站不依赖服务器，所有资源都是相对路径的本地文件，双击即可完整运行——
包括元胞自动机、卷积、神经网络训练和海报生成。

想用本地服务器预览（更接近线上环境）：

```bash
python -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000/
```

---

## 三、六个房间

| 文件 | 页面 | 一句话 |
| --- | --- | --- |
| `index.html` | 首页 | 主题、主线与入口 |
| `rules.html` | 01 规则 | 元胞自动机：256 条规则如何长出分形与混沌 |
| `perceive.html` | 02 观看 | 卷积核：机器如何"看"一张图 |
| `learn.html` | 03 学习 | 训练场：浏览器里实时训练一个神经网络 |
| `gallery.html` | 04 画廊 | 十二幅程序生成的作品 + 灯箱 |
| `studio.html` | 05 工作室 | 海报生成器，可导出 PNG |
| `about.html` | 06 关于 | 制作说明与技术清单 |

前三个房间各有一个真的在算的实验：拖动规则号会真的演化元胞自动机，
移动光标会真的做 3×3 卷积，训练场里的网络会真的做前向传播和反向传播（Adam 优化）。
后两个房间，是这些规则长出来的结果。

---

## 四、目录结构

```
index.html  rules.html  perceive.html  learn.html
gallery.html  studio.html  about.html

assets/
  css/
    base.css      设计令牌、排版、页头页脚、通用组件
    pages.css     各页面布局、实验台、画廊、工作室
  js/
    core.js       导航状态、阅读进度、全屏菜单、入场动画、噪声与随机数
    hero.js       首页"生长"动画
    ca.js         元胞自动机
    vision.js     卷积实验
    mlp.js        神经网络训练场（前向 / 反向传播 / Adam 全部手写）
    gallery.js    画廊灯箱
    studio.js     海报生成器
  img/
    work/         十二幅生成作品
    room-*.webp   六张栏目插图
    figure-pixels.svg  像素矩阵示意图
    favicon.svg
  fonts/
    growth-serif.woff  思源宋体子集（自托管，不依赖 CDN）

tools/
  gen_art.py      生成全部图片素材的脚本
  build_font.py   字体子集化脚本
  check.js        链接 / 资源 / 无障碍自检
  shoot.js        Chrome 调试协议截图（开发用）
  diag.js         控制台错误与布局诊断（开发用）

_notes/           本地笔记，已在 .gitignore 中排除
```

---

## 五、素材是怎么来的

**没有任何一张图片来自图库。** 十二幅作品、六张栏目插图、分享图和像素矩阵图，
全部由 `tools/gen_art.py` 用 numpy / Pillow / matplotlib 计算生成：

```bash
python tools/gen_art.py                   # 重新生成全部素材
python tools/gen_art.py 05-interference   # 只重新生成某一幅
```

每幅作品都有固定的随机种子，同一段代码 + 同一个种子 = 同一张画，
所以画廊里可以标注种子号——不是为了好看，是为了可以被验证。

字体是思源宋体（Noto Serif SC 可变字体）按站点实际用到的字符做的子集，
用 `tools/build_font.py` 生成，约 530 KB 的 woff，自托管、不依赖任何 CDN：

```bash
python tools/build_font.py
```

> 改了文案之后，如果有个别生僻字回退到系统字体，重新跑一次 `build_font.py` 即可。

---

## 六、自检

```bash
node tools/check.js
```

检查页面数量、每页是否可从首页到达、所有 `href` / `src` 是否存在、
是否出现绝对路径或 `file://`、图片是否有 `alt` 与宽高、CSS 引用的资源是否有效。

```
页面 7 个，检查资源引用 235 处
全部通过 ✓
```

---

## 七、发布到自己的地址

全站是纯静态的，任何静态托管都能直接放上去：GitHub Pages、Cloudflare Pages、
Netlify、Vercel，或者学校/公司的一台服务器。

以 GitHub Pages 为例：

1. 新建一个 **Public** 仓库，不要勾选任何初始化文件。
2. 把本文件夹里的**全部内容**（不是文件夹本身）上传到仓库根目录：
   - 网页版：仓库页 → **Add file → Upload files** → 拖入 `index.html`、其余 html、`assets/`、`tools/` → **Commit changes**；
   - 或命令行：
     ```bash
     git init
     git add .
     git commit -m "生长：关于涌现的互动专题"
     git branch -M main
     git remote add origin https://github.com/你的用户名/growth-lab.git
     git push -u origin main
     ```
3. 仓库页 → **Settings → Pages** → Source 选 `Deploy from a branch`，
   Branch 选 `main`，目录选 `/ (root)`，**Save**。
4. 等一两分钟，访问 `https://你的用户名.github.io/growth-lab/`。

因为全站使用相对路径，仓库名不叫 `用户名.github.io` 也能正常工作。

---

## 八、想改的话

| 想改什么 | 改哪里 |
| --- | --- |
| 主题色 | `assets/css/base.css` 顶部的 `--accent`（朱砂）、`--paper`、`--ink` |
| 首页主张 | `index.html` 的 `<h1 class="display hero-title">` 与 `.hero-lede` |
| 主线三步 | `index.html` 的 `<ol class="steps">` |
| 作者署名 | 七个页面页脚的"信息"栏，以及 `about.html` 的"作者" |
| 画廊作品 | 改 `tools/gen_art.py` 里的算法或种子后重新生成 |

---

## 九、浏览器与无障碍

- Chrome / Edge / Firefox / Safari 的近两年版本均可；
- 键盘可用：`Tab` 遍历、`Esc` 关闭灯箱与菜单、画廊内 `←` `→` 翻页、训练场 `空格` 暂停；
- 尊重系统的 `prefers-reduced-motion`：开启后动画停止，画布直接呈现结果；
- 每张图片都有 `alt` 与宽高，避免布局跳动。

---

*设计与编码：郑同学 · 2026*
*代码与画面都可以自由取用、修改，署名更好。*
