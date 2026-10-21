"""从 Make Me a Hanzi 的 graphics.txt 中抽出 data/charset.txt 里各字的笔画中心线。

用法：python3 tools/extract.py [graphics.txt 路径]
不给路径时自动下载到 build/graphics.txt（约 30MB，不入库）。
"""
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt"


def main():
    if len(sys.argv) > 1:
        src = pathlib.Path(sys.argv[1])
    else:
        src = ROOT / "build" / "graphics.txt"
        if not src.exists():
            src.parent.mkdir(exist_ok=True)
            print(f"下载 {URL} …")
            urllib.request.urlretrieve(URL, src)

    chars = [c for c in (ROOT / "data" / "charset.txt").read_text(encoding="utf-8") if not c.isspace()]
    wanted = dict.fromkeys(chars)
    found = {}
    with open(src, encoding="utf-8") as f:
        for line in f:
            item = json.loads(line)
            if item["character"] in wanted:
                found[item["character"]] = item["medians"]

    missing = [c for c in chars if c not in found]
    if missing:
        print("骨架数据中缺少：", "".join(missing))

    out = {c: found[c] for c in chars if c in found}
    path = ROOT / "data" / "medians.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"已写入 {path.relative_to(ROOT)}：{len(out)} 字")


if __name__ == "__main__":
    main()
