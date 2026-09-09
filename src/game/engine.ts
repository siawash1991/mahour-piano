import { songs, western, type Step } from "../curriculum.ts";
/** The white keys from middle C up; drills are written against the first eight. */
export const lane = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
export const isWhite = (m: number) => WHITE.includes(((m % 12) + 12) % 12);
/**
 * White keys carry the sticker number the child has on the real keyboard — 1 is middle C —
 * and a black key borrows the number of the white below it plus a sharp.
 */
export function keyLabel(m: number): string {
  if (m < 60) return western(m);
  if (!isWhite(m)) return keyLabel(m - 1) + "♯";
  let n = 0;
  for (let x = 60; x <= m; x++) if (isWhite(x)) n++;
  return n.toLocaleString("fa-IR");
}
export type Key = { midi: number; white: boolean; left: number; width: number };
/**
 * The strip of piano keys a stage needs, always starting at middle C and never narrower than
 * one octave, laid out in percentages the way a real keyboard looks from above.
 */
export function board(steps: { midi: number }[]): Key[] {
  let top = Math.max(72, ...steps.map((s) => s.midi));
  while (!isWhite(top)) top++;
  const keys: number[] = [];
  for (let m = 60; m <= top; m++) keys.push(m);
  const unit = 100 / keys.filter(isWhite).length;
  let w = 0;
  return keys.map((midi) =>
    isWhite(midi)
      ? { midi, white: true, left: w++ * unit, width: unit }
      : { midi, white: false, left: w * unit - unit * 0.3, width: unit * 0.6 },
  );
}
const value: Record<string, number> = { e: 0.5, q: 1, h: 2, w: 4 };
/** "1231" plus an optional rhythm string ("eeqh") reads as one short phrase. */
const phrase = (keys: string, rhythm = "q".repeat(keys.length)): Step[] =>
  [...keys].map((k, i) => ({
    midi: lane[+k - 1],
    beats: value[rhythm[i]] ?? 1,
    hand: "R" as const,
  }));
/** Song melodies are written for the game's eight lanes; anything lower moves up an octave. */
const inRange = (steps: Step[]) =>
  steps.map((s) => ({ ...s, midi: s.midi < 60 ? s.midi + 12 : s.midi }));
