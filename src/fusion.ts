export interface Pt2 { x: number; y: number; }

export class FusionController {
  private active = false;
  private lastDistance: number | null = null;
  private lastAngle: number | null = null;

  setActive(active: boolean) {
    this.active = active;
    this.lastDistance = null;
    this.lastAngle = null;
  }

  isActive(): boolean {
    return this.active;
  }

  update(handA: Pt2 | null, handB: Pt2 | null): { scaleDelta: number; rotationDelta: number } | null {
    if (!this.active || !handA || !handB) {
      this.lastDistance = null;
      this.lastAngle = null;
      return null;
    }
    const dx = handB.x - handA.x;
    const dy = handB.y - handA.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    let scaleDelta = 0;
    let rotationDelta = 0;
    if (this.lastDistance !== null) scaleDelta = (distance - this.lastDistance) * 4;
    if (this.lastAngle !== null) {
      let d = angle - this.lastAngle;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      rotationDelta = d;
    }
    this.lastDistance = distance;
    this.lastAngle = angle;
    return { scaleDelta, rotationDelta };
  }
}
