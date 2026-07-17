import RAPIER from "@dimforge/rapier3d-compat";

export interface PhysicsPanelBody {
  rigidBody: RAPIER.RigidBody;
}

const GRAVITY = { x: 0, y: -640, z: 0 };

export class PhysicsWorld {
  world!: RAPIER.World;
  private ready = false;

  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World(GRAVITY);
    this.buildBounds();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  private buildBounds() {
    const floor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -500, 0));
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(2000, 20, 2000).setRestitution(0.35).setFriction(0.6),
      floor
    );
    const walls: [number, number, number, number, number, number][] = [
      [0, 0, -1600, 2000, 800, 20],
      [0, 0, 1600, 2000, 800, 20],
      [-1600, 0, 0, 20, 800, 2000],
      [1600, 0, 0, 20, 800, 2000],
    ];
    for (const [x, y, z, hx, hy, hz] of walls) {
      const wall = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.35), wall);
    }
  }

  createPanelBody(hw: number, hh: number, hd: number): PhysicsPanelBody {
    const rigidBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hw, hh, hd).setRestitution(0.4).setFriction(0.5),
      rigidBody
    );
    return { rigidBody };
  }

  makeDynamic(body: RAPIER.RigidBody, v: { x: number; y: number; z: number }) {
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.setLinvel(v, true);
    body.setAngvel({ x: v.z * 0.001, y: 0, z: -v.x * 0.001 }, true);
  }

  step() {
    this.world.step();
  }
}
