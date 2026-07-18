import * as THREE from "three";
import { HandLandmarker, FilesetResolver, DrawingUtils, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { HandSignals, HandGesture, computeHandScreenPos, computePinchStrength, computeIndexTipScreenPos, computePalmCenter, PinchDetector } from "./handSignals";
import { VideoController } from "./videoController";
import { FlowerScene } from "./flower";
import { PanelManager } from "./panels";
import { PhysicsWorld } from "./physics";
import { AstrolabeRings } from "./rings";
import { EmberField } from "./embers";
import { GlyphCaster } from "./glyphCaster";
import { SoundEngine } from "./sound";
import { FusionController } from "./fusion";
import { initWebcam, WebcamError } from "./webcam";
import { LandmarkSmoother } from "./landmarkSmoother";

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

const rings = new AstrolabeRings();
const embers = new EmberField();
panelManager.scene.add(rings.group, embers.points);
let lastFrameTime = performance.now();

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

const webcamVideo = document.getElementById("webcam-feed") as HTMLVideoElement;
const cameraStatusEl = document.getElementById("camera-status") as HTMLParagraphElement;
const overlayCanvas = document.getElementById("tracking-overlay") as HTMLCanvasElement;
const overlayCtx = overlayCanvas.getContext("2d") as CanvasRenderingContext2D;
const drawingUtils = new DrawingUtils(overlayCtx);
const trackingStatusEl = document.getElementById("tracking-status") as HTMLParagraphElement;
// beta pulls the filter toward being more responsive during fast motion (less
// lag) while minCutoff still kills jitter when the hand is still. Raise beta
// if it still feels laggy, lower it if it feels jittery.
const landmarkSmoother = new LandmarkSmoother(1.2, 0.6, 1.0);

const flowerCanvas = document.getElementById("flower-canvas") as HTMLCanvasElement;
const flowerStageEl = document.getElementById("flower-stage") as HTMLParagraphElement;
const flowerScene = new FlowerScene(flowerCanvas);

const handSignals = new HandSignals();

const glyphStatusEl = document.getElementById("glyph-status") as HTMLParagraphElement;
const attuneBtn = document.getElementById("attune-btn") as HTMLButtonElement;
const glyphCaster = new GlyphCaster();
let wasCasting = false;

const glyphTrailCanvas = document.getElementById("glyph-trail-canvas") as HTMLCanvasElement;
const glyphTrailCtx = glyphTrailCanvas.getContext("2d") as CanvasRenderingContext2D;
let glyphTrailPoints: { x: number; y: number }[] = [];
let glyphFadeTimer = 0;

function resizeGlyphTrailCanvas() {
  glyphTrailCanvas.width = holoStage.clientWidth;
  glyphTrailCanvas.height = holoStage.clientHeight;
}
resizeGlyphTrailCanvas();
window.addEventListener("resize", resizeGlyphTrailCanvas);

function drawGlyphTrail() {
  glyphTrailCtx.clearRect(0, 0, glyphTrailCanvas.width, glyphTrailCanvas.height);
  if (glyphTrailPoints.length < 2) return;
  glyphTrailCtx.save();
  glyphTrailCtx.strokeStyle = "#c9b8ff";
  glyphTrailCtx.lineWidth = 3;
  glyphTrailCtx.lineCap = "round";
  glyphTrailCtx.lineJoin = "round";
  glyphTrailCtx.shadowColor = "#a78bfa";
  glyphTrailCtx.shadowBlur = 12;
  glyphTrailCtx.beginPath();
  glyphTrailCtx.moveTo(glyphTrailPoints[0].x, glyphTrailPoints[0].y);
  for (let i = 1; i < glyphTrailPoints.length; i++) {
    glyphTrailCtx.lineTo(glyphTrailPoints[i].x, glyphTrailPoints[i].y);
  }
  glyphTrailCtx.stroke();
  const last = glyphTrailPoints[glyphTrailPoints.length - 1];
  glyphTrailCtx.fillStyle = "#e8935a";
  glyphTrailCtx.beginPath();
  glyphTrailCtx.arc(last.x, last.y, 6, 0, Math.PI * 2);
  glyphTrailCtx.fill();
  glyphTrailCtx.restore();
}

attuneBtn.addEventListener("click", () => {
  glyphCaster.beginAttunement();
  glyphStatusEl.textContent = `Attunement — point up, hold, draw "${glyphCaster.currentAttuneTarget()}", release`;
});

if (glyphCaster.isAttuned()) glyphStatusEl.textContent = "Glyphs: attuned (loaded from last session)";

const soundEngine = new SoundEngine();
document.addEventListener("pointerdown", () => { void soundEngine.unlock(); }, { once: true });

const fusionController = new FusionController();
const SPIRAL_ZOOM_PER_TURN = 0.35;

function handleCastResult(result: ReturnType<GlyphCaster["endCapture"]>) {
  if (!result) return;
  if (result.kind === "attuned") {
    soundEngine.playMatch();
    const next = glyphCaster.currentAttuneTarget();
    glyphStatusEl.textContent = next
      ? `Attuned "${result.name}" — now draw "${next}"`
      : `Attuned "${result.name}" — sanctum bound, casting is live`;
    return;
  }
  if (result.kind === "fizzle") {
    soundEngine.playFizzle();
    glyphStatusEl.textContent = "Glyph unrecognized — fizzled";
    const mat = embers.points.material as THREE.PointsMaterial;
    const original = mat.opacity;
    mat.opacity = 0.15;
    setTimeout(() => { mat.opacity = original; }, 220);
    return;
  }
  soundEngine.playMatch();
  glyphStatusEl.textContent = `Cast: ${result.name} (${(result.score * 100).toFixed(0)}%)`;

  if (result.name === "circle") {
    const visible = !rings.group.visible;
    rings.group.visible = visible;
    embers.points.visible = visible;
  } else if (result.name === "zigzag") {
    panelManager.resetAll();
  } else if (result.name === "spiral-in" || result.name === "spiral-out") {
    const direction = result.name === "spiral-in" ? 1 : -1;
    const amount = Math.min(result.turns ?? 1, 4) * SPIRAL_ZOOM_PER_TURN * direction;
    panelManager.nudgeFocusedScale(amount);
  } else if (result.name === "figure-eight") {
    const nowActive = !fusionController.isActive();
    fusionController.setActive(nowActive);
    glyphStatusEl.textContent = nowActive ? "Fusion mode: active — use both hands" : "Fusion mode: off";
  }
}

let handLandmarker: HandLandmarker;
let lastHandX = 0.5;
let rafId = 0;

async function initHandLandmarker() {
  try {
    await initWebcam(webcamVideo);
    cameraStatusEl.textContent = "Camera: live";
    cameraStatusEl.classList.remove("is-error");
    cameraStatusEl.classList.add("is-ready");
  } catch (err) {
    const message = err instanceof WebcamError ? err.message : "Camera failed to start.";
    cameraStatusEl.textContent = `Camera: ${message}`;
    cameraStatusEl.classList.remove("is-ready");
    cameraStatusEl.classList.add("is-error");
    console.error("Webcam init failed:", err);
    return;
  }

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
    numHands: 2,
  });
  await physics.init();
  panelManager.attachPhysics(physics);

  overlayCanvas.width = webcamVideo.videoWidth || 640;
  overlayCanvas.height = webcamVideo.videoHeight || 480;

  requestAnimationFrame(renderTick);
  scheduleDetect();
}

