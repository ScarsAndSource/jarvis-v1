import * as THREE from "three";
import { HandLandmarker, FilesetResolver, DrawingUtils, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { HandSignals, HandGesture, computeHandScreenPos, computePinchStrength, PinchDetector } from "./handSignals";
import { VideoController } from "./videoController";
import { FlowerScene } from "./flower";
import { PanelManager } from "./panels";
import { PhysicsWorld } from "./physics";

const holoStage = document.getElementById("holo-stage") as HTMLDivElement;
const holoPrevBtn = document.getElementById("holo-prev") as HTMLButtonElement;
const holoNextBtn = document.getElementById("holo-next") as HTMLButtonElement;
const holoResetBtn = document.getElementById("holo-reset") as HTMLButtonElement;
const holoDotsEl = document.getElementById("holo-dots") as HTMLDivElement;
const holoPanelEls = Array.from(
  document.querySelectorAll<HTMLElement>("#holo-panel-source .holo-panel")
);

const panelManager = new PanelManager(
  holoStage,
  holoPanelEls,
  holoStage.clientWidth,
  holoStage.clientHeight
);

window.addEventListener("resize", () => {
  panelManager.resize(holoStage.clientWidth, holoStage.clientHeight);
});

const physics = new PhysicsWorld();
const pinchDetector = new PinchDetector();
const THROW_FORCE = 5200;
const grabHistory: { pos: THREE.Vector3; t: number }[] = [];

function screenToWorldOnPlane(nx: number, ny: number, planeZ: number): THREE.Vector3 {
  const cam = panelManager.camera;
  const distance = cam.position.z - planeZ;
  const vFov = THREE.MathUtils.degToRad(cam.fov);
  const visibleHeight = 2 * Math.tan(vFov / 2) * distance;
  const visibleWidth = visibleHeight * cam.aspect;
  return new THREE.Vector3((nx - 0.5) * visibleWidth, (0.5 - ny) * visibleHeight, planeZ);
}

const resumeVideo = document.getElementById("resume-video") as HTMLVideoElement;
const videoCtrl = new VideoController(resumeVideo);

const flowerCanvas = document.getElementById("flower-canvas") as HTMLCanvasElement;
const flowerStageEl = document.getElementById("flower-stage") as HTMLParagraphElement;
const flowerScene = new FlowerScene(flowerCanvas);

const handSignals = new HandSignals();

let handLandmarker: HandLandmarker;
let lastHandX = 0.5;
let rafId = 0;

async function initHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
  });
  await physics.init();
  panelManager.attachPhysics(physics);
  predictLoop();
}

function predictLoop() {
  const video = resumeVideo;
  if (video.readyState >= 2 && handLandmarker) {
    const result = handLandmarker.detectForVideo(video, performance.now());
    if (result.landmarks && result.landmarks.length > 0) {
      const lm = result.landmarks[0].map((p: NormalizedLandmark) => [p.x, p.y, p.z]);
      const gesture = handSignals.classify(lm);
      const held = handSignals.isHeld(gesture);

      lastHandX = handSignals.getNormalizedPalmX(lm);

      applyDiscreteGesture(gesture);
      applyHeldGesture(gesture, held);

      videoCtrl.scrub(lastHandX);

      const now = performance.now();
      const pinchStrength = computePinchStrength(lm);
      const { justStarted, justEnded } = pinchDetector.update(pinchStrength);
      const screenPos = computeHandScreenPos(lm);
      const dragPoint = screenToWorldOnPlane(screenPos.x, screenPos.y, panelManager.camera.position.z - 500);

      if (justStarted) {
        panelManager.beginGrab();
        grabHistory.length = 0;
      }
      if (pinchDetector.pinching) {
        panelManager.updateGrabPosition(dragPoint);
        grabHistory.push({ pos: dragPoint.clone(), t: now });
        if (grabHistory.length > 6) grabHistory.shift();
      }
      if (justEnded && grabHistory.length >= 2) {
        const first = grabHistory[0];
        const last = grabHistory[grabHistory.length - 1];
        const dt = Math.max((last.t - first.t) / 1000, 1 / 60);
        const vel = last.pos.clone().sub(first.pos).divideScalar(dt).multiplyScalar(THROW_FORCE / 1000);
        panelManager.releaseGrab({ x: vel.x, y: vel.y, z: vel.z });
      }

      const openness = gesture === HandGesture.OPEN_PALM ? 1 : gesture === HandGesture.FIST ? 0 : 0.5;
      flowerScene.setOpenness(openness);
      flowerStageEl.textContent = `Stage: ${flowerScene.getStageLabel()}`;
    }
  }

  if (physics.isReady()) physics.step();
  panelManager.tick();
  rafId = requestAnimationFrame(predictLoop);
}

let lastDiscreteGesture = HandGesture.NONE;

function applyDiscreteGesture(gesture: HandGesture) {
  if (gesture === lastDiscreteGesture) return;
  lastDiscreteGesture = gesture;

  switch (gesture) {
    case HandGesture.OPEN_PALM:
      videoCtrl.play();
      break;
    case HandGesture.FIST:
      videoCtrl.pause();
      break;
    case HandGesture.THUMBS_DOWN:
      videoCtrl.restart();
      break;
    case HandGesture.THUMBS_UP:
      panelManager.focusNext();
      refreshDots();
      break;
    case HandGesture.PEACE:
      panelManager.focusPrev();
      refreshDots();
      break;
  }
}

function applyHeldGesture(gesture: HandGesture, held: boolean) {
  if (gesture === HandGesture.POINT_UP && held) {
    panelManager.nudgeFocusedScale(0.008);
  }
  if (gesture === HandGesture.ROCK_ON && held) {
    panelManager.nudgeFocusedScale(-0.008);
  }
}

function buildDots() {
  const count = panelManager.count();
  holoDotsEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("button");
    dot.className = "holo-dot";
    dot.dataset.index = String(i);
    dot.addEventListener("click", () => {
      const focus = panelManager.getFocusIndex();
      const diff = i - focus;
      if (diff > 0) for (let j = 0; j < diff; j++) panelManager.focusNext();
      else if (diff < 0) for (let j = 0; j < -diff; j++) panelManager.focusPrev();
      refreshDots();
    });
    holoDotsEl.appendChild(dot);
  }
  refreshDots();
}

function refreshDots() {
  const focus = panelManager.getFocusIndex();
  const dots = holoDotsEl.querySelectorAll<HTMLElement>(".holo-dot");
  dots.forEach((d, i) => d.classList.toggle("is-active", i === focus));
}

holoPrevBtn.addEventListener("click", () => {
  panelManager.focusPrev();
  refreshDots();
});

holoNextBtn.addEventListener("click", () => {
  panelManager.focusNext();
  refreshDots();
});

holoResetBtn.addEventListener("click", () => {
  panelManager.resetAll();
  refreshDots();
  videoCtrl.restart();
  flowerScene.setOpenness(0);
  handSignals.reset();
});

buildDots();
initHandLandmarker();
