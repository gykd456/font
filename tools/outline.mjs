// 用 params.json 的参数把 data/medians.json 生成为多边形，写到 build/outlines.json，
// 再交给 tools/build_font.py 合并轮廓、导出字体。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { glyphPolygons } from '../lib/hei.js';

const root = new URL('../', import.meta.url);
const medians = JSON.parse(readFileSync(new URL('data/medians.json', root), 'utf8'));
const params = JSON.parse(readFileSync(new URL('params.json', root), 'utf8'));

const out = {};
for (const [ch, strokes] of Object.entries(medians)) {
  out[ch] = glyphPolygons(strokes, params).map((poly) => poly.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]));
}

mkdirSync(new URL('build/', root), { recursive: true });
writeFileSync(new URL('build/outlines.json', root), JSON.stringify(out));
console.log(`已生成 ${Object.keys(out).length} 个字形的笔画多边形`);