/**
 * Runs every animation frame regardless of hand-detection cost, so the 3D
 * scene stays smooth even if ML inference is slow on a given machine.
 */
function renderTick() {
  const frameNow = performance.now();
  const dt = Math.min((frameNow - lastFrameTime) / 1000, 0.1);
  lastFrameTime = frameNow;
  rings.setEngaged(pinchDetector.pinching);
  embers.setEngaged(pinchDetector.pinching);
  rings.update(dt, frameNow / 1000);
  embers.update(dt);
  if (physics.isReady()) physics.step();
  panelManager.tick();
  rafId = requestAnimationFrame(renderTick);
}

/**
 * Schedules detectTick to run as new camera frames actually arrive, via
 * requestVideoFrameCallback (syncs to real frame delivery, avoids redundant
 * work on frames that haven't changed). Falls back to a ~30fps timer on
 * browsers without rVFC support (older Safari).
 */
function scheduleDetect() {
  const videoAny = webcamVideo as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: () => void) => number;
  };
  if (typeof videoAny.requestVideoFrameCallback === "function") {
    videoAny.requestVideoFrameCallback(() => {
      detectTick();
      scheduleDetect();
    });
  } else {
    setTimeout(() => {
      detectTick();
      scheduleDetect();
    }, 33);
  }
}

