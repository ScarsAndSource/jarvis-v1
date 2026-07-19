const INK_COLOR = "#f0e6d2";
const INK_WIDTH = 3;

/**
 * A dedicated finger-writing surface. Two stacked canvases:
 *  - ink: persistent strokes, only ever appended to (never redrawn wholesale)
 *  - cursor: a live reticle showing exactly where your fingertip currently
 *    maps to, redrawn every frame, cleared every frame. This is what makes
 *    it feel "wired properly" — you can see your pen position at all times,
 *    not just after a stroke lands.
 */
export class AirWriter {
  private inkCtx: CanvasRenderingContext2D;
  private cursorCtx: CanvasRenderingContext2D;
  private cssWidth: number;
  private cssHeight: number;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private inkCanvas: HTMLCanvasElement, private cursorCanvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = inkCanvas.clientWidth;
    this.cssHeight = inkCanvas.clientHeight;

    for (const c of [inkCanvas, cursorCanvas]) {
      c.width = this.cssWidth * dpr;
      c.height = this.cssHeight * dpr;
    }

    const inkCtx = inkCanvas.getContext("2d");
    const cursorCtx = cursorCanvas.getContext("2d");
    if (!inkCtx || !cursorCtx) throw new Error("Cannot get 2d context for air-writing canvases");
    this.inkCtx = inkCtx;
    this.cursorCtx = cursorCtx;
    this.inkCtx.scale(dpr, dpr);
    this.cursorCtx.scale(dpr, dpr);
  }

  /** nx, ny are normalized 0-1 fingertip coordinates (already mirrored). */
  private toPixel(nx: number, ny: number): { x: number; y: number } {
    return { x: nx * this.cssWidth, y: ny * this.cssHeight };
  }

  penDown(nx: number, ny: number) {
    this.drawing = true;
    const { x, y } = this.toPixel(nx, ny);
    this.lastX = x;
    this.lastY = y;
    // A single tap without movement should still leave a mark.
    this.inkCtx.beginPath();
    this.inkCtx.fillStyle = INK_COLOR;
    this.inkCtx.arc(x, y, INK_WIDTH / 2, 0, Math.PI * 2);
    this.inkCtx.fill();
  }

  penMove(nx: number, ny: number) {
    if (!this.drawing) return;
    const { x, y } = this.toPixel(nx, ny);
    this.inkCtx.strokeStyle = INK_COLOR;
    this.inkCtx.lineWidth = INK_WIDTH;
    this.inkCtx.lineCap = "round";
    this.inkCtx.lineJoin = "round";
    this.inkCtx.beginPath();
    this.inkCtx.moveTo(this.lastX, this.lastY);
    this.inkCtx.lineTo(x, y);
    this.inkCtx.stroke();
    this.lastX = x;
    this.lastY = y;
  }

  penUp() {
    this.drawing = false;
  }

  /** Call every frame the panel is active. Pass null when no hand is tracked. */
  updateCursor(nx: number | null, ny: number | null) {
    this.cursorCtx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    if (nx === null || ny === null) return;
    const { x, y } = this.toPixel(nx, ny);
    this.cursorCtx.save();
    this.cursorCtx.beginPath();
    this.cursorCtx.arc(x, y, this.drawing ? 5 : 8, 0, Math.PI * 2);
    if (this.drawing) {
      this.cursorCtx.fillStyle = "#e8935a";
      this.cursorCtx.fill();
    } else {
      this.cursorCtx.strokeStyle = "#a78bfa";
      this.cursorCtx.lineWidth = 2;
      this.cursorCtx.stroke();
    }
    this.cursorCtx.restore();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = this.inkCanvas.clientWidth;
    this.cssHeight = this.inkCanvas.clientHeight;
    for (const c of [this.inkCanvas, this.cursorCanvas]) {
      c.width = this.cssWidth * dpr;
      c.height = this.cssHeight * dpr;
    }
    this.inkCtx.scale(dpr, dpr);
    this.cursorCtx.scale(dpr, dpr);
  }

  clear() {
    this.inkCtx.clearRect(0, 0, this.cssWidth, this.cssHeight);
  }
}
