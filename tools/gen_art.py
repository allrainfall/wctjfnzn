# -*- coding: utf-8 -*-
"""
生长 GROWTH LAB — 视觉素材生成器
--------------------------------------------------
站点里所有图片都由本脚本现场计算生成，不使用任何图库素材。
输出：assets/img/work/*.webp（十二幅作品）与 assets/img/*.webp（封面、栏目图）
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")
WORK = os.path.join(OUT, "work")
os.makedirs(WORK, exist_ok=True)

# ------------------------------------------------------------------ 调色板
PAPER = (242, 239, 231)
INK = (23, 21, 15)
ACC = (192, 66, 39)
PINE = (44, 74, 60)
OCHRE = (184, 135, 58)
GREY = (122, 117, 104)
DARK = (13, 13, 12)
CREAM = (238, 235, 225)

PAPER_HEX = "#f2efe7"
INK_HEX = "#17150f"
ACC_HEX = "#c04227"

FONT_DIR = r"C:\Windows\Fonts"
F_SERIF = os.path.join(FONT_DIR, "NotoSerifSC-VF.ttf")
F_SANS = os.path.join(FONT_DIR, "msyh.ttc")
F_MONO = os.path.join(FONT_DIR, "consola.ttf")

SS = 2  # 超采样倍数
W, H = 1200, 1500
SW, SH = W * SS, H * SS


# ------------------------------------------------------------------ 工具
def save(img, path, quality=87):
    if img.size != (W, H):
        img = img.resize((W, H), Image.LANCZOS)
    img.convert("RGB").save(path, "WEBP", quality=quality, method=6)
    print("  ->", os.path.relpath(path, ROOT), os.path.getsize(path) // 1024, "KB")


def save_at(img, path, size, quality=88):
    img.convert("RGB").resize(size, Image.LANCZOS).save(path, "WEBP", quality=quality, method=6)
    print("  ->", os.path.relpath(path, ROOT), os.path.getsize(path) // 1024, "KB")


def smooth_noise(shape, cells, seed, order=3):
    h, w = shape
    rng = np.random.default_rng(seed)
    gh = max(2, int(cells))
    gw = max(2, int(cells * w / h))
    g = rng.random((gh, gw))
    z = ndimage.zoom(g, (h / gh, w / gw), order=order, mode="mirror")
    z = z[:h, :w]
    if z.shape != (h, w):
        pad = np.zeros((h, w))
        pad[: z.shape[0], : z.shape[1]] = z
        z = pad
    z = (z - z.min()) / (z.max() - z.min() + 1e-9)
    return z


def fbm(shape, seed, base=3, octaves=5, gain=0.5):
    out = np.zeros(shape)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * smooth_noise(shape, base * (2 ** o), seed + o * 131)
        tot += amp
        amp *= gain
    out /= tot
    return (out - out.min()) / (out.max() - out.min() + 1e-9)


def canvas(color=PAPER, size=(SW, SH)):
    im = Image.new("RGB", size, color)
    return im, ImageDraw.Draw(im, "RGBA")


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


# ------------------------------------------------------------------ 01 流场
def work_flow(seed=1207):
    ang = fbm((SH, SW), seed, base=3, octaves=4) * math.tau * 2.1
    img, d = canvas()
    rng = np.random.default_rng(seed + 5)
    n = 1500
    for i in range(n):
        x, y = rng.random() * SW, rng.random() * SH
        accent = rng.random() < 0.05
        pts = []
        for s in range(230):
            ix, iy = int(x) % SW, int(y) % SH
            a = ang[iy, ix]
            x += math.cos(a) * 2.05
            y += math.sin(a) * 2.05
            if not (0 <= x < SW and 0 <= y < SH):
                break
            if s % 2 == 0:
                pts.append((x, y))
        if len(pts) > 5:
            alpha = int(255 * (0.055 + 0.2 * rng.random()))
            col = ACC if accent else INK
            d.line(pts, fill=col + (alpha,), width=int(rng.choice([1, 1, 1, 2])), joint="curve")
    return img


# ---------------------------------------------------------------- 02 等高线
def work_contour(seed=3301):
    z = fbm((SH, SW), seed, base=2, octaves=5)
    fig = plt.figure(figsize=(W / 200, H / 200), dpi=200 * SS, facecolor=PAPER_HEX)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor(PAPER_HEX)
    ax.axis("off")
    ax.contour(z, levels=30, colors=[INK_HEX], linewidths=0.55, alpha=0.5)
    ax.contour(z, levels=[np.median(z)], colors=[ACC_HEX], linewidths=1.5, alpha=0.95)
    fig.canvas.draw()
    arr = np.asarray(fig.canvas.buffer_rgba())[:, :, :3].copy()
    plt.close(fig)
    return Image.fromarray(arr)


# ------------------------------------------------------------ 03 泰森多边形
def work_voronoi(seed=881):
    rng = np.random.default_rng(seed)
    n = 78
    pts = rng.random((n, 2)) * [SW, SH]
    # 让点轻微聚散
    pts += (fbm((n, 2), seed + 3, base=2, octaves=2)[:, :1] - 0.5) * 260

    palette = [
        (242, 239, 231), (233, 227, 213), (223, 214, 196), (212, 201, 180),
        (200, 187, 163), (186, 172, 148), (168, 154, 130),
        PINE, ACC, OCHRE, GREY, (150, 158, 146),
    ]
    weights = [0.30, 0.14, 0.10, 0.08, 0.06, 0.05, 0.04, 0.07, 0.05, 0.05, 0.03, 0.03]
    cols = rng.choice(len(palette), size=n, p=np.array(weights) / sum(weights))

    lab = np.empty((SH, SW), dtype=np.int16)
    step = 64
    xs = np.arange(SW).astype(np.float32)[None, :, None]
    px = pts[None, None, :, 0].astype(np.float32)
    py = pts[None, None, :, 1].astype(np.float32)
    for y0 in range(0, SH, step):
        y1 = min(SH, y0 + step)
        ys = np.arange(y0, y1).astype(np.float32)[:, None, None]
        d2 = (xs - px) ** 2 + (ys - py) ** 2
        lab[y0:y1] = np.argmin(d2, axis=2)

    rgb = np.array([palette[i] for i in cols], dtype=np.uint8)[lab]
    edge = np.zeros((SH, SW), bool)
    edge[:-1, :] |= lab[:-1, :] != lab[1:, :]
    edge[:, :-1] |= lab[:, :-1] != lab[:, 1:]
    edge = ndimage.binary_dilation(edge, iterations=1)
    rgb[edge] = PAPER
    return Image.fromarray(rgb)


# ---------------------------------------------------------------- 04 半调
def work_halftone(seed=451):
    h, w = SH, SW
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w * 0.5, h * 0.42
    rad = np.sqrt(((xx - cx) / (w * 0.56)) ** 2 + ((yy - cy) / (h * 0.62)) ** 2)
    f = fbm((h, w), seed, base=4, octaves=3)
    tone = np.clip(rad * 0.95 + (f - 0.5) * 0.38, 0, 1)

    img, d = canvas()
    step = 29
    band = (0.695 * h, 0.815 * h)
    for y in range(14, h, step):
        inband = band[0] <= y <= band[1]
        for x in range(14, w, step):
            t = tone[y, x]
            if inband:
                t = min(t, 0.42 + 0.3 * abs((x / w) - 0.5))
            r = (1 - t) ** 1.35 * step * 0.62
            if r < 0.35:
                continue
            col = ACC if inband else INK
            d.ellipse([x - r, y - r, x + r, y + r], fill=col + (238,))
    d.rectangle([0, int(h * 0.925), w, h], fill=PAPER + (255,))
    d.line([(w * 0.12, h * 0.955), (w * 0.88, h * 0.955)], fill=INK + (120,), width=2)
    return img


# ---------------------------------------------------------------- 05 摩尔纹
def work_moire(seed=1902):
    # 在最终分辨率上直接画线：干涉本身就是像素级的现象
    w, h = W, H
    img = Image.new("RGB", (w, h), PAPER)
    d = ImageDraw.Draw(img, "RGBA")
    diag = int(math.hypot(w, h))
    cx, cy = w / 2, h / 2

    def lines(gap, angle_deg, color, alpha, width):
        th = math.radians(angle_deg)
        ca, sa = math.cos(th), math.sin(th)
        nx, ny = -sa, ca
        n = int(diag / gap) + 2
        for i in range(-n, n + 1):
            ox, oy = cx + nx * (i * gap), cy + ny * (i * gap)
            d.line([(ox - ca * diag, oy - sa * diag), (ox + ca * diag, oy + sa * diag)],
                   fill=color + (alpha,), width=width)

    lines(9, 0, INK, 140, 1)
    lines(9, 1.9, ACC, 124, 1)
    lines(9.8, 3.8, INK, 86, 1)

    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot(xx - w / 2, yy - h / 2)
    mask = np.clip((min(w, h) * 0.425 - r) / 1.3, 0, 1)[..., None]
    arr = np.asarray(img).astype(np.float32)
    paper = np.array(PAPER, np.float32)
    out = arr * mask + paper * (1 - mask)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- 06 细分
def work_subdiv(seed=77):
    rng = np.random.default_rng(seed)
    img, d = canvas()
    fills = [(242, 239, 231), (226, 218, 202), (208, 196, 174), (186, 172, 148),
             ACC, PINE, OCHRE, (156, 148, 132)]

    def split(x0, y0, x1, y1, depth):
        w_, h_ = x1 - x0, y1 - y0
        if depth > 6 or (w_ < 96 * SS and h_ < 96 * SS):
            c = fills[rng.choice(len(fills), p=[0.42, 0.16, 0.11, 0.09, 0.07, 0.06, 0.05, 0.04])]
            d.rectangle([x0, y0, x1, y1], fill=c + (255,))
            if c == (242, 239, 231):
                d.rectangle([x0, y0, x1, y1], outline=INK + (60,), width=2)
            if rng.random() < 0.16:
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                rr = min(w_, h_) * 0.22
                d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=PAPER + (210,), width=3)
            return
        ar = w_ / h_
        if ar > 1.3:
            horizontal = False
        elif ar < 0.77:
            horizontal = True
        else:
            horizontal = rng.random() < 0.5
        t = 0.28 + rng.random() * 0.44
        m = 14 * SS
        if horizontal:
            y = y0 + h_ * t
            split(x0, y0, x1, y - m, depth + 1)
            split(x0, y + m, x1, y1, depth + 1)
        else:
            x = x0 + w_ * t
            split(x0, y0, x - m, y1, depth + 1)
            split(x + m, y0, x1, y1, depth + 1)

    split(28 * SS, 28 * SS, SW - 28 * SS, SH - 28 * SS, 0)
    d.rectangle([28 * SS, 28 * SS, SW - 28 * SS, SH - 28 * SS], outline=INK + (110,), width=2)
    return img


# ---------------------------------------------------------------- 07 星云
def work_nebula(seed=2026):
    rng = np.random.default_rng(seed)
    h, w = SH, SW
    acc = np.zeros((h, w), np.float32)

    for c in range(7):
        cx, cy = rng.uniform(0.2, 0.8) * w, rng.uniform(0.2, 0.8) * h
        sx, sy = rng.uniform(0.05, 0.22) * w, rng.uniform(0.05, 0.2) * h
        ang = rng.uniform(0, math.pi)
        n = 22000
        px = rng.normal(0, sx, n)
        py = rng.normal(0, sy, n)
        ca, sa = math.cos(ang), math.sin(ang)
        qx = cx + px * ca - py * sa
        qy = cy + px * sa + py * ca
        hh, _ = np.histogramdd(
            (qx, qy), bins=(h, w),
            range=((0, h), (0, w)),
            weights=rng.random(n) ** 2 * 1.6,
        )
        acc += hh.astype(np.float32)

    acc = ndimage.gaussian_filter(acc, sigma=(9, 9))
    acc /= acc.max() + 1e-9
    acc = acc ** 0.62

    # 细星点
    stars = np.zeros((h, w), np.float32)
    idx = rng.integers(0, h * w, 2600)
    stars.reshape(-1)[idx] = rng.random(2600) ** 3
    stars = ndimage.gaussian_filter(stars, sigma=1.1) * 0.9
    acc = np.clip(acc + stars, 0, 1)

    stops = np.array([0.0, 0.22, 0.45, 0.66, 0.84, 1.0])
    colors = np.array([
        [8, 8, 10], [26, 30, 44], [78, 58, 66], [176, 96, 60], [222, 168, 96], [246, 238, 220],
    ], np.float32)
    out = np.zeros((h, w, 3), np.float32)
    for i in range(3):
        out[..., i] = np.interp(acc, stops, colors[:, i])
    vig = np.clip(1.06 - 0.55 * (((np.mgrid[0:h, 0:w][1] - w / 2) / (w / 2)) ** 2 +
                                 ((np.mgrid[0:h, 0:w][0] - h / 2) / (h / 2)) ** 2), 0.35, 1)
    out *= vig[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- 08 波纹
def work_wave(seed=613):
    field = fbm((SH, SW), seed, base=2, octaves=4)
    img, d = canvas()
    rows = 150
    for i in range(rows):
        y0 = SH * (i + 0.5) / rows
        pts = []
        row = field[:, :][int(y0) % SH]
        for k in range(0, SW + 6, 5):
            xx = min(k, SW - 0.5)
            amp = 64 * SS * math.sin(math.pi * i / rows) ** 0.55
            y = y0 + (row[int(xx)] - 0.5) * amp * 2.6
            pts.append((xx, y))
        accent = i in (90, 91)
        col = ACC if accent else INK
        d.line(pts, fill=col + ((215 if accent else 118),), width=3 if accent else 2)
    return img


# ---------------------------------------------------------------- 09 圆堆积
def work_circles(seed=1440):
    rng = np.random.default_rng(seed)
    pts = []
    for _ in range(90000):
        if len(pts) >= 1050:
            break
        r = (1.6 + rng.random() ** 2.6 * 30) * SS
        x, y = rng.uniform(r, SW - r), rng.uniform(r, SH - r)
        ok = True
        for px, py, pr in pts:
            if (px - x) ** 2 + (py - y) ** 2 < (pr + r + 3 * SS) ** 2:
                ok = False
                break
        if ok:
            pts.append((x, y, r))

    img, d = canvas()
    for px, py, pr in pts:
        filled = rng.random() < 0.045
        if filled:
            d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=ACC + (150,))
        else:
            d.ellipse([px - pr, py - pr, px + pr, py + pr], outline=INK + (132,), width=3)
    return img


# ---------------------------------------------------------------- 10 分枝
def work_branch(seed=1900):
    rng = np.random.default_rng(seed)
    img, d = canvas()

    def grow(x, y, ang, length, width, depth):
        if depth > 9 or length < 5 * SS:
            d.ellipse([x - 3 * SS, y - 3 * SS, x + 3 * SS, y + 3 * SS], fill=ACC + (150,))
            return
        segs = 4
        for s in range(segs):
            t0, t1 = s / segs, (s + 1) / segs
            x1 = x + math.cos(ang) * length * t1
            y1 = y + math.sin(ang) * length * t1
            x0 = x + math.cos(ang) * length * t0
            y0 = y + math.sin(ang) * length * t0
            d.line([(x0, y0), (x1, y1)], fill=INK + (150,), width=max(2, int(width)))
        nx = x + math.cos(ang) * length
        ny = y + math.sin(ang) * length
        r = rng.random()
        branches = 3 if r < 0.18 else (2 if r < 0.9 else 1)
        for b in range(branches):
            spread = (0.3 + rng.random() * 0.55) * (1 if b % 2 else -1)
            child = ang + spread + rng.normal(0, 0.09)
            # 抑制朝下垂的枝条，让整体向上生长
            if math.sin(child) > 0.55:
                child = ang - spread * 0.6
            grow(nx, ny, child,
                 length * (0.6 + rng.random() * 0.22), width * (0.56 + rng.random() * 0.18), depth + 1)

    grow(SW / 2, SH * 0.945, -math.pi / 2 + 0.06, SH * 0.155, 15 * SS, 0)

    # 地平线与标题位
    d.line([(SW * 0.10, SH * 0.955), (SW * 0.90, SH * 0.955)], fill=INK + (60,), width=2)
    return img


# ---------------------------------------------------------------- 11 织
def work_weave(seed=355):
    rng = np.random.default_rng(seed)
    nf = fbm((SH, SW), seed, base=3, octaves=3)
    img, d = canvas()
    step_x, step_y = 5 * SS, 9 * SS
    for x in range(3 * SS, SW, step_x):
        for y in range(0, SH, step_y):
            t = nf[min(y, SH - 1), min(x, SW - 1)]
            if t < 0.18:
                continue
            ln = (1.5 + t * 13) * SS
            a = int(50 + 205 * (t - 0.18) / 0.82)
            d.line([(x, y), (x, y + ln)], fill=INK + (a,), width=2)
    # 一根朱砂经线
    d.line([(SW * 0.5, 0), (SW * 0.5, SH)], fill=ACC + (170,), width=3)
    return img


# ---------------------------------------------------------------- 12 同心
def work_rings(seed=720):
    rng = np.random.default_rng(seed)
    img, d = canvas(DARK)
    noise = fbm((360, 200), seed, base=3, octaves=4)
    cx, cy = SW * 0.5, SH * 0.46
    n = 132
    for i in range(n):
        base = (0.02 + i / n) * SH * 0.52
        pts = []
        for k in range(0, 361, 2):
            a = math.radians(k)
            ni = noise[i % 360, int(k / 1.8) % 200]
            r = base * (0.82 + 0.36 * ni) * (1 + 0.012 * math.sin(a * 6 + i))
            pts.append((cx + math.cos(a) * r * 1.05, cy + math.sin(a) * r * 0.98))
        accent = i in (int(n * 0.55), int(n * 0.56))
        col = ACC if accent else CREAM
        d.line(pts + [pts[0]], fill=col + (200 if accent else 62,), width=3 if accent else 2)
    # 中心点
    d.ellipse([cx - 4 * SS, cy - 4 * SS, cx + 4 * SS, cy + 4 * SS], fill=CREAM + (220,))
    return img


# ------------------------------------------------------- 栏目配图（4:3）
def room_rules(size=(900, 675)):
    w, h = size
    s = 5
    cols = w // s
    rows = h // s
    row = np.zeros(cols, np.uint8)
    row[cols // 2] = 1
    out = np.zeros((rows, cols), np.uint8)
    for i in range(rows):
        out[i] = row
        left = np.roll(row, 1)
        right = np.roll(row, -1)
        row = left ^ right
    ink = np.array([26, 24, 18], np.uint8)
    paper = np.array([242, 239, 231], np.uint8)
    rgb = np.where(out[..., None] == 1, ink, paper).astype(np.uint8)
    return Image.fromarray(rgb).resize(size, Image.NEAREST)


def room_perceive(size=(900, 675)):
    w, h = size
    s = 2
    WW, HH = w * s, h * s
    yy, xx = np.mgrid[0:HH, 0:WW].astype(np.float32)
    cx, cy = WW * 0.5, HH * 0.5

    # 叶形：沿纵向 u∈[-1,1]，半宽为正弦包络
    u = (yy - cy) / (HH * 0.40)
    u1 = (np.arange(HH, dtype=np.float32) - cy) / (HH * 0.40)
    half1 = np.clip(np.sin(np.pi * np.clip((u1 + 1) / 2, 0, 1)), 0, 1) ** 0.62 * WW * 0.20
    inside = (np.abs(xx - cx) < half1[:, None]) & (np.abs(u) < 0.98)

    # 明暗与叶脉
    base = 0.62 + 0.20 * np.cos((yy - cy) / HH * 5.0) - 0.10 * np.abs(xx - cx) / (WW * 0.25)
    veins = Image.new("L", (WW, HH), 0)
    dv = ImageDraw.Draw(veins)

    def vein(x0, y0, x1, y1, bend, width):
        pts = []
        for k in range(21):
            t = k / 20
            mx = x0 + (x1 - x0) * t
            my = y0 + (y1 - y0) * t
            mx += math.sin(math.pi * t) * bend
            pts.append((float(mx), float(my)))
        dv.line(pts, fill=255, width=int(width), joint="curve")

    vein(cx, cy + HH * 0.39, cx, cy - HH * 0.39, 0, 7)
    for i in range(9):
        t = i / 8.5
        y0 = cy + HH * 0.36 - t * HH * 0.72
        reach = half1[int(np.clip(y0, 1, HH - 2))] * 0.94
        for sgn in (-1, 1):
            vein(cx, y0, cx + sgn * reach * 0.92, y0 - HH * 0.10, sgn * WW * 0.02, 3)

    veins = veins.filter(ImageFilter.GaussianBlur(1.2))
    v = np.asarray(veins).astype(np.float32) / 255.0
    shade = np.clip(base - v * 0.42, 0, 1)

    rgb = np.zeros((HH, WW, 3), np.float32) + np.array(PAPER, np.float32)
    green = np.array([0.30, 0.42, 0.31], np.float32)
    tone = 0.55 + 0.55 * shade[..., None]
    rgb[inside] = (np.array([212, 214, 196], np.float32) * 0.35 +
                   green[None, :] * 255 * 0.65 * tone[inside])
    rgb[inside] = np.clip(rgb[inside], 0, 255)

    # Sobel 边缘：模拟一个 3×3 边缘检测核
    g = ndimage.gaussian_filter(shade, 1.4)
    mag = np.hypot(ndimage.sobel(g, axis=1), ndimage.sobel(g, axis=0))
    mag = np.clip(mag / (mag.max() + 1e-9) * 3.4, 0, 1) ** 0.75
    edge = (np.array(PAPER, np.float32) * (1 - mag[..., None]) +
            np.array(INK, np.float32) * mag[..., None])
    edge[~inside] = np.array(PAPER, np.float32)

    gap = 18 * s
    out = Image.new("RGB", (WW * 2 + gap, HH), PAPER)
    out.paste(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)), (0, 0))
    out.paste(Image.fromarray(edge.astype(np.uint8)), (WW + gap, 0))
    return out.resize(size, Image.LANCZOS)


def room_learn(size=(900, 675)):
    rng = np.random.default_rng(31)
    n = 130
    a = np.column_stack([rng.normal(0.32, 0.15, n), rng.normal(0.35, 0.16, n)])
    b = np.column_stack([rng.normal(0.70, 0.15, n), rng.normal(0.66, 0.16, n)])
    gx, gy = np.meshgrid(np.linspace(0, 1, 260), np.linspace(0, 1, 200))
    z = np.sin(3.1 * gx) * np.cos(2.7 * gy) * 0.42 + (gx - gy) * 1.5 + (gx - 0.5) ** 2 * 2.2
    fig = plt.figure(figsize=(size[0] / 150, size[1] / 150), dpi=150)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor(PAPER_HEX)
    ax.contourf(gx, gy, z, levels=14, cmap="Greys", alpha=0.16)
    ax.contour(gx, gy, z, levels=[0], colors=[ACC_HEX], linewidths=1.4)
    ax.scatter(a[:, 0], a[:, 1], s=9, c=INK_HEX, alpha=0.85, linewidths=0)
    ax.scatter(b[:, 0], b[:, 1], s=9, c=ACC_HEX, alpha=0.9, linewidths=0)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    fig.canvas.draw()
    arr = np.asarray(fig.canvas.buffer_rgba())[:, :, :3].copy()
    plt.close(fig)
    return Image.fromarray(arr).resize(size, Image.LANCZOS)


def room_studio(size=(900, 675)):
    w, h = size
    s = 3
    WW, HH = w * s, h * s
    img = Image.new("RGB", (WW, HH), PAPER)
    d = ImageDraw.Draw(img, "RGBA")
    rng = np.random.default_rng(9)
    for i in range(26):
        x = rng.uniform(0, WW)
        d.line([(x, 0), (x + rng.normal(0, 30), HH)], fill=INK + (18,), width=3)
    for y in range(0, HH, 9 * s):
        d.line([(0, y), (WW, y)], fill=INK + (14,), width=2)
    d.ellipse([WW * 0.30, HH * 0.16, WW * 0.72, HH * 0.58], fill=ACC + (210,))
    d.rectangle([WW * 0.10, HH * 0.62, WW * 0.90, HH * 0.63], fill=INK + (90,))
    f1 = font(F_SERIF, int(HH * 0.16))
    f2 = font(F_MONO, int(HH * 0.032))
    d.text((WW * 0.10, HH * 0.64), "生长", font=f1, fill=INK)
    d.text((WW * 0.11, HH * 0.86), "GROWTH / POSTER  No.09", font=f2, fill=INK + (170,))
    return img.resize(size, Image.LANCZOS)


def room_about(size=(900, 675)):
    w, h = size
    s = 3
    WW, HH = w * s, h * s
    img = Image.new("RGB", (WW, HH), PAPER)
    d = ImageDraw.Draw(img, "RGBA")
    f = font(F_SANS, int(HH * 0.040))
    f2 = font(F_MONO, int(HH * 0.024))

    bw, bh = WW * 0.20, HH * 0.105
    top = HH * 0.10
    boxes = {
        "首页": (WW * 0.5 - bw / 2, top),
        "规则": (WW * 0.10, top + HH * 0.26),
        "观看": (WW * 0.40, top + HH * 0.26),
        "学习": (WW * 0.70, top + HH * 0.26),
        "画廊": (WW * 0.10, top + HH * 0.52),
        "工作室": (WW * 0.40, top + HH * 0.52),
        "关于": (WW * 0.70, top + HH * 0.52),
    }

    def center(name):
        x, y = boxes[name]
        return x + bw / 2, y + bh / 2

    line = INK + (170,)
    # 主干
    x0, y0 = center("首页")
    bus_y = top + bh + HH * 0.09
    d.line([(x0, boxes["首页"][1] + bh), (x0, bus_y)], fill=line, width=2)
    xs = [center(n)[0] for n in ("规则", "观看", "学习")]
    d.line([(min(xs), bus_y), (max(xs), bus_y)], fill=line, width=2)
    for n in ("规则", "观看", "学习"):
        cx_, _ = center(n)
        d.line([(cx_, bus_y), (cx_, boxes[n][1])], fill=line, width=2)
    # 第二层
    for n in ("画廊", "工作室", "关于"):
        cx_, cy_ = center(n)
        d.line([(cx_, boxes[n][1] - HH * 0.0), (cx_, boxes[n][1])], fill=line, width=2)

    for name, (x, y) in boxes.items():
        d.rectangle([x, y, x + bw, y + bh], fill=PAPER + (255,), outline=INK + (185,), width=3)
        d.text((x + 16 * s, y + bh * 0.30), name, font=f, fill=INK + (225,))
        if name == "首页":
            d.rectangle([x, y, x + 6 * s, y + bh], fill=ACC + (255,))
    d.rectangle([x0 - 3 * s, boxes["首页"][1] + bh * 0.0, x0 + 3 * s, boxes["首页"][1] + bh],
                fill=ACC + (0,))

    d.line([(WW * 0.10, HH * 0.90), (WW * 0.90, HH * 0.90)], fill=ACC + (170,), width=2)
    d.text((WW * 0.10, HH * 0.925), "SITE MAP / 7 PAGES / ALL LINKS RELATIVE", font=f2, fill=INK + (150,))
    return img.resize(size, Image.LANCZOS)


# ------------------------------------------------------------------ 分享图
def share_card():
    w, h = 1200, 630
    s = 2
    WW, HH = w * s, h * s
    img = Image.new("RGB", (WW, HH), PAPER)
    d = ImageDraw.Draw(img, "RGBA")
    f1 = font(F_SERIF, int(HH * 0.26))
    f2 = font(F_MONO, int(HH * 0.026))
    f3 = font(F_SANS, int(HH * 0.042))
    d.text((WW * 0.07, HH * 0.22), "生长", font=f1, fill=INK)
    d.text((WW * 0.075, HH * 0.60), "让规则长出形状", font=f3, fill=INK + (200,))
    d.text((WW * 0.075, HH * 0.79), "GROWTH LAB / INTERACTIVE ESSAY / 2026", font=f2, fill=INK + (140,))
    d.rectangle([WW * 0.07, HH * 0.735, WW * 0.21, HH * 0.742], fill=ACC)
    # 右侧一枝
    rng = np.random.default_rng(4)
    for i in range(160):
        x = WW * 0.72 + rng.normal(0, 70)
        y = HH * 0.95
        ang = -math.pi / 2 + rng.normal(0, 0.28)
        pts = []
        for k in range(70):
            x += math.cos(ang) * 4
            y += math.sin(ang) * 4
            ang += rng.normal(0, 0.05)
            pts.append((x, y))
        d.line(pts, fill=INK + (26,), width=2)
    d.ellipse([WW * 0.70, HH * 0.12, WW * 0.83, HH * 0.25], fill=ACC + (200,))
    return img.resize((w, h), Image.LANCZOS)


# ------------------------------------------------------------ 像素矩阵图
def figure_pixels():
    cols, rows = 12, 7
    cw, chh = 64, 44
    x0, y0 = 42, 96
    vw = x0 * 2 + cols * cw
    vh = y0 + rows * chh + 74

    field = fbm((rows, cols), 7, base=2, octaves=3)
    rng = np.random.default_rng(3)
    vals = np.clip(field * 210 + 26 + rng.normal(0, 16, (rows, cols)), 0, 255).astype(int)

    p = []
    p.append('<?xml version="1.0" encoding="UTF-8"?>')
    p.append('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
             'role="img" aria-label="一张图片被表示成一个十二乘七的数字矩阵">' % (vw, vh, vw, vh))
    p.append('<rect width="%d" height="%d" fill="#f2efe7"/>' % (vw, vh))
    p.append('<g font-family="Consolas, Courier New, monospace">')
    p.append('<text x="%d" y="52" font-size="12" letter-spacing="3" fill="#c04227">A PICTURE IS A MATRIX</text>' % x0)
    p.append('<text x="%d" y="80" font-size="15" fill="#6b6659">同一张图，换一种写法：每一格是一个 0–255 的整数</text>' % x0)

    for r in range(rows):
        for c in range(cols):
            v = int(vals[r, c])
            x, y = x0 + c * cw, y0 + r * chh
            p.append('<rect x="%d" y="%d" width="%d" height="%d" fill="rgb(%d,%d,%d)"/>' % (x, y, cw, chh, v, v, v))
            tc = "#f2efe7" if v < 128 else "#17150f"
            p.append('<text x="%d" y="%d" font-size="13" text-anchor="middle" fill="%s">%d</text>'
                     % (x + cw / 2, y + chh / 2 + 5, tc, v))

    r0, c0 = 3, 5
    x, y = x0 + c0 * cw, y0 + r0 * chh
    p.append('<rect x="%d" y="%d" width="%d" height="%d" fill="none" stroke="#c04227" stroke-width="2"/>'
             % (x - 1, y - 1, cw + 2, chh + 2))
    p.append('<path d="M %d %d L %d %d" stroke="#c04227" stroke-width="1"/>'
             % (x + cw + 2, y + chh / 2, x + cw + 40, y + chh / 2))
    p.append('<text x="%d" y="%d" font-size="13" fill="#c04227">%d</text>'
             % (x + cw + 48, y + chh / 2 - 6, int(vals[r0, c0])))
    p.append('<text x="%d" y="%d" font-size="11" fill="#6b6659">一个像素的一个通道</text>'
             % (x + cw + 48, y + chh / 2 + 13))

    p.append('<text x="%d" y="%d" font-size="12" fill="#6b6659">'
             '彩色图有三层这样的矩阵（R / G / B）；卷积网络的全部工作，都发生在这些数字上。</text>' % (x0, vh - 28))
    p.append('</g></svg>')

    path = os.path.join(OUT, "figure-pixels.svg")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(p))
    print("  ->", os.path.relpath(path, ROOT), os.path.getsize(path) // 1024, "KB")


# ------------------------------------------------------------------ 主流程
WORKS = [
    ("01-wind", "风场", "Flow Field", "流场线", 1207, work_flow,
     "一万五千个粒子在同一张角度场里漂流，每条线都只回答一个问题：下一步往哪走。"),
    ("02-contour", "等高线", "Contour", "噪声等高线", 3301, work_contour,
     "把一张平滑的噪声当成地形来切，每一条线都是同一座虚构山峰的不同高度。"),
    ("03-territory", "领地", "Territory", "泰森多边形", 881, work_voronoi,
     "每个点占有离它最近的那片土地。秩序不是被画出来的，是被分配出来的。"),
    ("04-density", "浓度", "Density", "半调网点", 451, work_halftone,
     "只有黑点，没有灰。点的直径决定明暗——这是印刷机教会计算机的第一件事。"),
    ("05-interference", "干涉", "Interference", "摩尔纹", 1902, work_moire,
     "两组几乎平行的线叠在一起，就长出了第三组谁也没画的线。"),
    ("06-wall", "墙", "Wall", "递归细分", 77, work_subdiv,
     "一条线把矩形切成两半，两半再各自被切开。七次之后，它变成了一堵墙。"),
    ("07-dust", "尘埃", "Dust", "粒子云", 2026, work_nebula,
     "七团被压扁的高斯分布，几万次随机落点，然后交给一张模糊的调色表。"),
    ("08-strata", "地层", "Strata", "波形位移", 613, work_wave,
     "一百六十八条水平线，各自被同一片噪声推了一下。剖面就此变成了地貌。"),
    ("09-bubbles", "气泡", "Bubbles", "圆堆积", 1440, work_circles,
     "随机扔下一千个圆，扔不进去就重来。剩下的那些，看起来像是有意安排的。"),
    ("10-branch", "枝", "Branch", "递归分枝", 1900, work_branch,
     "每一次分叉都把角度随机地偏一点，把宽度乘以 0.66。九层之后它就活了。"),
    ("11-weave", "经纬", "Weave", "短线织纹", 355, work_weave,
     "把两万个极短的线段按噪声的密度撒下去，远看是一块布，近看全是噪点。"),
    ("12-rings", "年轮", "Growth Ring", "同心扰动", 720, work_rings,
     "一百三十二个同心圆，每个圆的半径都被同一片噪声轻轻推歪——像年轮，也像等高线。"),
]


def main():
    import sys
    only = set(sys.argv[1:])
    print("生成作品 …")
    meta = []
    for slug, title, en, algo, seed, fn, desc in WORKS:
        if only and slug not in only:
            if os.path.exists(os.path.join(WORK, slug + ".webp")):
                meta.append({"slug": slug, "title": title, "en": en, "algo": algo,
                             "seed": seed, "desc": desc,
                             "src": "assets/img/work/%s.webp" % slug})
                continue
        print(" ", title)
        img = fn(seed)
        save(img, os.path.join(WORK, slug + ".webp"))
        meta.append({"slug": slug, "title": title, "en": en, "algo": algo,
                     "seed": seed, "desc": desc,
                     "src": "assets/img/work/%s.webp" % slug})

    with open(os.path.join(OUT, "works.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    if not only:
        print("生成栏目图 …")
        save_at(room_rules(), os.path.join(OUT, "room-rules.webp"), (900, 675))
        save_at(room_perceive(), os.path.join(OUT, "room-perceive.webp"), (900, 675))
        save_at(room_learn(), os.path.join(OUT, "room-learn.webp"), (900, 675))
        save_at(work_branch(1900).crop((0, 120, SW, SH - 420)), os.path.join(OUT, "room-gallery.webp"), (900, 675))
        save_at(room_studio(), os.path.join(OUT, "room-studio.webp"), (900, 675))
        save_at(room_about(), os.path.join(OUT, "room-about.webp"), (900, 675))
        save_at(share_card(), os.path.join(OUT, "share.webp"), (1200, 630))

    # 约览图：把十二幅作品拼成一张
    thumbs = [Image.open(os.path.join(WORK, m["slug"] + ".webp")).resize((300, 375), Image.LANCZOS)
              for m in meta]
    sheet = Image.new("RGB", (300 * 4 + 5 * 12, 375 * 3 + 4 * 12), (30, 30, 28))
    for i, t in enumerate(thumbs):
        sheet.paste(t, ((i % 4) * 312 + 12, (i // 4) * 387 + 12))
    sheet.save(os.path.join(OUT, "_contact.png"))
    print("完成")


if __name__ == "__main__":
    main()
