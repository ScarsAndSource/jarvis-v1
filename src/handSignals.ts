export enum HandGesture {
  NONE = "none",
  OPEN_PALM = "open_palm",
  FIST = "fist",
  THUMBS_UP = "thumbs_up",
  THUMBS_DOWN = "thumbs_down",
  PEACE = "peace",
  POINT_UP = "point_up",
  ROCK_ON = "rock_on",
}

const enum Finger {
  THUMB_TIP = 4,
  INDEX_TIP = 8,
  MIDDLE_TIP = 12,
  RING_TIP = 16,
  PINKY_TIP = 20,
  THUMB_IP = 3,
  INDEX_PIP = 6,
  MIDDLE_PIP = 10,
  RING_PIP = 14,
  PINKY_PIP = 18,
  INDEX_MCP = 5,
  WRIST = 0,
}

export function distance2D(a: number[], b: number[]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function dist(a: number[], b: number[]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isExtended(landmarks: number[][], tip: number, pip: number): boolean {
  return landmarks[tip][1] < landmarks[pip][1];
}

function isThumbExtended(landmarks: number[][]): boolean {
  const thumbTip = landmarks[Finger.THUMB_TIP];
  const thumbIP = landmarks[Finger.THUMB_IP];
  const indexMCP = landmarks[Finger.INDEX_MCP];
  return dist(thumbTip, [indexMCP[0], indexMCP[1], indexMCP[2]]) > dist(thumbIP, [indexMCP[0], indexMCP[1], indexMCP[2]]);
}

function fingerTipY(landmarks: number[][], tip: number): number {
  return landmarks[tip][1];
}

export class HandSignals {
  private prevGesture = HandGesture.NONE;
  private holdFrames = 0;

  classify(landmarks: number[][]): HandGesture {
    if (landmarks.length < 21) return HandGesture.NONE;

    const indexExt = isExtended(landmarks, Finger.INDEX_TIP, Finger.INDEX_PIP);
    const middleExt = isExtended(landmarks, Finger.MIDDLE_TIP, Finger.MIDDLE_PIP);
    const ringExt = isExtended(landmarks, Finger.RING_TIP, Finger.RING_PIP);
    const pinkyExt = isExtended(landmarks, Finger.PINKY_TIP, Finger.PINKY_PIP);
    const thumbExt = isThumbExtended(landmarks);

    const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

    if (extendedCount === 4 && thumbExt) {
      return HandGesture.OPEN_PALM;
    }

    if (extendedCount === 0 && !thumbExt) {
      return HandGesture.FIST;
    }

    if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      const thumbTip = landmarks[Finger.THUMB_TIP];
      const wrist = landmarks[Finger.WRIST];
      if (thumbTip[1] < wrist[1] - 0.05) return HandGesture.THUMBS_UP;
      if (thumbTip[1] > wrist[1] + 0.05) return HandGesture.THUMBS_DOWN;
    }

    if (indexExt && middleExt && !ringExt && !pinkyExt) {
      const indexTipY = fingerTipY(landmarks, Finger.INDEX_TIP);
      const middleTipY = fingerTipY(landmarks, Finger.MIDDLE_TIP);
      if (Math.abs(indexTipY - middleTipY) < 0.03) {
        return HandGesture.PEACE;
      }
    }

    if (indexExt && !middleExt && !ringExt && !pinkyExt) {
      return HandGesture.POINT_UP;
    }

    if (thumbExt && indexExt && !middleExt && !ringExt && pinkyExt) {
      return HandGesture.ROCK_ON;
    }

    return HandGesture.NONE;
  }

  isHeld(gesture: HandGesture): boolean {
    if (gesture === this.prevGesture) {
      this.holdFrames++;
    } else {
      this.holdFrames = 0;
    }
    this.prevGesture = gesture;
    return this.holdFrames >= 10;
  }

  getNormalizedPalmX(landmarks: number[][]): number {
    if (landmarks.length < 21) return 0.5;
    const wrist = landmarks[Finger.WRIST];
    const indexMCP = landmarks[Finger.INDEX_MCP];
    return (wrist[0] + indexMCP[0]) / 2;
  }

  isHandVisible(landmarks: number[][] | null): boolean {
    return landmarks !== null && landmarks.length >= 21;
  }

  reset() {
    this.prevGesture = HandGesture.NONE;
    this.holdFrames = 0;
  }
}

export function computeHandScreenPos(landmarks: number[][]): { x: number; y: number } {
  return { x: 1 - landmarks[0][0], y: landmarks[0][1] };
}

export function computePinchStrength(landmarks: number[][]): number {
  const handScale = distance2D(landmarks[0], landmarks[9]) || 1e-6;
  return distance2D(landmarks[4], landmarks[8]) / handScale;
}

const PINCH_ENGAGE = 0.35;
const PINCH_RELEASE = 0.55;

export function computeIndexTipScreenPos(landmarks: number[][]): { x: number; y: number } {
  return { x: 1 - landmarks[8][0], y: landmarks[8][1] };
}

export function computePalmCenter(landmarks: number[][]): { x: number; y: number } {
  return { x: 1 - (landmarks[0][0] + landmarks[9][0]) / 2, y: (landmarks[0][1] + landmarks[9][1]) / 2 };
}

/** Midpoint between thumb tip and index tip — the natural "pen nib" position
 * when pinching, rather than the raw fingertip which sits slightly off it. */
export function computePinchMidpointScreenPos(landmarks: number[][]): { x: number; y: number } {
  return {
    x: 1 - (landmarks[4][0] + landmarks[8][0]) / 2,
    y: (landmarks[4][1] + landmarks[8][1]) / 2,
  };
}

/** Returns a continuous 0–1 openness value based on how many fingers are
 * extended. Replaces the old ternary that mapped gesture labels to hard
 * 0/0.5/1, so the flower animates smoothly as the hand opens (extended
 * finger count 0→4 gives 0→1) rather than snapping between stages. */
export function computeHandOpenness(landmarks: number[][]): number {
  if (landmarks.length < 21) return 0.5;
  const indexExt = isExtended(landmarks, Finger.INDEX_TIP, Finger.INDEX_PIP);
  const middleExt = isExtended(landmarks, Finger.MIDDLE_TIP, Finger.MIDDLE_PIP);
  const ringExt = isExtended(landmarks, Finger.RING_TIP, Finger.RING_PIP);
  const pinkyExt = isExtended(landmarks, Finger.PINKY_TIP, Finger.PINKY_PIP);
  const thumbExt = isThumbExtended(landmarks);
  const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
  if (extendedCount === 4 && thumbExt) return 1;
  if (extendedCount === 0 && !thumbExt) return 0;
  return 0.5;
}

export class PinchDetector {
  pinching = false;
  // The engage/release hysteresis band above absorbs steady jitter, but a
  // single noisy tracking frame (a landmark spike, a momentary detection
  // hiccup) could still cross the band for exactly one frame and flip
  // `pinching`, producing a phantom pen-down/pen-up in the middle of a
  // stroke that the person never intended. Requiring the flip to repeat for
  // CONFIRM_FRAMES in a row before committing filters that out while adding
  // only ~1 frame of perceptible latency.
  private static readonly CONFIRM_FRAMES = 2;
  private pendingState = false;
  private pendingFrames = 0;

  update(strength: number | null): { pinching: boolean; justStarted: boolean; justEnded: boolean } {
    const was = this.pinching;

    if (strength === null) {
      this.pinching = false;
      this.pendingFrames = 0;
      return { pinching: this.pinching, justStarted: false, justEnded: was && !this.pinching };
    }

    let desired = this.pinching;
    if (!this.pinching && strength < PINCH_ENGAGE) desired = true;
    else if (this.pinching && strength > PINCH_RELEASE) desired = false;

    if (desired === this.pinching) {
      this.pendingFrames = 0;
    } else if (desired === this.pendingState) {
      this.pendingFrames++;
      if (this.pendingFrames >= PinchDetector.CONFIRM_FRAMES) {
        this.pinching = desired;
        this.pendingFrames = 0;
      }
    } else {
      this.pendingState = desired;
      this.pendingFrames = 1;
    }

    return { pinching: this.pinching, justStarted: !was && this.pinching, justEnded: was && !this.pinching };
  }
}