function drawOverlay(allLandmarks: NormalizedLandmark[][]) {
  overlayCtx.save();
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  for (const hand of allLandmarks) {
    drawingUtils.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
      color: "#a78bfa",
      lineWidth: 3,
    });
    drawingUtils.drawLandmarks(hand, {
      color: "#7fe0a0",
      lineWidth: 1,
      radius: 4,
    });
  }
  overlayCtx.restore();
}

function detectTick() {
  const video = webcamVideo;
  if (video.readyState < 2 || !handLandmarker) return;

  const result = handLandmarker.detectForVideo(video, performance.now());
  const now = performance.now();

  if (result.landmarks && result.landmarks.length > 0) {
    drawOverlay(result.landmarks);
    trackingStatusEl.textContent = `Hand: tracked (${result.landmarks.length})`;
    trackingStatusEl.classList.remove("is-error");
    trackingStatusEl.classList.add("is-ready");

    const rawLm = result.landmarks[0].map((p: NormalizedLandmark) => [p.x, p.y, p.z]);
    const lm = landmarkSmoother.smooth(rawLm, now);
      const gesture = handSignals.classify(lm);
      const held = handSignals.isHeld(gesture);

      lastHandX = handSignals.getNormalizedPalmX(lm);

      applyDiscreteGesture(gesture);
      applyHeldGesture(gesture, now);

      const isCasting = gesture === HandGesture.POINT_UP && held;
      if (isCasting && !wasCasting) {
        glyphCaster.startCapture();
        soundEngine.startCastingDrone();
        clearTimeout(glyphFadeTimer);
        glyphTrailPoints = [];
      }
      if (isCasting) {
        const tip = computeIndexTipScreenPos(lm);
        glyphCaster.addPoint(tip.x, tip.y);
        glyphTrailPoints.push({ x: tip.x * glyphTrailCanvas.width, y: tip.y * glyphTrailCanvas.height });
        drawGlyphTrail();
      }
      if (!isCasting && wasCasting) {
        soundEngine.stopCastingDrone();
        handleCastResult(glyphCaster.endCapture());
        // Leave the finished rune on screen briefly so the person can see what
        // they drew, then fade it — instead of it vanishing the instant the
        // pose relaxes, which is what made casting feel like it wasn't working.
        glyphFadeTimer = window.setTimeout(() => {
          glyphTrailPoints = [];
          glyphTrailCtx.clearRect(0, 0, glyphTrailCanvas.width, glyphTrailCanvas.height);
        }, 500);
      }
      wasCasting = isCasting;

      const secondaryLm = result.landmarks?.[1]?.map((p: NormalizedLandmark) => [p.x, p.y, p.z]) ?? null;
      const primaryPalm = computePalmCenter(lm);
      const secondaryPalm = secondaryLm ? computePalmCenter(secondaryLm) : null;
      const fusionDelta = fusionController.update(primaryPalm, secondaryPalm);
      if (fusionDelta) panelManager.applyFusionTransform(fusionDelta.scaleDelta, fusionDelta.rotationDelta);

      videoCtrl.scrub(lastHandX);

      const pinchStrength = computePinchStrength(lm);
      const { justStarted, justEnded } = pinchDetector.update(pinchStrength);
      const screenPos = computeHandScreenPos(lm);
      const dragPoint = screenToWorldOnPlane(screenPos.x, screenPos.y, panelManager.camera.position.z - 500);

      if (justStarted) {
        panelManager.beginGrab();
        soundEngine.playLockOn();
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
  } else {
    if (wasCasting) {
      soundEngine.stopCastingDrone();
      glyphCaster.endCapture();
      wasCasting = false;
      clearTimeout(glyphFadeTimer);
      glyphTrailPoints = [];
      glyphTrailCtx.clearRect(0, 0, glyphTrailCanvas.width, glyphTrailCanvas.height);
    }
    fusionController.update(null, null);
    landmarkSmoother.reset();
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    trackingStatusEl.textContent = "Hand: not detected";
    trackingStatusEl.classList.remove("is-ready");
    trackingStatusEl.classList.add("is-error");
  }
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

let lastZoomFrameTime = 0;
const ZOOM_RATE_PER_SEC = 0.5;

function applyHeldGesture(gesture: HandGesture, now: number) {
  if (gesture !== HandGesture.ROCK_ON) {
    lastZoomFrameTime = 0;
    return;
  }
  if (lastZoomFrameTime === 0) {
    lastZoomFrameTime = now;
    return;
  }
  const dt = Math.min((now - lastZoomFrameTime) / 1000, 0.1);
  lastZoomFrameTime = now;
  panelManager.nudgeFocusedScale(-ZOOM_RATE_PER_SEC * dt);
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
