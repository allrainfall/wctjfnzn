# -*- coding: utf-8 -*-
"""
把思源宋体（Noto Serif SC 可变字体）按站点实际用到的字符做子集化，
输出为自托管的 woff，保证在任何设备上标题都是同一副模样。
"""
import glob
import os
import sys

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = r"C:\Windows\Fonts\NotoSerifSC-VF.ttf"
OUT = os.path.join(ROOT, "assets", "fonts", "growth-serif.woff")

# 常用的备用字符：即使以后改了文案，也不至于立刻掉字体
EXTRA = (
    "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动"
    "同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自"
    "二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日"
    "那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变"
    "条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总"
    "次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指"
    "几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器"
    "压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安"
    "场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集"
    "温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连"
    "断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精"
    "值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属"
    "圆包火住调满县局照参红细引听该铁价严首底液官德随病苏失尔死讲配女黄推显谈罪神艺呢"
    "席含企望密批营项防举球英氧势告李台落木帮轮破亚师围注远字材排供河态封另施减树溶怎"
    "止案言士均武固叶鱼波视仅费紧爱左章早朝害续轻服试食充兵源判护司足某练差致板田降黑"
    "犯负击范继兴似余坚曲输修故城夫够送笔船占右财吃富春职觉汉画功巴跟虽杂飞检吸助升阳"
    "互初创抗考投坏策古径换未跑留钢曾端责站简述钱副尽帝射草冲承独令限阿宣环双请超微让"
    "控州良轴找否纪益依优顶础载倒房突坐粉敌略客袁冷胜绝析块剂测丝协诉念陈仍罗盐友洋错"
    "苦夜刑移频逐靠混母短皮终聚汽村云哪既距卫停烈央察烧迅境若印洲刻括激孔搞甚室待核校"
    "散侵吧甲游久菜味旧模湖货损预阻毫普稳乙妈植息扩银语挥酒守拿序纸夜习希剂纯胞烈织"
    "，。、；：？！""''（）《》〈〉【】—…·×÷≈≠≤≥±°→←↑↓／＄％＆＊＋－＝"
)

# 站点自造/易缺的符号
SYMBOLS = "→←↑↓·×÷≈≤≥—…「」『』〔〕"


def collect_text():
    chars = set()
    for pattern in ("*.html", os.path.join("assets", "js", "*.js")):
        for path in glob.glob(os.path.join(ROOT, pattern)):
            with open(path, "r", encoding="utf-8") as f:
                for ch in f.read():
                    if ord(ch) > 127 or ch.isalnum() or ch in " .,:;!?-()[ ]":
                        chars.add(ch)
    chars.update(" 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
                 ".,:;!?'\"()[]{}<>/\\|-–—_+=*&%$#@~^`")
    chars.update(EXTRA)
    chars.update(SYMBOLS)
    chars.discard("\n")
    chars.discard("\t")
    return "".join(sorted(chars))


def main():
    if not os.path.exists(SRC):
        print("找不到源字体：", SRC)
        sys.exit(1)

    text = collect_text()
    print("字符数：", len(text))

    options = subset.Options()
    options.flavor = "woff"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables += ["DSIG"]
    options.desubroutinize = False

    font = subset.load_font(SRC, options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    subset.save_font(font, OUT, options)
    print("输出：", os.path.relpath(OUT, ROOT), round(os.path.getsize(OUT) / 1024), "KB")


if __name__ == "__main__":
    main()
