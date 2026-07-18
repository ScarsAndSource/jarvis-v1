export type VideoState = "play" | "pause" | "scrub" | "restart";

export class VideoController {
  private video: HTMLVideoElement;
  private stateEl: HTMLElement;
  private fillEl: HTMLElement;
  private playheadEl: HTMLElement;
  private muteBtn: HTMLButtonElement;
  private state: VideoState = "scrub";
  private rafId = 0;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    this.stateEl = document.getElementById("video-state")!;
    this.fillEl = document.getElementById("timeline-fill")!;
    this.playheadEl = document.getElementById("timeline-playhead")!;
    this.muteBtn = document.getElementById("mute-btn")! as HTMLButtonElement;

    this.video.muted = true;
    this.video.loop = false;

    this.muteBtn.addEventListener("click", () => {
      this.video.muted = !this.video.muted;
      this.muteBtn.textContent = this.video.muted ? "Unmute" : "Mute";
    });

    this.startUI();
  }

  play() {
    this.state = "play";
    this.stateEl.textContent = "State: play";
    this.video.play().catch(() => {});
  }

  pause() {
    this.state = "pause";
    this.stateEl.textContent = "State: pause";
    this.video.pause();
  }

  restart() {
    this.state = "restart";
    this.stateEl.textContent = "State: restart";
    this.video.currentTime = 0;
    this.video.play().catch(() => {});
    this.state = "play";
    this.stateEl.textContent = "State: play";
  }

  scrub(normX: number) {
    // Previously this also bailed while state === "pause", which meant that
    // after the very first open-palm/fist gesture, hand movement could
    // never scrub again — "pause" is a terminal state with no gesture that
    // ever brings it back to "scrub". Only actively-playing video should
    // ignore hand position (so the video doesn't fight your resting hand
    // while it plays); once paused, moving your hand should always be able
    // to seek again, exactly as the on-screen hint promises.
    if (this.state === "play") return;
    this.state = "scrub";
    this.stateEl.textContent = "State: scrub";
    if (this.video.duration && isFinite(this.video.duration)) {
      this.video.currentTime = Math.max(0, Math.min(1, normX)) * this.video.duration;
    }
  }

  getState(): VideoState {
    return this.state;
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
  }

  private startUI() {
    const tick = () => {
      if (this.video.duration && isFinite(this.video.duration)) {
        const pct = (this.video.currentTime / this.video.duration) * 100;
        this.fillEl.style.width = `${pct}%`;
        this.playheadEl.style.left = `${pct}%`;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
