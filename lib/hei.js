// 黑体笔画生成器：把每一笔的中心线（骨架）加粗成多边形。
// 浏览器预览和 Node 构建脚本共用这一份代码，保证预览和字体文件一致。
//
// 坐标系与骨架数据一致：1024 单位见方，y 轴向上，基线以下到 -124，顶部到 900。
// 输出的每个多边形都是逆时针方向，按非零规则填充即可正确叠合；
// 生成字体时再由 tools/build_font.py 合并成干净的轮廓。

export const DEFAULT_PARAMS = {
  weight: 72,        // 竖画宽度（字体单位）
  contrast: 0.82,    // 横画宽度 / 竖画宽度，黑体通常略小于 1
  extend: 8,         // 起笔、收笔沿笔画方向外延的长度
  scale: 0.96,       // 字面缩放（以字身中心为准）
  straighten: 14,    // 横平竖直：偏离水平或竖直小于该度数的笔段会被拉正
  smoothAngle: 50,   // 折角小于该度数视为弧线并做平滑，大于则保留硬折角
  smoothPasses: 2,   // 平滑迭代次数
  taper: 0.35,       // 撇尾收细比例，0 为不收细
  taperLength: 0.4,  // 收细段占整笔长度的比例
  miterLimit: 2.2,   // 折角尖端最长为半个笔宽的多少倍，超过则切平
  roundCap: false,   // true 时笔端与转折全部做圆（接近圆体）
};

const CENTER = [512, 388];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const left = (d) => [-d[1], d[0]];

function signedArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

const ccw = (poly) => (signedArea(poly) < 0 ? poly.slice().reverse() : poly);

// 相邻两段的转折角（度）
function turnAngle(a, b, c) {
  const d1 = norm(sub(b, a)), d2 = norm(sub(c, b));
  const dot = Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1]));
  return (Math.acos(dot) * 180) / Math.PI;
}

// 去掉重合点
function dedupe(pts) {
  const out = [pts[0]];
  for (const p of pts.slice(1)) if (len(sub(p, out[out.length - 1])) > 0.5) out.push(p);
  return out;
}

// 保留硬折角的 Chaikin 平滑：只对小于阈值的转折做切角
function smooth(pts, angle, passes) {
  for (let k = 0; k < passes; k++) {
    if (pts.length < 3) return pts;
    const soft = pts.map((p, i) => i > 0 && i < pts.length - 1 && turnAngle(pts[i - 1], p, pts[i + 1]) < angle);
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (soft[i]) out.push(add(mul(a, 0.75), mul(b, 0.25)));
      if (soft[i + 1]) out.push(add(mul(a, 0.25), mul(b, 0.75)));
      else out.push(b);
    }
    pts = out;
  }
  return pts;
}

// 横平竖直：骨架来自楷体，横画普遍上扬、竖画微斜，黑体需要拉正
function straighten(pts, maxDeg) {
  if (maxDeg <= 0) return pts;
  pts = pts.map((p) => p.slice());
  const tol = Math.tan((maxDeg * Math.PI) / 180);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (Math.abs(dy) <= Math.abs(dx) * tol) {
      // 横：笔段两端取同一高度；首段以收笔为准，其余以前一点为准，避免牵动已拉正的转折
      const y = i === 0 ? (a[1] + b[1]) / 2 : a[1];
      a[1] = y; b[1] = y;
    } else if (Math.abs(dx) <= Math.abs(dy) * tol) {
      const x = i === 0 ? (a[0] + b[0]) / 2 : a[0];
      a[0] = x; b[0] = x;
    }
  }
  return pts;
}

function circle(c, r, n = 20) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]);
  }
  return out;
}

// 两条直线（点 + 方向）的交点
function intersect(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}

// 判断是否为撇：整体走向朝左下
function isPie(pts) {
  const d = sub(pts[pts.length - 1], pts[0]);
  return d[0] < 0 && d[1] < 0 && -d[0] > len(d) * 0.3;
}

// 单个笔画：中心线 → 若干逆时针多边形
export function strokePolygons(median, params = DEFAULT_PARAMS) {
  const p = { ...DEFAULT_PARAMS, ...params };
  let pts = median.map(([x, y]) => [
    CENTER[0] + (x - CENTER[0]) * p.scale,
    CENTER[1] + (y - CENTER[1]) * p.scale,
  ]);
  pts = dedupe(pts);
  if (pts.length < 2) return [];
  pts = dedupe(straighten(pts, p.straighten));
  if (pts.length < 2) return [];
  pts = dedupe(smooth(pts, p.smoothAngle, p.smoothPasses));

  // 端点外延
  const n = pts.length;
  pts[0] = add(pts[0], mul(norm(sub(pts[0], pts[1])), p.extend));
  pts[n - 1] = add(pts[n - 1], mul(norm(sub(pts[n - 1], pts[n - 2])), p.extend));

  // 每段宽度随方向变化：竖画为 weight，横画为 weight * contrast
  const segW = [];
  for (let i = 0; i < n - 1; i++) {
    const d = norm(sub(pts[i + 1], pts[i]));
    segW.push(p.weight * (p.contrast + (1 - p.contrast) * Math.abs(d[1])));
  }
  // 顶点宽度取相邻段平均，端点取所在段
  const w = pts.map((_, i) => (i === 0 ? segW[0] : i === n - 1 ? segW[n - 2] : (segW[i - 1] + segW[i]) / 2));

  // 撇尾收细：按弧长比例线性缩小
  if (p.taper > 0 && isPie(pts)) {
    const acc = [0];
    for (let i = 1; i < n; i++) acc.push(acc[i - 1] + len(sub(pts[i], pts[i - 1])));
    const total = acc[n - 1], start = total * (1 - p.taperLength);
    for (let i = 0; i < n; i++) {
      if (acc[i] > start) w[i] *= 1 - p.taper * ((acc[i] - start) / (total - start || 1));
    }
  }

  const polys = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const nl = left(norm(sub(b, a)));
    polys.push(ccw([
      add(a, mul(nl, w[i] / 2)), sub(a, mul(nl, w[i] / 2)),
      sub(b, mul(nl, w[i + 1] / 2)), add(b, mul(nl, w[i + 1] / 2)),
    ]));
  }

  if (p.roundCap) {
    pts.forEach((pt, i) => polys.push(circle(pt, w[i] / 2)));
    return polys;
  }

  // 转折处补外侧尖角（斜接），过尖则切平
  for (let i = 1; i < n - 1; i++) {
    const v = pts[i];
    const d1 = norm(sub(v, pts[i - 1])), d2 = norm(sub(pts[i + 1], v));
    const c = cross(d1, d2);
    if (Math.abs(c) < 1e-6) continue;
    const side = c > 0 ? -1 : 1; // 左转时外侧在右边
    const h = w[i] / 2;
    const p1 = add(v, mul(left(d1), side * h));
    const p2 = add(v, mul(left(d2), side * h));
    const m = intersect(p1, d1, p2, d2);
    if (m && len(sub(m, v)) <= p.miterLimit * h) polys.push(ccw([v, p1, m, p2]));
    else polys.push(ccw([v, p1, p2]));
  }
  return polys;
}

// 整个字：所有笔画的多边形
export function glyphPolygons(medians, params) {
  return medians.flatMap((m) => strokePolygons(m, params));
}

// 转成 SVG 路径（y 轴需由外层 transform 翻转）
export function toPath(polys) {
  return polys
    .map((poly) => 'M' + poly.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z')
    .join('');
}
