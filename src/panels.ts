import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsWorld } from "./physics";

export type PanelMode = "docked" | "grabbed" | "thrown";

export interface PanelHandle {
  id: string;
  el: HTMLElement;
  object: CSS3DObject;
  scale: number;
  mode: PanelMode;
  dockAngle: number;
  body: RAPIER.RigidBody | null;
}

const MIN_SCALE = 0.85;
const MAX_SCALE = 2.2;
const RING_RADIUS = 900;
const ROTATE_LERP = 0.12;
const BODY_HALF_DEPTH = 14;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class PanelManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer = new CSS3DRenderer();

  private carousel = new THREE.Group();
  private panels: PanelHandle[] = [];
  private focusIndex = 0;
  private targetRotationY = 0;
  private physics: PhysicsWorld | null = null;

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
      object.position.set(Math.sin(angle) * RING_RADIUS, 0, Math.cos(angle) * RING_RADIUS);
      object.rotation.y = angle;
      this.carousel.add(object);
      return { id: el.dataset.panelId ?? el.id, el, object, scale: 1, mode: "docked" as PanelMode, dockAngle: angle, body: null };
    });

    this.applyFocusState();
  }

  getFocusIndex(): number {
    return this.focusIndex;
  }

  count(): number {
    return this.panels.length;
  }

  focusNext() {
    if (this.focusIndex >= this.panels.length - 1) return;
    this.focusIndex++;
    this.applyFocusState();
  }

  focusPrev() {
    if (this.focusIndex <= 0) return;
    this.focusIndex--;
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

  resetAll() {
    for (const p of this.panels) {
      if (p.mode !== "docked") continue;
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

  attachPhysics(physics: PhysicsWorld) {
    this.physics = physics;
    for (const p of this.panels) {
      const hw = p.el.offsetWidth / 2 || 280;
      const hh = p.el.offsetHeight / 2 || 190;
      const { rigidBody } = physics.createPanelBody(hw, hh, BODY_HALF_DEPTH);
      p.body = rigidBody;
    }
  }

  beginGrab(): PanelHandle | null {
    const p = this.panels[this.focusIndex];
    if (!p || p.mode !== "docked" || !this.physics) return null;

    p.object.position.applyQuaternion(this.carousel.quaternion);
    p.object.rotation.y += this.carousel.rotation.y;
    this.carousel.remove(p.object);
    this.scene.add(p.object);

    p.mode = "grabbed";
    p.body!.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    return p;
  }

  updateGrabPosition(target: THREE.Vector3) {
    const p = this.panels.find((x) => x.mode === "grabbed");
    if (!p) return;
    p.object.position.lerp(target, 0.35);
    p.body!.setNextKinematicTranslation(p.object.position);
  }

  releaseGrab(velocity: { x: number; y: number; z: number }) {
    const p = this.panels.find((x) => x.mode === "grabbed");
    if (!p || !this.physics) return;
    p.mode = "thrown";
    this.physics.makeDynamic(p.body!, velocity);
  }

  tick() {
    this.carousel.rotation.y += (this.targetRotationY - this.carousel.rotation.y) * ROTATE_LERP;

    for (const p of this.panels) {
      if (p.mode !== "thrown" || !p.body) continue;
      const t = p.body.translation();
      const r = p.body.rotation();
      p.object.position.set(t.x, t.y, t.z);
      p.object.quaternion.set(r.x, r.y, r.z, r.w);
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
