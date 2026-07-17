export interface Pt { x: number; y: number; }
export interface Template { name: string; points: Pt[]; }

const NUM_POINTS = 64;
const SQUARE_SIZE = 250;
const HALF_DIAGONAL = 0.5 * Math.sqrt(2) * SQUARE_SIZE;
const ANGLE_RANGE = (45 * Math.PI) / 180;
const ANGLE_PRECISION = (2 * Math.PI) / 180;
const PHI = 0.5 * (-1 + Math.sqrt(5));

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(points: Pt[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += dist(points[i - 1], points[i]);
  return d;
}

export function centroid(points: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}

function resample(points: Pt[], n = NUM_POINTS): Pt[] {
  const interval = pathLength(points) / (n - 1) || 1e-6;
  let d = 0;
  const pts = points.slice();
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const dd = dist(pts[i - 1], pts[i]);
    if (d + dd >= interval) {
      const t = (interval - d) / dd;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y) };
      out.push(q);
      pts.splice(i, 0, q);
      d = 0;
    } else {
      d += dd;
    }
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}

function indicativeAngle(points: Pt[]): number {
  const c = centroid(points);
  return Math.atan2(c.y - points[0].y, c.x - points[0].x);
}

function rotateBy(points: Pt[], angle: number): Pt[] {
  const c = centroid(points);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return points.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function scaleToSquare(points: Pt[], size = SQUARE_SIZE): Pt[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX || 1e-6, h = maxY - minY || 1e-6;
  return points.map((p) => ({ x: ((p.x - minX) * size) / w, y: ((p.y - minY) * size) / h }));
}

function translateToOrigin(points: Pt[]): Pt[] {
  const c = centroid(points);
  return points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}

function pathDistance(a: Pt[], b: Pt[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += dist(a[i], b[i]);
  return d / a.length;
}

function distanceAtAngle(points: Pt[], template: Pt[], angle: number): number {
  return pathDistance(rotateBy(points, angle), template);
}

function distanceAtBestAngle(points: Pt[], template: Pt[]): number {
  let a = -ANGLE_RANGE, b = ANGLE_RANGE;
  let x1 = PHI * a + (1 - PHI) * b, f1 = distanceAtAngle(points, template, x1);
  let x2 = (1 - PHI) * a + PHI * b, f2 = distanceAtAngle(points, template, x2);
  while (Math.abs(b - a) > ANGLE_PRECISION) {
    if (f1 < f2) {
      b = x2; x2 = x1; f2 = f1;
      x1 = PHI * a + (1 - PHI) * b; f1 = distanceAtAngle(points, template, x1);
    } else {
      a = x1; x1 = x2; f1 = f2;
      x2 = (1 - PHI) * a + PHI * b; f2 = distanceAtAngle(points, template, x2);
    }
  }
  return Math.min(f1, f2);
}

function normalize(raw: Pt[]): Pt[] {
  const resampled = resample(raw);
  const rotated = rotateBy(resampled, -indicativeAngle(resampled));
  return translateToOrigin(scaleToSquare(rotated));
}

export class DollarRecognizer {
  private templates: Template[] = [];

  addTemplate(name: string, raw: Pt[]) {
    this.templates = this.templates.filter((t) => t.name !== name);
    this.templates.push({ name, points: normalize(raw) });
  }

  hasTemplate(name: string): boolean {
    return this.templates.some((t) => t.name === name);
  }

  serialize(): string {
    return JSON.stringify(this.templates);
  }

  restore(json: string) {
    try { this.templates = JSON.parse(json); } catch { this.templates = []; }
  }

  recognize(raw: Pt[]): { name: string; score: number } | null {
    if (raw.length < 10 || this.templates.length === 0) return null;
    const candidate = normalize(raw);
    let best: { name: string; d: number } | null = null;
    for (const t of this.templates) {
      const d = distanceAtBestAngle(candidate, t.points);
      if (!best || d < best.d) best = { name: t.name, d };
    }
    if (!best) return null;
    return { name: best.name, score: 1 - best.d / HALF_DIAGONAL };
  }
}
