import * as THREE from "three";

const COUNT = 260;

export class EmberField {
  readonly points: THREE.Points;
  private velocities = new Float32Array(COUNT * 3);
  private origins = new Float32Array(COUNT * 3);

  constructor(radius = 500, spread = 260) {
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = radius + (Math.random() - 0.5) * spread;
      const x = Math.sin(angle) * r;
      const y = (Math.random() - 0.5) * 300;
      const z = Math.cos(angle) * r;
      positions.set([x, y, z], i * 3);
      this.origins.set([x, y, z], i * 3);
      this.velocities.set([0, 12 + Math.random() * 18, 0], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 4,
      color: new THREE.Color("#e8935a"),
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.position.set(0, -20, 900);
  }

  setEngaged(engaged: boolean) {
    (this.points.material as THREE.PointsMaterial).color.set(engaged ? "#3ddc84" : "#e8935a");
  }

  update(dt: number) {
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const y = pos.getY(i) + this.velocities[i * 3 + 1] * dt;
      const originY = this.origins[i * 3 + 1];
      pos.setY(i, y > originY + 260 ? originY - 40 : y);
    }
    pos.needsUpdate = true;
  }
}
