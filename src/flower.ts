export class FlowerScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stage = 0;
  private targetStage = 0;
  private petals: number[] = [];
  private time = 0;
  private animId = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get 2d context");
    this.ctx = ctx;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    this.startLoop();
  }

  setOpenness(v: number) {
    this.targetStage = Math.max(0, Math.min(1, v));
  }

  getStageLabel(): string {
    if (this.stage < 0.2) return "Seed";
    if (this.stage < 0.45) return "Sprouting";
    if (this.stage < 0.7) return "Growing";
    return "Full Bloom";
  }

  resize() {
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  destroy() {
    cancelAnimationFrame(this.animId);
  }

  private startLoop() {
    const loop = (t: number) => {
      this.time = t / 1000;
      this.stage += (this.targetStage - this.stage) * 0.06;
      this.draw();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  private draw() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.ctx.clearRect(0, 0, w, h);

    if (this.stage < 0.05) {
      this.drawSeed(w, h);
      return;
    }

    const s = Math.min(1, this.stage);

    if (s < 0.3) {
      this.drawSprout(w, h, s / 0.3);
    } else if (s < 0.6) {
      this.drawGrowing(w, h, (s - 0.3) / 0.3);
    } else {
      this.drawBloom(w, h, (s - 0.6) / 0.4);
    }
  }

  private drawSeed(w: number, h: number) {
    const cx = w / 2;
    const cy = h / 2 + 30;
    this.ctx.fillStyle = "#8B7355";
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, 12, 16, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = "#A0896C";
    this.ctx.beginPath();
    this.ctx.ellipse(cx - 3, cy - 4, 5, 8, -0.3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawSprout(w: number, h: number, t: number) {
    const cx = w / 2;
    const by = h / 2 + 30;
    const stemH = 30 * t;
    this.ctx.strokeStyle = "#4a7c3f";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, by);
    this.ctx.quadraticCurveTo(cx + 10 * t, by - stemH * 0.6, cx, by - stemH);
    this.ctx.stroke();
    const leafSize = 8 * t;
    this.ctx.fillStyle = "#5a9c4f";
    this.ctx.beginPath();
    this.ctx.ellipse(cx + 6 * t, by - stemH * 0.5, leafSize, leafSize * 0.5, 0.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(cx - 6 * t, by - stemH * 0.5, leafSize, leafSize * 0.5, -0.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawGrowing(w: number, h: number, t: number) {
    const cx = w / 2;
    const by = h / 2 + 30;
    const stemH = 30 + 20 * t;
    this.ctx.strokeStyle = "#4a7c3f";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, by);
    this.ctx.quadraticCurveTo(cx + 12 * t, by - stemH * 0.5, cx, by - stemH);
    this.ctx.stroke();
    const budR = 6 + 10 * t;
    this.ctx.fillStyle = `hsl(${280 + 40 * t}, 70%, ${50 + 20 * t}%)`;
    this.ctx.beginPath();
    this.ctx.ellipse(cx, by - stemH - budR * 0.3, budR, budR * 1.2, 0, 0, Math.PI * 2);
    this.ctx.fill();
    const leafSize = 8 + 4 * t;
    this.ctx.fillStyle = "#5a9c4f";
    this.ctx.beginPath();
    this.ctx.ellipse(cx + 8 + 4 * t, by - stemH * 0.4, leafSize, leafSize * 0.5, 0.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(cx - 8 - 4 * t, by - stemH * 0.4, leafSize, leafSize * 0.5, -0.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawBloom(w: number, h: number, t: number) {
    const cx = w / 2;
    const by = h / 2 + 30;
    const stemH = 50;
    this.ctx.strokeStyle = "#4a7c3f";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, by);
    this.ctx.quadraticCurveTo(cx + 12, by - stemH * 0.5, cx, by - stemH);
    this.ctx.stroke();
    const fx = cx;
    const fy = by - stemH - 10;
    const numPetals = 8;
    const bloom = Math.min(1, t + 0.3);
    const r = 16 * bloom;
    for (let i = 0; i < numPetals; i++) {
      const angle = (i / numPetals) * Math.PI * 2 + Math.sin(this.time * 0.8) * 0.04;
      const px = fx + Math.cos(angle) * r * 0.6;
      const py = fy + Math.sin(angle) * r * 0.6;
      const hue = 280 + 40 * Math.sin(this.time * 0.5 + i) * 0.15;
      this.ctx.fillStyle = `hsla(${hue}, 80%, ${55 + 15 * t}%, ${0.7 + 0.3 * t})`;
      this.ctx.beginPath();
      this.ctx.ellipse(px, py, r * 0.5, r * 0.3, angle * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
    const centerR = 6 * bloom;
    this.ctx.fillStyle = `hsl(50, 80%, ${50 + 20 * t}%)`;
    this.ctx.beginPath();
    this.ctx.arc(fx, fy, centerR, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
