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
