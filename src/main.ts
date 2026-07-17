import { HandLandmarker, FilesetResolver, DrawingUtils, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { HandSignals, HandGesture } from "./handSignals";
import { VideoController } from "./videoController";
import { FlowerScene } from "./flower";
import { PanelManager } from "./panels";

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

      const openness = gesture === HandGesture.OPEN_PALM ? 1 : gesture === HandGesture.FIST ? 0 : 0.5;
      flowerScene.setOpenness(openness);
      flowerStageEl.textContent = `Stage: ${flowerScene.getStageLabel()}`;
    }
  }

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
