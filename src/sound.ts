import type * as Tone from "tone";

export class SoundEngine {
  private started = false;
  private droneActive = false;
  private tone: typeof import("tone") | null = null;

  private lockTone: Tone.MetalSynth | null = null;
  private droneFilter: Tone.Filter | null = null;
  private drone: Tone.FMSynth | null = null;
  private matchSynth: Tone.Synth | null = null;
  private fizzleSynth: Tone.Synth | null = null;

  async unlock() {
    if (this.started) return;
    const ToneRuntime = await import("tone");
    this.tone = ToneRuntime;
    await ToneRuntime.start();

    this.lockTone = new ToneRuntime.MetalSynth({
      envelope: { attack: 0.001, decay: 1.4, release: 0.6 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 2200,
      octaves: 1.2,
    }).toDestination();
    this.lockTone.volume.value = -14;

    this.droneFilter = new ToneRuntime.Filter(800, "lowpass").toDestination();
    this.drone = new ToneRuntime.FMSynth({
      harmonicity: 1.01,
      modulationIndex: 3,
      envelope: { attack: 1.2, decay: 0.2, sustain: 1, release: 1.5 },
      modulationEnvelope: { attack: 1.2, decay: 0.2, sustain: 1, release: 1.5 },
    });
    this.drone.connect(this.droneFilter);
    this.drone.volume.value = -22;

    this.matchSynth = new ToneRuntime.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.3 },
    }).toDestination();
    this.matchSynth.volume.value = -10;

    this.fizzleSynth = new ToneRuntime.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.4 },
    }).toDestination();
    this.fizzleSynth.volume.value = -16;

    this.started = true;
  }

  isUnlocked(): boolean {
    return this.started;
  }

  playLockOn() {
    if (!this.started || !this.lockTone) return;
    this.lockTone.triggerAttackRelease("C3", 1.2);
  }

  startCastingDrone() {
    if (!this.started || !this.drone || this.droneActive) return;
    this.droneActive = true;
    this.drone.triggerAttack("A1");
  }

  stopCastingDrone() {
    if (!this.droneActive || !this.drone) return;
    this.droneActive = false;
    this.drone.triggerRelease();
  }

  playMatch() {
    if (!this.started || !this.matchSynth || !this.tone) return;
    const now = this.tone.now();
    this.matchSynth.triggerAttackRelease("E5", 0.12, now);
    this.matchSynth.triggerAttackRelease("A5", 0.12, now + 0.09);
    this.matchSynth.triggerAttackRelease("E6", 0.18, now + 0.18);
  }

  playFizzle() {
    if (!this.started || !this.fizzleSynth || !this.tone) return;
    const now = this.tone.now();
    this.fizzleSynth.triggerAttackRelease("D3", 0.18, now);
    this.fizzleSynth.triggerAttackRelease("Ab2", 0.28, now + 0.14);
  }
}
