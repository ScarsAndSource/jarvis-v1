const PI_OVER_180 = Math.PI / 180;

function smoothingFactor(te: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * te;
  return r / (r + 1);
}

function exponentialSmoothing(previous: number, current: number, factor: number): number {
  return previous + factor * (current - previous);
}

export class OneEuroFilter {
  private xPrev = 0;
  private dxPrev = 0;
  private initialized = false;
  private lastTime = 0;

  private minCutoff = 0.5;
  private beta = 0.2;
  private dCutoff = 0.5;

  constructor(minCutoff = 0.5, beta = 0.2, dCutoff = 0.5) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  reset(value?: number) {
    this.initialized = false;
    if (value !== undefined) {
      this.xPrev = value;
      this.dxPrev = 0;
    }
  }

  filter(value: number, timestamp?: number): number {
    const now = timestamp ?? performance.now();
    if (!this.initialized) {
      this.xPrev = value;
      this.dxPrev = 0;
      this.lastTime = now;
      this.initialized = true;
      return value;
    }

    const te = Math.max((now - this.lastTime) / 1000, 0.0001);
    this.lastTime = now;
    const dx = (value - this.xPrev) / te;
    const edx = exponentialSmoothing(this.dxPrev, dx, smoothingFactor(te, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const factor = smoothingFactor(te, cutoff);
    const filtered = exponentialSmoothing(this.xPrev, value, factor);
    this.xPrev = filtered;
    this.dxPrev = edx;
    return filtered;
  }
}
