export class WebcamError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "WebcamError";
  }
}

export async function initWebcam(
  videoEl: HTMLVideoElement,
  constraints: MediaStreamConstraints = {
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    audio: false,
  }
): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new WebcamError(
      "Camera requires a secure context (https:// or localhost). Currently running on an insecure origin."
    );
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new WebcamError("navigator.mediaDevices.getUserMedia is unavailable in this browser.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "UnknownError";
    let message = "Could not access the camera.";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      message = "Camera permission was denied. Allow camera access in the browser's site settings and reload.";
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      message = "No camera device was found.";
    } else if (name === "NotReadableError" || name === "TrackStartError") {
      message = "Camera is already in use by another application or tab.";
    } else if (name === "OverconstrainedError") {
      message = "No camera satisfies the requested resolution/facing mode constraints.";
    }
    throw new WebcamError(message, err);
  }

  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      videoEl.removeEventListener("loadedmetadata", onLoaded);
      resolve();
    };
    videoEl.addEventListener("loadedmetadata", onLoaded);
    videoEl.play().catch(reject);
  });

  return stream;
}

export function stopWebcam(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
