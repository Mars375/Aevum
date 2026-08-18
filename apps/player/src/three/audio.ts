import type { BattleEvent } from "@abs/contracts";

/**
 * Battle sound, synthesised rather than sampled.
 *
 * The phase 3 card asks for audio. Shipping audio files would mean sourcing
 * assets I cannot produce, and borrowing someone else's is exactly what the
 * card forbids. So every sound here is generated with Web Audio primitives: a
 * short noise burst for a hit, a filtered click for a move, a falling tone for
 * a destruction. No files, no licences, a few hundred bytes of code.
 *
 * Muted by default. Sound that starts itself is a hostile default, and browsers
 * block it anyway until the reader interacts.
 */

type Voice = "hit" | "miss" | "move" | "destroyed" | "alliance";

const VOICES: Record<Voice, { freq: number; decay: number; type: OscillatorType; noise?: boolean }> = {
  hit: { freq: 110, decay: 0.18, type: "square", noise: true },
  miss: { freq: 320, decay: 0.09, type: "sine" },
  move: { freq: 520, decay: 0.05, type: "triangle" },
  destroyed: { freq: 70, decay: 0.55, type: "sawtooth", noise: true },
  alliance: { freq: 660, decay: 0.32, type: "sine" },
};

/** Which sound an event makes, if any. Most events are silent on purpose. */
function voiceFor(event: BattleEvent): Voice | null {
  switch (event.type) {
    case "ATTACK_HIT":
      return "hit";
    case "ATTACK_MISSED":
    case "ATTACK_OUT_OF_RANGE":
      return "miss";
    case "MOVE_OK":
      return "move";
    case "SQUAD_DESTROYED":
    case "FACTION_ELIMINATED":
      return "destroyed";
    case "ALLIANCE_FORMED":
    case "ALLIANCE_BROKEN":
      return "alliance";
    default:
      return null;
  }
}

export class BattleAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = false;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22; // quiet: this plays under reading, not over it
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    return buffer;
  }

  private play(voice: Voice, at: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const spec = VOICES[voice];
    const t = ctx.currentTime + at;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.decay);
    gain.connect(this.master);

    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.freq, t);
    // A destruction falls away; everything else holds its pitch.
    if (voice === "destroyed") osc.frequency.exponentialRampToValueAtTime(spec.freq / 3, t + spec.decay);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + spec.decay + 0.02);

    if (spec.noise) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer(ctx, spec.decay);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1400;
      noise.connect(filter).connect(gain);
      noise.start(t);
    }
  }

  /**
   * Sound one turn's events.
   *
   * Deduplicated by voice and capped: a turn with eleven hits should read as a
   * volley, not as eleven separate thuds fighting each other. Sounds are spread
   * a few tens of milliseconds apart so the ear can separate them.
   */
  playTurn(events: readonly BattleEvent[]) {
    if (!this.enabled) return;
    const voices = events.map(voiceFor).filter((v): v is Voice => v !== null);
    const counts = new Map<Voice, number>();
    let slot = 0;
    for (const voice of voices) {
      const seen = counts.get(voice) ?? 0;
      if (seen >= 3) continue; // three of a kind is already a volley
      counts.set(voice, seen + 1);
      this.play(voice, slot * 0.06);
      slot += 1;
    }
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
