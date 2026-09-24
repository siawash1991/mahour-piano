import { audioContext } from "../audio";
import { frequency } from "../pitch";
import type { Chord } from "./harmony";
/**
 * A little band under the child's melody: bass, soft chords and a hi-hat, the way a teacher's
 * duet part turns three notes into music.
 */
let noise: AudioBuffer | undefined;
function tone(
  ctx: AudioContext,
  out: AudioNode,
  midi: number,
  at: number,
  length: number,
  volume: number,
  type: OscillatorType,
  sources: AudioScheduledSourceNode[],
) {
  const o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.value = frequency(midi);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(volume, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0008, at + Math.max(0.15, length));
  o.connect(g);
  g.connect(out);
  o.start(at);
  o.stop(at + length + 0.05);
  sources.push(o);
}
function hat(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  volume: number,
  sources: AudioScheduledSourceNode[],
) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  const src = ctx.createBufferSource(),
    filter = ctx.createBiquadFilter(),
    g = ctx.createGain();
  src.buffer = noise;
  filter.type = "highpass";
  filter.frequency.value = 6000;
  g.gain.value = volume;
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(at);
  sources.push(src);
}
/** Voice a chord in the octave under middle C's neighbourhood so it never covers the melody. */
const voice = (tones: number[]) => tones.map((pc) => 52 + ((pc - 4 + 12) % 12));
export type Band = { stop: () => void };
/**
 * Start the band `delayMs` from now: a four-click count-in ending on the first note, then bass on
 * each chord, a soft "oom-pah" chord and a hi-hat on every beat until the song's last beat.
 */
export async function playBand(
  chords: Chord[],
  bpm: number,
  delayMs: number,
  { countIn = true, volume = 1 } = {},
): Promise<Band> {
  const ctx = await audioContext(),
    master = ctx.createGain(),
    sources: AudioScheduledSourceNode[] = [];
  master.gain.value = 0.9 * volume;
  master.connect(ctx.destination);
  const beat = 60 / bpm,
    t0 = ctx.currentTime + delayMs / 1000;
  if (countIn)
    for (let k = 4; k >= 1; k--) {
      const at = t0 - k * beat;
      if (at > ctx.currentTime) tone(ctx, master, k === 4 ? 96 : 91, at, 0.05, 0.06, "square", sources);
    }
  const end = chords.length ? chords.at(-1)!.beat + chords.at(-1)!.span : 0;
  for (const c of chords) {
    const at = t0 + c.beat * beat,
      len = c.span * beat;
    tone(ctx, master, 36 + c.root, at, len * 0.95, 0.16, "triangle", sources);
    for (let b = 0; b < c.span; b++)
      voice(c.tones).forEach((m) =>
        tone(ctx, master, m, at + b * beat, beat * 0.8, b ? 0.025 : 0.04, "sine", sources),
      );
  }
  for (let b = 0; b < end; b++) hat(ctx, master, t0 + b * beat, b % 2 ? 0.05 : 0.09, sources);
  return {
    stop() {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0, now, 0.03);
      sources.forEach((s) => {
        try {
          s.stop(now + 0.1);
        } catch {
          /* already stopped */
        }
      });
      setTimeout(() => master.disconnect(), 300);
    },
  };
}
/** One soft chord right now: in wait mode each correct note is answered with its harmony. */
export async function strum(chord: Chord, volume = 1) {
  const ctx = await audioContext(),
    sources: AudioScheduledSourceNode[] = [],
    t = ctx.currentTime;
  tone(ctx, ctx.destination, 36 + chord.root, t, 0.9, 0.13 * volume, "triangle", sources);
  voice(chord.tones).forEach((m) => tone(ctx, ctx.destination, m, t, 0.8, 0.035 * volume, "sine", sources));
}
export function readBandOn() {
  try {
    return localStorage.getItem("mahour-band") !== "off";
  } catch {
    return true;
  }
}
export function saveBandOn(on: boolean) {
  try {
    localStorage.setItem("mahour-band", on ? "on" : "off");
  } catch {
    /* private browsing: the choice lasts until the page closes */
  }
}
