# 初黑 ChuHei

用程序生成的中文黑体。思路是**骨架 + 笔形**：每个汉字的笔画中心线（骨架）来自开源数据，笔画怎么加粗、端点什么形状、横竖粗细比多少，都由一组参数决定。调一个参数，所有字一起变，风格自然统一。

> 当前阶段：约 100 个样字，用来确定风格。字体名「初黑」是暂定名，可以在 `font.json` 里改。

## 快速开始

```bash
pip install fonttools shapely brotli   # 只需一次
npm run preview                        # 启动本地服务（端口 8080）
```

浏览器打开 <http://localhost:8080/preview/>：

- 左侧拖动参数，右侧所有样字实时变化；点任意字可以放大看。
- 勾选「显示骨架中心线」可以看到原始骨架。
- 满意后点「复制参数」，粘贴覆盖 `params.json`。

导出字体：

```bash
npm run build      # 生成 dist/ChuHei-Regular.otf 和 .woff2
```

`.otf` 可以直接双击安装到电脑；`.woff2` 用于网页 `@font-face`。

## 扩充字符

在 `data/charset.txt` 里加字，然后：

```bash
npm run extract    # 首次运行会下载约 30MB 的骨架数据到 build/（不入库）
npm run build
```

骨架数据约有 9000 个汉字，覆盖《通用规范汉字表》一级字（3500 字）和 GB2312 常用字。

## 目录

| 路径 | 作用 |
| --- | --- |
| `lib/hei.js` | 核心：骨架 → 黑体笔画多边形。预览页和构建共用，保证所见即所得 |
| `params.json` | 当前风格参数 |
| `font.json` | 字体名称、版本 |
| `data/charset.txt` | 要生成的字 |
| `data/medians.json` | 这些字的骨架（由 `tools/extract.py` 生成） |
| `tools/outline.mjs` | 按参数生成全部笔画多边形 |
| `tools/build_font.py` | 合并重叠轮廓，导出 OTF / WOFF2 |
| `preview/index.html` | 调参预览页 |
| `dist/` | 导出的字体文件 |

## 参数说明

| 参数 | 含义 |
| --- | --- |
| `weight` | 竖画宽度（字身 1024 单位） |
| `contrast` | 横画 / 竖画粗细比，黑体通常略小于 1 |
| `scale` | 字面大小 |
| `extend` | 起笔收笔外延 |
| `straighten` | 横平竖直：骨架源自楷体，横画上扬，用它拉正 |
| `smoothAngle` / `smoothPasses` | 弧线平滑；大于阈值的转折保留硬角 |
| `taper` / `taperLength` | 撇尾收细 |
| `miterLimit` | 转折外角尖度 |
| `roundCap` | 圆头圆角，打开后接近圆体 |

## 已知局限与下一步

- 骨架来自楷体，部分字（心、女、我等）结构仍带楷书味道；需要逐字修正骨架，或加更多规则（如点画、钩画的专门处理）。
- 暂时只有汉字和空格，没有标点、数字、拉丁字母。
- 没有字距、hinting 等精修。

## 许可证

笔画骨架来自 [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) 的 `graphics.txt`，它源自文鼎 AR PL KaitiM GB 和 AR PL UKai 字体，以 **Arphic Public License** 发布。本项目生成的字体属于衍生作品，同样以 Arphic Public License 发布（见 `LICENSES/ARPHICPL.TXT`）：可以免费使用、修改和再发布；衍生字体必须以同一许可证公开发布，不能闭源或附加更严的限制（类似 GPL）。
