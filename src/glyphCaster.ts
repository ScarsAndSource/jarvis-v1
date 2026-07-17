import { DollarRecognizer, type Pt } from "./dollarRecognizer";

const STORAGE_KEY = "jarvis-v1-glyph-templates";
export const GLYPH_NAMES = ["circle", "zigzag"] as const;
export type GlyphName = (typeof GLYPH_NAMES)[number];
const MATCH_THRESHOLD = 0.65;

export type CastResult =
  | { kind: "matched"; name: GlyphName; score: number }
  | { kind: "fizzle" }
  | { kind: "attuned"; name: GlyphName };

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

  beginAttunement() {
    this.attuneQueue = [...GLYPH_NAMES];
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
    return { kind: "matched", name: result.name as GlyphName, score: result.score };
  }
}
