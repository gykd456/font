"""把 build/outlines.json 合并成干净轮廓，导出 dist/ 下的 .otf 和 .woff2。

用法：python3 tools/build_font.py
依赖：pip install fonttools shapely brotli
"""
import json
import pathlib

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont
from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parent.parent
UPM = 1024
ASCENT, DESCENT = 900, -124
NAME = json.loads((ROOT / "font.json").read_text(encoding="utf-8"))


def merged(polys):
    """各笔画多边形求并集，去掉重叠，外轮廓逆时针、内孔顺时针（CFF 约定）。"""
    shapes = [Polygon(p).buffer(0) for p in polys if len(p) >= 3]
    geom = unary_union([s for s in shapes if not s.is_empty]).simplify(0.4)
    parts = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    return [orient(g, sign=1.0) for g in parts if isinstance(g, Polygon) and not g.is_empty]


def draw(pen, parts):
    for poly in parts:
        for ring in [poly.exterior, *poly.interiors]:
            pts = [(round(x), round(y)) for x, y in ring.coords[:-1]]
            pts = [p for i, p in enumerate(pts) if p != pts[i - 1]]
            if len(pts) < 3:
                continue
            pen.moveTo(pts[0])
            for p in pts[1:]:
                pen.lineTo(p)
            pen.closePath()


def main():
    outlines = json.loads((ROOT / "build" / "outlines.json").read_text(encoding="utf-8"))

    order = [".notdef", "space"]
    cmap = {0x20: "space", 0x3000: "space"}
    charstrings = {}
    metrics = {}

    # 缺字时显示的空心方框：外框逆时针，内框顺时针
    pen = T2CharStringPen(UPM, None)
    for ring in [[(100, -24), (924, -24), (924, 800), (100, 800)],
                 [(160, 36), (160, 740), (864, 740), (864, 36)]]:
        pen.moveTo(ring[0])
        for p in ring[1:]:
            pen.lineTo(p)
        pen.closePath()
    charstrings[".notdef"] = pen.getCharString()
    metrics[".notdef"] = (UPM, 100)
    charstrings["space"] = T2CharStringPen(UPM // 2, None).getCharString()
    metrics["space"] = (UPM // 2, 0)

    for ch, polys in outlines.items():
        name = f"uni{ord(ch):04X}"
        parts = merged(polys)
        pen = T2CharStringPen(UPM, None)
        draw(pen, parts)
        charstrings[name] = pen.getCharString()
        xmin = min((int(p.bounds[0]) for p in parts), default=0)
        metrics[name] = (UPM, xmin)
        order.append(name)
        cmap[ord(ch)] = name

    fb = FontBuilder(UPM, isTTF=False)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupCFF(NAME["psName"], {"FullName": NAME["en"]}, charstrings, {})
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    fb.setupNameTable({
        "familyName": NAME["en"],
        "styleName": "Regular",
        "uniqueFontIdentifier": f"{NAME['psName']}-{NAME['version']}",
        "fullName": NAME["en"],
        "psName": NAME["psName"],
        "version": f"Version {NAME['version']}",
        "licenseDescription": "Arphic Public License. 笔画骨架来自 Make Me a Hanzi（源自文鼎 AR PL 字体）。",
        "licenseInfoURL": "http://ftp.gnu.org/non-gnu/chinese-fonts-truetype/LICENSE",
    })
    # 中文名称（Windows 平台，简体中文 0x0804），系统字体菜单里会显示这个名字
    for name_id in (1, 4):
        fb.font["name"].setName(NAME["zh"], name_id, 3, 1, 0x0804)
    fb.setupOS2(
        sTypoAscender=ASCENT, sTypoDescender=DESCENT, sTypoLineGap=0,
        usWinAscent=ASCENT, usWinDescent=-DESCENT,
        ulCodePageRange1=1 << 18,  # GB2312 简体中文
        achVendID="NONE",
    )
    fb.setupPost()

    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    otf = dist / f"{NAME['psName']}.otf"
    fb.save(otf)
    font = TTFont(otf)
    font.flavor = "woff2"
    font.save(dist / f"{NAME['psName']}.woff2")
    print(f"已导出 {otf.relative_to(ROOT)} 与 .woff2：{len(outlines)} 个汉字")


if __name__ == "__main__":
    main()
