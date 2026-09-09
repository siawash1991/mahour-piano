import { tabletLessons } from "../tablet/model.ts";
export const stages = tabletLessons.flatMap((lesson, li) => {
  const size = li < 3 ? lesson.steps.length : 8;
  return Array.from(
    { length: Math.ceil(lesson.steps.length / size) },
    (_, i) => ({
      id: `game-${lesson.id}-${i}`,
      title: lesson.title,
      unit: li,
      steps: lesson.steps.slice(i * size, (i + 1) * size),
      bpm: li < 3 ? 55 : 65,
    }),
  );
});
export function schedule(beats: number[], bpm: number) {
  let time = 3200;
  return beats.map((b) => {
    const at = time;
    time += (b * 60000) / bpm;
    return at;
  });
}
export type Verdict = "perfect" | "good" | "wrong" | "early" | "late";
export function judge(
  expected: number,
  actual: number,
  delta: number,
): Verdict {
  if (Math.abs(delta) > 380) return delta < 0 ? "early" : "late";
  if (expected !== actual) return "wrong";
  return Math.abs(delta) <= 180 ? "perfect" : "good";
}
export function stars(hit: number, total: number) {
  const accuracy = hit / total;
  return accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : accuracy >= 0.6 ? 1 : 0;
}
