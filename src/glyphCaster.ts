import { DollarRecognizer, centroid, type Pt } from "./dollarRecognizer";

const STORAGE_KEY = "jarvis-v1-glyph-templates";
export const GLYPH_NAMES = ["circle", "zigzag", "spiral-in", "spiral-out", "figure-eight"] as const;
export type GlyphName = (typeof GLYPH_NAMES)[number];
const MATCH_THRESHOLD = 0.65;

export type CastResult =
  | { kind: "matched"; name: GlyphName; score: number; turns?: number }
  | { kind: "fizzle" }
  | { kind: "attuned"; name: GlyphName };

function computeTurns(raw: Pt[]): number {
  const c = centroid(raw);
  let total = 0;
  let prevAngle = Math.atan2(raw[0].y - c.y, raw[0].x - c.x);
  for (let i = 1; i < raw.length; i++) {
    const angle = Math.atan2(raw[i].y - c.y, raw[i].x - c.x);
    let delta = angle - prevAngle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    total += delta;
    prevAngle = angle;
  }
  return Math.abs(total) / (2 * Math.PI);
}

export class GlyphCaster {
  private recognizer = new DollarRecognizer();
  private trail: Pt[] = [];
  private capturing = false;
  private attuneQueue: GlyphName[] = [];

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) this.recognizer.restore(saved);
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, this.recognizer.serialize());
  }

  isAttuned(): boolean {
    return GLYPH_NAMES.every((n) => this.recognizer.hasTemplate(n));
  }

  beginAttunement(forceAll = false) {
    this.attuneQueue = forceAll
      ? [...GLYPH_NAMES]
      : GLYPH_NAMES.filter((n) => !this.recognizer.hasTemplate(n));
  }

  currentAttuneTarget(): GlyphName | null {
    return this.attuneQueue[0] ?? null;
  }

  startCapture() {
    this.capturing = true;
    this.trail = [];
  }

  addPoint(x: number, y: number) {
    if (!this.capturing) return;
    this.trail.push({ x: x * 1000, y: y * 1000 });
  }

  endCapture(): CastResult | null {
    this.capturing = false;
    if (this.trail.length < 10) return null;

    if (this.attuneQueue.length > 0) {
      const name = this.attuneQueue.shift()!;
      this.recognizer.addTemplate(name, this.trail);
      this.persist();
      return { kind: "attuned", name };
    }

    const result = this.recognizer.recognize(this.trail);
    if (!result || result.score < MATCH_THRESHOLD) return { kind: "fizzle" };
    const name = result.name as GlyphName;
    const turns = name === "spiral-in" || name === "spiral-out" ? computeTurns(this.trail) : undefined;
    return { kind: "matched", name, score: result.score, turns };
  }
}
