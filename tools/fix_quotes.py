# -*- coding: utf-8 -*-
"""
把 HTML 文本节点里的直角引号 "..." 换成中文引号 “...”。
只处理标签之外的文本，不动属性值。
"""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def fix_text(text):
    out = []
    opening = True
    for ch in text:
        if ch == '"':
            out.append("\u201c" if opening else "\u201d")
            opening = not opening
        else:
            out.append(ch)
    return "".join(out), opening


def main():
    total = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()

        changed = [0]

        def repl(m):
            body = m.group(1)
            if '"' not in body:
                return m.group(0)
            if body.count('"') % 2 != 0:
                print("  跳过不配对:", os.path.basename(path), repr(body[:40]))
                return m.group(0)
            fixed, _ = fix_text(body)
            changed[0] += body.count('"') // 2
            return ">" + fixed + "<"

        out = re.sub(r">([^<>]+)<", repl, src)
        if changed[0]:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(out)
            total += changed[0]
            print("  %-14s 替换 %d 处" % (os.path.basename(path), changed[0]))

    print("合计 %d 处引号" % total)


if __name__ == "__main__":
    main()
