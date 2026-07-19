import type { RigidBody } from "@dimforge/rapier3d-compat";

export interface PhysicsPanelBody {
  rigidBody: RigidBody;
}

const GRAVITY = { x: 0, y: -640, z: 0 };

export class PhysicsWorld {
  private RAPIER!: typeof import("@dimforge/rapier3d-compat");
  world!: import("@dimforge/rapier3d-compat").World;
  private ready = false;

  async init() {
    this.RAPIER = await import("@dimforge/rapier3d-compat");
    await this.RAPIER.init();
    this.world = new this.RAPIER.World(GRAVITY);
    this.buildBounds();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  private buildBounds() {
    const floor = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.fixed().setTranslation(0, -500, 0));
    this.world.createCollider(
      this.RAPIER.ColliderDesc.cuboid(2000, 20, 2000).setRestitution(0.35).setFriction(0.6),
      floor
    );
    const walls: [number, number, number, number, number, number][] = [
      [0, 0, -1600, 2000, 800, 20],
      [0, 0, 1600, 2000, 800, 20],
      [-1600, 0, 0, 20, 800, 2000],
      [1600, 0, 0, 20, 800, 2000],
    ];
    for (const [x, y, z, hx, hy, hz] of walls) {
      const wall = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
      this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.35), wall);
    }
  }

  createPanelBody(hw: number, hh: number, hd: number): PhysicsPanelBody {
    const rigidBody = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(
      this.RAPIER.ColliderDesc.cuboid(hw, hh, hd).setRestitution(0.4).setFriction(0.5),
      rigidBody
    );
    return { rigidBody };
  }

  setKinematicKeepVelocity(body: RigidBody) {
    body.setBodyType(this.RAPIER.RigidBodyType.KinematicPositionBased, true);
  }

  setKinematic(body: RigidBody) {
    body.setBodyType(this.RAPIER.RigidBodyType.KinematicPositionBased, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  makeDynamic(body: RigidBody, v: { x: number; y: number; z: number }) {
    body.setBodyType(this.RAPIER.RigidBodyType.Dynamic, true);
    body.setLinvel(v, true);
    body.setAngvel({ x: v.z * 0.001, y: 0, z: -v.x * 0.001 }, true);
  }

  step() {
    this.world.step();
  }
}
