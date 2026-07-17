import * as THREE from "three";
import { createLivingInkMaterial } from "./livingInk";

interface RingSpec {
  innerRadius: number;
  outerRadius: number;
  periodSec: number;
  direction: 1 | -1;
  tickCount: number;
}

const RING_SPECS: RingSpec[] = [
  { innerRadius: 300, outerRadius: 340, periodSec: 6, direction: 1, tickCount: 16 },
  { innerRadius: 360, outerRadius: 392, periodSec: 11, direction: -1, tickCount: 24 },
  { innerRadius: 410, outerRadius: 436, periodSec: 19, direction: 1, tickCount: 32 },
];

function timestampBits(n: number, count: number): number[] {
  const bits: number[] = [];
  for (let i = 0; i < count; i++) bits.push((n >> i) & 1);
  return bits;
}

export class AstrolabeRings {
  readonly group = new THREE.Group();
  private meshes: { mesh: THREE.Mesh; spec: RingSpec; mat: THREE.ShaderMaterial }[] = [];

  constructor() {
    for (const spec of RING_SPECS) {
      const geo = new THREE.RingGeometry(spec.innerRadius, spec.outerRadius, 128, 1);
      const mat = createLivingInkMaterial(spec.tickCount);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2.15;
      this.group.add(mesh);
      this.meshes.push({ mesh, spec, mat });
    }
    this.group.position.set(0, -20, 900);
    void this.setTickData();
    this.startAutoRefresh();
  }

  private async setTickData() {
    const seconds = Math.floor(Date.now() / 1000);
    let commitCount = 0;
    try {
      const res = await fetch("https://api.github.com/users/ScarsAndSource/events/public");
      if (res.ok) {
        const events = await res.json();
        commitCount = Array.isArray(events) ? events.length : 0;
      }
    } catch {
      /* offline or rate-limited — rings just fall back to timestamp bits */
    }
    this.meshes[0].mat.uniforms.uTicks.value = timestampBits(seconds, this.meshes[0].spec.tickCount);
    this.meshes[1].mat.uniforms.uTicks.value = timestampBits(commitCount || seconds, this.meshes[1].spec.tickCount);
    this.meshes[2].mat.uniforms.uTicks.value = timestampBits(seconds ^ commitCount, this.meshes[2].spec.tickCount);
  }

  startAutoRefresh(intervalMs = 60000) {
    setInterval(() => void this.setTickData(), intervalMs);
  }

  setEngaged(engaged: boolean) {
    for (const { mat } of this.meshes) mat.uniforms.uEngaged.value = engaged ? 1 : 0;
  }

  update(dt: number, elapsed: number) {
    for (const { mesh, spec, mat } of this.meshes) {
      mesh.rotation.z += (spec.direction * (Math.PI * 2)) / spec.periodSec * dt;
      mat.uniforms.uTime.value = elapsed;
    }
  }
}
