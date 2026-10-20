import { BEAT, SONG_MS, ringPerfectLead, type NoteData } from "./chart";
import type { Judge } from "./scoring";

export class AudioEngine {
  ctx: AudioContext | null = null;
  origin = 0;
  muted = false;
  private perfOrigin = 0;
  private perfHold = 0;
  private master: GainNode | null = null;

  async unlock(): Promise<void> {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.2;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state !== "running") await this.ctx.resume();
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.2;
  }

  beginRound(): void {
    if (!this.ctx || this.ctx.state === "closed") {
      this.perfOrigin = performance.now();
      this.origin = 0;
      return;
    }
    this.origin = this.ctx.currentTime + 0.12;
    this.perfOrigin = performance.now() + 120;
  }

  now(): number {
    if (this.ctx && this.ctx.state !== "closed") return (this.ctx.currentTime - this.origin) * 1000;
    return performance.now() - this.perfOrigin;
  }

  schedule(notes: NoteData[]): void {
    const beatSec = BEAT / 1000;
    const bars = Math.floor(SONG_MS / BEAT);
    for (let i = 0; i <= bars; i += 1) {
      const strong = i % 4 === 0;
      this.tone(this.origin + i * beatSec, strong ? 196 : 146.8, 0.07, strong ? 0.28 : 0.14, "triangle");
    }
    const melody = [523.25, 587.33, 659.25, 783.99, 880, 659.25];
    const lead = ringPerfectLead();
    notes.forEach((note, index) => {
      const freq = melody[index % melody.length] ?? 523.25;
      const accent = note.kind === "hold" ? note.time : Math.max(0, note.time - lead);
      this.tone(this.origin + accent / 1000, freq, 0.16, 0.34, "sine");
      if (note.kind === "hold" && note.duration) {
        this.tone(this.origin + (note.time + note.duration) / 1000, freq * 1.5, 0.12, 0.28, "sine");
      }
    });
  }

  playJudge(judge: Judge): void {
    if (!this.ctx) return;
    const freq = { perfect: 1174.66, good: 880, ok: 659.25, miss: 174.61 }[judge];
    this.tone(this.ctx.currentTime, freq, judge === "miss" ? 0.16 : 0.11, judge === "miss" ? 0.22 : 0.45, "sine");
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
    this.perfHold = performance.now();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    if (this.perfHold > 0) {
      this.perfOrigin += performance.now() - this.perfHold;
      this.perfHold = 0;
    }
  }

  stop(): void {
    this.perfHold = 0;
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close();
    this.ctx = null;
    this.master = null;
  }

  private tone(
    time: number,
    freq: number,
    dur: number,
    velocity: number,
    type: OscillatorType,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || time < ctx.currentTime - 0.05) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity * 0.22), time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }
}

export const audio = new AudioEngine();
