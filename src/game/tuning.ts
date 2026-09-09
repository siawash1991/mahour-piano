/**
 * What the app learned about this particular piano: how many semitones the note it hears differs
 * from the note it asked for. A keyboard may be transposed, the child's number stickers may start
 * somewhere other than middle C, and a small keyboard may only have the octave above or below.
 * One short listen at the start settles it, instead of every stage guessing.
 */
const KEY = "mahour-tuning";
const LEGACY = "mahour-keyboard-base";
export const TUNING_KEYS = [60, 64, 67];
export const LIMIT = 24;
export function readTuning(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const n = Number(JSON.parse(raw));
      return Number.isInteger(n) && Math.abs(n) <= LIMIT ? n : null;
    }
    // A child who already set their octave the old way should not be asked again.
    const base = Number(JSON.parse(localStorage.getItem(LEGACY) || "null"));
    return base === 48 || base === 60 || base === 72 ? base - 60 : null;
  } catch {
    return null;
  }
}
export function saveTuning(offset: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify(offset));
    // Keep the studio's octave setting in step whenever the shift is a whole octave.
    if (Math.abs(offset) % 12 === 0 && Math.abs(offset) <= 12)
      localStorage.setItem(LEGACY, JSON.stringify(60 + offset));
  } catch {
    /* private browsing: the child is asked again next time, which is the safe failure */
  }
}
export function clearTuning() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
/**
 * Turn what was heard for each asked key into one offset. The middle reading wins, so a single
 * misheard note cannot drag the result, and readings that disagree are rejected outright rather
 * than averaged into a number that fits none of them.
 */
export function resolve(asked: number[], heard: number[]) {
  if (heard.length !== asked.length || !heard.length) return null;
  const diffs = heard.map((h, i) => h - asked[i]).sort((a, b) => a - b);
  if (diffs[diffs.length - 1] - diffs[0] > 2) return null;
  const offset = diffs[Math.floor(diffs.length / 2)];
  return Math.abs(offset) <= LIMIT ? offset : null;
}
