import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

export type PanelMode = "docked" | "grabbed" | "returning";

export interface PanelHandle {
  id: string;
  el: HTMLElement;
  object: CSS3DObject;
  scale: number;
  mode: PanelMode;
  dockAngle: number;
}

const MIN_SCALE = 0.85;
const MAX_SCALE = 2.2;
const RING_RADIUS = 900;
const ROTATE_LERP = 0.12;
const RETURN_LERP = 0.06;
const RETURN_SNAP_DIST = 1;
const GRAB_IDLE_TIMEOUT_MS = 600;

function dockPosition(angle: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(angle) * RING_RADIUS, 0, Math.cos(angle) * RING_RADIUS);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class PanelManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer = new CSS3DRenderer();

  private carousel = new THREE.Group();
  private panels: PanelHandle[] = [];
  private focusIndex = 0;
  private targetRotationY = 0;
  private lastGrabUpdateAt = 0;

  constructor(mount: HTMLElement, panelEls: HTMLElement[], width: number, height: number) {
    this.renderer.setSize(width, height);
    this.renderer.domElement.className = "css3d-stage";
    mount.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 1, 5000);
    this.camera.position.z = RING_RADIUS + 650;

    this.scene.add(this.carousel);

    const count = panelEls.length;
    this.panels = panelEls.map((el, i) => {
      const object = new CSS3DObject(el);
      const angle = (i / count) * Math.PI * 2;
      object.position.copy(dockPosition(angle));
      object.rotation.y = angle;
      this.carousel.add(object);
      return { id: el.dataset.panelId ?? el.id, el, object, scale: 1, mode: "docked" as PanelMode, dockAngle: angle };
    });

    this.applyFocusState();
  }

  getFocusIndex(): number {
    return this.focusIndex;
  }

  getFocusedPanelId(): string | null {
    return this.panels[this.focusIndex]?.id ?? null;
  }

  count(): number {
    return this.panels.length;
  }

  focusNext() {
    if (this.panels.length === 0) return;
    this.focusIndex = (this.focusIndex + 1) % this.panels.length;
    this.applyFocusState();
  }

  focusPrev() {
    if (this.panels.length === 0) return;
    this.focusIndex = (this.focusIndex - 1 + this.panels.length) % this.panels.length;
    this.applyFocusState();
  }

  getFocusedScale(): number {
    return this.panels[this.focusIndex]?.scale ?? 1;
  }

  nudgeFocusedScale(delta: number) {
    const p = this.panels[this.focusIndex];
    if (!p || p.mode !== "docked") return;
    p.scale = clamp(p.scale + delta, MIN_SCALE, MAX_SCALE);
    p.object.scale.setScalar(p.scale);
  }

  applyFusionTransform(scaleDelta: number, rotationDelta: number) {
    const p = this.panels[this.focusIndex];
    if (!p || p.mode !== "docked") return;
    p.scale = clamp(p.scale + scaleDelta, MIN_SCALE, MAX_SCALE);
    p.object.scale.setScalar(p.scale);
    p.object.rotation.z += rotationDelta;
  }

  resetAll() {
    this.redockAll();
    for (const p of this.panels) {
      p.scale = 1;
      p.object.scale.setScalar(1);
    }
    this.focusIndex = 0;
    this.applyFocusState();
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  beginGrab(): PanelHandle | null {
    const p = this.panels[this.focusIndex];
    if (!p || p.mode !== "docked") return null;

    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.camera.quaternion.identity();

    p.object.position.applyQuaternion(this.carousel.quaternion);
    p.object.rotation.y += this.carousel.rotation.y;
    this.carousel.remove(p.object);
    this.scene.add(p.object);

    p.mode = "grabbed";
    this.lastGrabUpdateAt = performance.now();
    return p;
  }

  updateGrabPosition(target: THREE.Vector3) {
    const p = this.panels.find((x) => x.mode === "grabbed");
    if (!p) return;
    p.object.position.lerp(target, 0.35);
    this.lastGrabUpdateAt = performance.now();
  }

  releaseGrab() {
    const p = this.panels.find((x) => x.mode === "grabbed");
    if (!p) return;
    p.mode = "returning";
  }

  private redock(p: PanelHandle) {
    if (p.mode === "docked") return;
    this.scene.remove(p.object);
    this.carousel.add(p.object);

    const angle = p.dockAngle;
    p.object.position.copy(dockPosition(angle));
    p.object.rotation.set(0, angle, 0);
    p.scale = 1;
    p.object.scale.setScalar(1);

    p.mode = "docked";
  }

  redockAll() {
    for (const p of this.panels) this.redock(p);
  }

  tick() {
    this.carousel.rotation.y += (this.targetRotationY - this.carousel.rotation.y) * ROTATE_LERP;

    const now = performance.now();

    const grabbed = this.panels.find((p) => p.mode === "grabbed");
    if (grabbed && now - this.lastGrabUpdateAt > GRAB_IDLE_TIMEOUT_MS) {
      this.redock(grabbed);
    }

    for (const p of this.panels) {
      if (p.mode !== "returning") continue;
      const angle = p.dockAngle;
      const targetPos = dockPosition(angle);
      p.object.position.lerp(targetPos, RETURN_LERP);
      p.object.rotation.y += (angle - p.object.rotation.y) * RETURN_LERP;
      if (p.object.position.distanceTo(targetPos) < RETURN_SNAP_DIST) {
        this.redock(p);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private applyFocusState() {
    this.targetRotationY = -(this.focusIndex / this.panels.length) * Math.PI * 2;
    this.panels.forEach((p, i) => {
      p.el.classList.toggle("is-focused", i === this.focusIndex);
    });
  }
}
