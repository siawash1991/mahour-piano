import { songs, type Step } from "../curriculum.ts";
/**
 * A 10-hole diatonic harmonica in C, Richter tuning. Hole 1 blow is middle C (C4); holding it in
 * the left hand, hole 1 (low) is on the player's left and the numbers face up.
 */
export const BLOW = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96];
export const DRAW = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93];
export type HarpStep = Step & { hole: number; blow: boolean };
export type HarpStage = {
  id: string;
  title: string;
  hint: string;
  steps: HarpStep[];
  bpm: number;
  song?: string;
};
/** Where a pitch lives. G4 is both 3 blow and 2 draw; beginners get the blow. */
export function holeFor(midi: number): { hole: number; blow: boolean } | null {
  const b = BLOW.indexOf(midi);
  if (b >= 0) return { hole: b + 1, blow: true };
  const d = DRAW.indexOf(midi);
  return d >= 0 ? { hole: d + 1, blow: false } : null;
}
/** Harmonica tab: "4" is hole 4 blow, "-4" is hole 4 draw. */
export function tab(text: string, bpm = 70): HarpStep[] {
  return text.split(" ").map((t) => {
    const hole = Math.abs(+t),
      blow = !t.startsWith("-");
    return { midi: (blow ? BLOW : DRAW)[hole - 1], beats: 1, hand: "R", hole, blow };
  });
}
const drills: [string, string, string, string][] = [
  ["harp-4", "سوراخ ۴: فوت و مک", "فقط یک سوراخ؛ آرام فوت کن، آرام مک بزن", "4 -4 4 -4 4 -4 4"],
  ["harp-45", "سوراخ ۴ و ۵", "دو‌ دوست همسایه", "4 -4 5 5 -4 4 -4 5"],
  ["harp-456", "تا سوراخ ۶", "لب‌ها غنچه، سُر بخور به راست", "4 -4 5 -5 6 6 -5 5 -4 4"],
  ["harp-up", "گام دو ماژور بالا", "هفت سوراخ‌ـ‌نت؛ سوراخ ۷ اول مک", "4 -4 5 -5 6 -6 -7 7"],
  ["harp-down", "گام دو ماژور پایین", "از ۷ برگرد به ۴", "7 -7 -6 6 -5 5 -4 4"],
];
/**
 * Every library song that fits the harmonica one octave up (the piano melodies sit around middle
 * C; on a C harp that octave is holes 4–7, the easiest place to play a scale).
 */
const songStages: HarpStage[] = songs
  .filter((s) => s.steps.every((st) => !st.chord?.length && holeFor(st.midi + 12)))
  .sort((a, b) => a.level - b.level)
  .map((s) => ({
    id: "harp-song-" + s.id,
    title: s.title,
    hint: s.concept,
    song: s.id,
    bpm: Math.min(s.bpm, 90),
    steps: s.steps.map((st) => ({ ...st, midi: st.midi + 12, ...holeFor(st.midi + 12)! })),
  }));
/** The first stages are breathing drills; the rest are songs. */
export const DRILLS = drills.length;
export const harpStages: HarpStage[] = [
  ...drills.map(([id, title, hint, t]) => ({ id, title, hint, steps: tab(t), bpm: 60 })),
  ...songStages,
];
