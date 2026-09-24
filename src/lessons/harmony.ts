import type { Step } from "../curriculum.ts";
/**
 * Chords chosen from the melody itself, so every song in the library, and every one added later,
 * gets an accompaniment without anyone writing it.
 */
export type Chord = { beat: number; span: number; root: number; tones: number[] };
const SHAPES = [
  [0, 4, 7],
  [0, 3, 7],
];
/**
 * Chords of the song's own key first, by distance from its tonic: I, V, IV, vi, ii, iii, and
 * III major for a minor tune's raised seventh.
 */
const BIAS: Record<string, number> = {
  "0-0": 1.2,
  "7-0": 1.05,
  "5-0": 1,
  "9-1": 0.8,
  "2-1": 0.55,
  "4-1": 0.45,
  "4-0": 0.35,
};
export function harmonize(steps: Step[], span = 2): Chord[] {
  const starts: number[] = [];
  let t = 0;
  for (const s of steps) {
    starts.push(t);
    t += s.beats;
  }
  // The key is the major scale that holds the most of the melody, with the last note as a tiebreak.
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const pcs = steps.map((s) => ((s.midi % 12) + 12) % 12);
  let key = 0,
    fits = -1;
  for (let k = 0; k < 12; k++) {
    const n =
      steps.reduce((t, s, i) => t + (MAJOR.includes((pcs[i] - k + 12) % 12) ? s.beats : 0), 0) +
      (MAJOR.includes((pcs.at(-1)! - k + 12) % 12) ? 0.5 : 0) +
      ([0, 7, 4].includes((pcs.at(-1)! - k + 12) % 12) ? 0.3 : 0);
    if (n > fits) {
      fits = n;
      key = k;
    }
  }
  const out: Chord[] = [];
  for (let beat = 0; beat < t; beat += span) {
    const weight = new Array(12).fill(0);
    steps.forEach((s, i) => {
      const overlap =
        Math.min(beat + span, starts[i] + s.beats) - Math.max(beat, starts[i]);
      if (overlap > 0)
        weight[((s.midi % 12) + 12) % 12] +=
          overlap * (starts[i] === beat ? 1.6 : 1);
    });
    let best: Chord | null = null,
      top = -Infinity;
    for (let root = 0; root < 12; root++)
      SHAPES.forEach((shape, minor) => {
        const tones = shape.map((i) => (root + i) % 12);
        const fit = weight.reduce(
          (n, w, pc) => n + (tones.includes(pc) ? w : -0.7 * w),
          0,
        );
        const prev = out.at(-1);
        const score =
          fit +
          (BIAS[`${(root - key + 12) % 12}-${minor}`] ?? -0.4) +
          (prev && prev.root === root && prev.tones[1] === tones[1] ? 0.25 : 0);
        if (score > top) {
          top = score;
          best = { beat, span, root, tones };
        }
      });
    out.push(best!);
  }
  return out;
}
/** The chord sounding at a beat. */
export const chordAt = (chords: Chord[], beat: number) =>
  [...chords].reverse().find((c) => c.beat <= beat) ?? chords[0];
/** Where a note sits in time, in beats from the first note. */
export const beatOf = (steps: Step[], index: number) =>
  steps.slice(0, index).reduce((n, s) => n + s.beats, 0);

/** A looping groove of chords for free play, e.g. the black keys over F♯ and D♯ minor. */
export function groove(pattern: [number, number[]][], bars: number): Chord[] {
  return Array.from({ length: bars }, (_, i) => {
    const [root, tones] = pattern[i % pattern.length];
    return { beat: i * 4, span: 4, root, tones };
  });
}
