import * as Tone from "tone";

export class SoundEngine {
  private started = false;
  private droneActive = false;

  private lockTone = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.4, release: 0.6 },
    harmonicity: 5.1,
    modulationIndex: 16,
    resonance: 2200,
    octaves: 1.2,
  }).toDestination();

  private droneFilter = new Tone.Filter(800, "lowpass").toDestination();
  private drone = new Tone.FMSynth({
    harmonicity: 1.01,
    modulationIndex: 3,
    envelope: { attack: 1.2, decay: 0.2, sustain: 1, release: 1.5 },
    modulationEnvelope: { attack: 1.2, decay: 0.2, sustain: 1, release: 1.5 },
  });

  private matchSynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.3 },
  }).toDestination();

  private fizzleSynth = new Tone.Synth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.4 },
  }).toDestination();

  constructor() {
    this.drone.connect(this.droneFilter);
    this.lockTone.volume.value = -14;
    this.drone.volume.value = -22;
    this.matchSynth.volume.value = -10;
    this.fizzleSynth.volume.value = -16;
  }

  async unlock() {
    if (this.started) return;
    await Tone.start();
    this.started = true;
  }

  playLockOn() {
    if (!this.started) return;
    this.lockTone.triggerAttackRelease("C3", 1.2);
  }

  startCastingDrone() {
    if (!this.started || this.droneActive) return;
    this.droneActive = true;
    this.drone.triggerAttack("A1");
  }

  stopCastingDrone() {
    if (!this.droneActive) return;
    this.droneActive = false;
    this.drone.triggerRelease();
  }

  playMatch() {
    if (!this.started) return;
    const now = Tone.now();
    this.matchSynth.triggerAttackRelease("E5", 0.12, now);
    this.matchSynth.triggerAttackRelease("A5", 0.12, now + 0.09);
    this.matchSynth.triggerAttackRelease("E6", 0.18, now + 0.18);
  }

  playFizzle() {
    if (!this.started) return;
    const now = Tone.now();
    this.fizzleSynth.triggerAttackRelease("D3", 0.18, now);
    this.fizzleSynth.triggerAttackRelease("Ab2", 0.28, now + 0.14);
  }
}