/** Split a melody into bite-size stages, folding a lonely tail back into the previous stage. */
export function cut(steps: Step[], size: number): Step[][] {
  const out: Step[][] = [];
  for (let i = 0; i < steps.length; i += size) out.push(steps.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length <= size / 2)
    out.splice(-2, 2, [...out[out.length - 2], ...out[out.length - 1]]);
  return out;
}
export type Stage = {
  id: string;
  title: string;
  world: number;
  worldTitle: string;
  steps: Step[];
  bpm: number;
  song?: string;
};
type World = {
  title: string;
  hint: string;
  bpm: number;
  drills?: [string, string?][];
  song?: string;
  size?: number;
  full?: boolean;
};
const song = (id: string) => songs.find((s) => s.id === id)!;
const worlds: World[] = [
  {
    title: "سلام دو، رِ، می",
    hint: "فقط سه کلید اول: ۱، ۲ و ۳",
    bpm: 46,
    drills: [
      ["11", "hh"],
      ["1111"],
      ["22", "hh"],
      ["1122"],
      ["3333"],
      ["1212"],
      ["1231"],
      ["3213"],
      ["112233"],
      ["123321"],
    ],
  },
  {
    title: "پنج انگشت",
    hint: "کلیدهای ۱ تا ۵، یک انگشت برای هر کلید",
    bpm: 52,
    drills: [
      ["1234"],
      ["4321"],
      ["12345"],
      ["54321"],
      ["1351"],
      ["13531"],
      ["12345431"],
      ["132435421"],
    ],
  },
  { title: "نان‌های داغ", hint: "اولین آهنگ واقعی‌ات", bpm: 60, song: "hot-cross", size: 4 },
  { title: "مری و برهٔ کوچولو", hint: "یک ملودی آشنا، تکه‌تکه", bpm: 62, song: "mary", size: 6 },
  {
    title: "تا هشت بشمار",
    hint: "حالا تا کلید ۸ می‌رویم",
    bpm: 58,
    drills: [
      ["5678"],
      ["8765"],
      ["12345678"],
      ["87654321"],
      ["8531"],
      ["13578"],
      ["13578642"],
      ["1234567887654321"],
    ],
  },
  { title: "چشمک بزن، ستاره", hint: "آهنگ کامل در شش تکه", bpm: 66, song: "twinkle", size: 8 },
  { title: "سرود شادی", hint: "تم بتهوون", bpm: 66, song: "ode", size: 6 },
  { title: "برادر ژاک", hint: "نت‌های سریع‌تر", bpm: 68, song: "frere", size: 8 },
  { title: "زنگوله‌ها", hint: "ترجیع‌بند شاد", bpm: 70, song: "jingle", size: 6 },
  {
    title: "ریتم‌های تازه",
    hint: "نت‌های کوتاه و بلند کنار هم",
    bpm: 66,
    drills: [
      ["112233", "eeeeqq"],
      ["12345", "eeeeh"],
      ["1234554321", "eeeeqeeeeh"],
      ["123456788", "eeeeeeeqh"],
    ],
  },
  {
    title: "تولدت مبارک",
    hint: "اولین آهنگ با کلیدهای بالاتر از ۸",
    bpm: 68,
    song: "birthday",
    size: 6,
  },
  {
    title: "تمرین استادی",
    hint: "سریع، صاف و بدون توقف",
    bpm: 76,
    drills: [
      ["13531357", "eeeeeeeh"],
      ["12345678", "eeeeeeeh"],
      ["1122334455667788", "eeeeeeeeeeeeeeeh"],
      ["1234567887654321", "eeeeeeeeeeeeeeeh"],
    ],
  },
  {
    title: "برای الیزه",
    hint: "اولین آهنگ با کلیدهای سیاه",
    bpm: 56,
    song: "fur-elise",
    size: 4,
  },
  {
    title: "کنسرت بزرگ",
    hint: "آهنگ کامل، با سرعت واقعی",
    bpm: 0,
    full: true,
  },
];
const concert = [
  "hot-cross",
  "mary",
  "twinkle",
  "ode",
  "frere",
  "jingle",
  "birthday",
  "fur-elise",
];
export const stages: Stage[] = worlds.flatMap((w, wi) => {
  const head = { world: wi, worldTitle: w.title };
  if (w.drills)
    return w.drills.map((d, i) => ({
      ...head,
      id: `w${wi}-d${i}`,
      title: `${w.title} ${(i + 1).toLocaleString("fa-IR")}`,
      steps: phrase(d[0], d[1]),
      bpm: w.bpm + i * 2,
    }));
  if (w.full)
    return concert.map((id) => ({
      ...head,
      id: `concert-${id}`,
      title: song(id).title,
      steps: inRange(song(id).steps),
      bpm: song(id).bpm,
      song: id,
    }));
  const s = song(w.song!),
    all = inRange(s.steps),
    parts = cut(all, w.size!),
    mid = Math.ceil(all.length / 2);
  return [
    ...parts.map((steps, i) => ({
      ...head,
      id: `w${wi}-p${i}`,
      title: `${w.title} · بخش ${(i + 1).toLocaleString("fa-IR")}`,
      steps,
      bpm: w.bpm,
      song: w.song,
    })),
    // Two halves bridge the short fragments and the whole piece, so nothing doubles overnight.
    {
      ...head,
      id: `w${wi}-h0`,
      title: `${w.title} · نیمهٔ اول`,
      steps: all.slice(0, mid),
      bpm: w.bpm + 2,
      song: w.song,
    },
    {
      ...head,
      id: `w${wi}-h1`,
      title: `${w.title} · نیمهٔ دوم`,
      steps: all.slice(mid),
      bpm: w.bpm + 2,
      song: w.song,
    },
    {
      ...head,
      id: `w${wi}-all`,
      title: `${w.title} · کامل`,
      steps: all,
      bpm: w.bpm + 4,
      song: w.song,
    },
  ];
});
export const worldList = worlds.map((w, i) => ({
  index: i,
  title: w.title,
  hint: w.hint,
  from: stages.findIndex((s) => s.world === i),
}));
/** Notes fall for `lead` ms before their beat, so the count-in and the highway stay in step. */
export const lead = 3200;
export function schedule(beats: number[], bpm: number) {
  let time = lead;
  return beats.map((b) => {
    const at = time;
    time += (b * 60000) / bpm;
    return at;
  });
}
export type Verdict = "perfect" | "good" | "wrong" | "early" | "late";
/** Slow practice speeds widen the timing window by the same factor, capped at 2x. */
export const tolerance = (speed: number) => Math.min(2, 1 / speed);
/** How far off the beat a note still counts, and how close it has to be to read as perfect. */
export const WINDOW = 500;
export const PERFECT = 250;
export const windowFor = (tol: number) => WINDOW * tol;
export function judge(
  expected: number,
  actual: number,
  delta: number,
  tol = 1,
): Verdict {
  if (Math.abs(delta) > WINDOW * tol) return delta < 0 ? "early" : "late";
  if (expected !== actual) return "wrong";
  return Math.abs(delta) <= PERFECT * tol ? "perfect" : "good";
}
export type Pending = { index: number; at: number; midi: number };
/**
 * Decide which note a heard pitch was meant for. The exact pitch inside the timing window wins;
 * failing that the same note an octave out, so a child on a differently placed keyboard is not
 * punished for it; and only if neither is there does the nearest note still waiting take the
 * blame. Matching on time alone would score a correct note against a note the child already
 * missed, turning one hesitation into a run of red.
 */
export function match(
  heard: number,
  pending: Pending[],
  elapsed: number,
  window: number,
) {
  const sooner = (a: Pending, b: Pending) =>
    Math.abs(a.at - elapsed) <= Math.abs(b.at - elapsed) ? a : b;
  const near = pending.filter((p) => Math.abs(p.at - elapsed) <= window);
  const best = (test: (p: Pending) => boolean) =>
    near.filter(test).reduce<Pending | undefined>(
      (a, b) => (a ? sooner(a, b) : b),
      undefined,
    );
  const exact = best((p) => p.midi === heard);
  if (exact) return { pick: exact, matched: true, octave: 0 };
  const octave = best((p) => (heard - p.midi) % 12 === 0);
  if (octave)
    return { pick: octave, matched: true, octave: heard - octave.midi };
  return {
    pick: pending.reduce<Pending | undefined>(
      (a, b) => (a ? sooner(a, b) : b),
      undefined,
    ),
    matched: false,
    octave: 0,
  };
}
export function stars(hit: number, total: number) {
  const accuracy = hit / total;
  return accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : accuracy >= 0.6 ? 1 : 0;
}
export const speeds = [0.5, 0.65, 0.8, 1];
export function readSpeed() {
  try {
    const n = Number(localStorage.getItem("mahour-speed"));
    return speeds.includes(n) ? n : 0.65;
  } catch {
    return 0.65;
  }
}
export function saveSpeed(n: number) {
  try {
    localStorage.setItem("mahour-speed", String(n));
  } catch {
    /* private browsing: the choice simply does not persist */
  }
}
