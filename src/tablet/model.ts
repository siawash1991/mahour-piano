import { lessons, songs, type Step } from "../curriculum.ts";
export const tabletLessons = [
  lessons[0],
  lessons[1],
  lessons[2],
  songs[0],
  songs[1],
  songs[2],
  songs[3],
];
export const whiteMidi = [60, 62, 64, 65, 67, 69, 71, 72];
export function keyFor(midi: number) {
  return whiteMidi.indexOf(midi) + 1;
}
export function transpose(midi: number, base: number) {
  return midi + base - 60;
}
export function chunks(steps: Step[]) {
  const output: Step[][] = [];
  for (let i = 0; i < steps.length; i += 4) output.push(steps.slice(i, i + 4));
  return output;
}
export function validBase(n: unknown): n is number {
  return n === 48 || n === 60 || n === 72;
}
export function readBase() {
  try {
    const n = JSON.parse(
      localStorage.getItem("mahour-keyboard-base") || "null",
    );
    return validBase(n) ? n : 60;
  } catch {
    return 60;
  }
}
export function saveBase(base: number) {
  if (!validBase(base)) return false;
  try {
    localStorage.setItem("mahour-keyboard-base", JSON.stringify(base));
    return true;
  } catch {
    return false;
  }
}
/** Require stable pitch plus silence between attacks: ambiguous sound never becomes a wrong note. */
export class NoteGate {
  last = -1;
  candidate = -1;
  stable = 0;
  quiet = 0;
  reset() {
    this.last = -1;
    this.candidate = -1;
    this.stable = 0;
    this.quiet = 0;
  }
  accept(p: { midi: number; confidence: number } | null, rms: number, floor=.008, confidence=.92) {
    if (rms < floor) {
      if (++this.quiet >= 3) this.last = -1;
      this.candidate = -1;
      this.stable = 0;
      return null;
    }
    this.quiet = 0;
    // An unreadable frame is missing evidence, not contrary evidence: a real attack is noisy and
    // often has a glitchy frame or two, so hold the count instead of throwing it away. Only a
    // different, confident pitch actually contradicts what we thought we were hearing.
    if (!p || p.confidence < confidence) return null;
    if (this.candidate === p.midi) this.stable++;
    else {
      this.candidate = p.midi;
      this.stable = 1;
    }
    if (this.stable >= 3 && this.last !== p.midi) {
      this.last = p.midi;
      return p.midi;
    }
    return null;
  }
}
