import { OneEuroFilter } from "./oneEuroFilter";

export class LandmarkSmoother {
  private filtersX: OneEuroFilter[] = [];
  private filtersY: OneEuroFilter[] = [];
  private filtersZ: OneEuroFilter[] = [];
  private initialized = false;

  constructor(
    private readonly minCutoff = 1.0,
    private readonly beta = 0.3,
    private readonly dCutoff = 1.0
  ) {}

  private ensureFilters(count: number) {
    if (this.initialized && this.filtersX.length === count) return;
    this.filtersX = Array.from({ length: count }, () => new OneEuroFilter(this.minCutoff, this.beta, this.dCutoff));
    this.filtersY = Array.from({ length: count }, () => new OneEuroFilter(this.minCutoff, this.beta, this.dCutoff));
    this.filtersZ = Array.from({ length: count }, () => new OneEuroFilter(this.minCutoff, this.beta, this.dCutoff));
    this.initialized = true;
  }

  smooth(landmarks: number[][], timestamp: number): number[][] {
    this.ensureFilters(landmarks.length);
    return landmarks.map((p, i) => [
      this.filtersX[i].filter(p[0], timestamp),
      this.filtersY[i].filter(p[1], timestamp),
      this.filtersZ[i].filter(p[2], timestamp),
    ]);
  }

  reset() {
    this.initialized = false;
    this.filtersX = [];
    this.filtersY = [];
    this.filtersZ = [];
  }
}
