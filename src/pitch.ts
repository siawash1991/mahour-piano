/** YIN cumulative mean normalized difference, mono signals only. */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  minRms = 0.008,
): { midi: number; frequency: number; confidence: number; rms: number } | null {
  let rms = 0;
  for (const x of samples) rms += x * x;
  rms = Math.sqrt(rms / samples.length);
  if (rms < minRms) return null;
  const max = Math.min(
      Math.floor(sampleRate / 65),
      Math.floor(samples.length / 2) - 1,
    ),
    min = Math.floor(sampleRate / 1200),
    size = samples.length - max;
  const d = new Float32Array(max + 1);
  let sum = 0;
  d[0] = 1;
  for (let tau = 1; tau <= max; tau++) {
    let delta = 0;
    for (let i = 0; i < size; i++) {
      const v = samples[i] - samples[i + tau];
      delta += v * v;
    }
    sum += delta;
    d[tau] = sum ? (delta * tau) / sum : 1;
  }
  for (let tau = min; tau < max - 1; tau++) {
    if (d[tau] < 0.13) {
      while (tau + 1 < max && d[tau + 1] < d[tau]) tau++;
      const a = d[tau - 1],
        b = d[tau],
        c = d[tau + 1];
      const adjustment = (a - c) / (2 * (a - 2 * b + c) || 1);
      const frequency = sampleRate / (tau + adjustment);
      return {
        frequency,
        midi: Math.round(69 + 12 * Math.log2(frequency / 440)),
        confidence: 1 - d[tau],
        rms,
      };
    }
  }
  return null;
}
export function frequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** The notes the game and the studio can ask for: C3 up to G above the treble staff. */
export const LOW_KEY = 48;
export const HIGH_KEY = 79;
const HARMONICS = 5;
/**
 * Low notes need a longer look than high ones: a semitone near middle C is about 15Hz wide, so a
 * short window cannot tell C from the keys either side of it, which is what made "do" the note
 * the app kept missing. Giving every candidate the same number of cycles rather than the same
 * number of samples evens the resolution out, and costs less than analysing everything long.
 */
const CYCLES = 32;
const LONGEST = 4096;
const windows = new Map<number, Int32Array>();
function windowSizes(rate: number) {
  let sizes = windows.get(rate);
  if (!sizes) {
    sizes = Int32Array.from({ length: HIGH_KEY - LOW_KEY + 1 }, (_, i) =>
      Math.max(512, Math.min(LONGEST, Math.round((rate * CYCLES) / frequency(LOW_KEY + i)))),
    );
    windows.set(rate, sizes);
  }
  return sizes;
}
/** The buffer length the detector wants; shorter input still works, just with less resolution. */
export const ANALYSIS_WINDOW = LONGEST;
/**
 * Energy at one frequency. Goertzel costs one pass per frequency, which beats a whole FFT when
 * only the harmonics of the thirty-odd notes a child could be playing actually matter.
 */
function goertzel(samples: Float32Array, rate: number, hz: number, n: number) {
  const c = 2 * Math.cos((2 * Math.PI * hz) / rate);
  let s1 = 0,
    s2 = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i] + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return Math.sqrt(Math.abs(s1 * s1 + s2 * s2 - c * s1 * s2)) / n;
}
export type Comb = { total: Float32Array; fundamental: Float32Array };
/** How much energy sits on each candidate note's harmonic series, and on its bare fundamental. */
export function harmonics(samples: Float32Array, rate: number): Comb {
  const n = HIGH_KEY - LOW_KEY + 1,
    sizes = windowSizes(rate),
    total = new Float32Array(n),
    fundamental = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f0 = frequency(LOW_KEY + i),
      len = Math.min(sizes[i], samples.length);
    let sum = 0;
    for (let h = 1; h <= HARMONICS; h++) {
      const hz = f0 * h;
      if (hz * 2 >= rate) break;
      const g = goertzel(samples, rate, hz, len);
      if (h === 1) fundamental[i] = g;
      sum += g / h;
    }
    total[i] = sum;
  }
  return { total, fundamental };
}
/**
 * Which note was just struck, or null if nothing was. A piano is never monophonic — the note
 * before is still ringing, and often the two before that — so asking "what pitch is sounding?"
 * is the wrong question and a monophonic detector answers it with silence or the wrong note.
 * Asking "whose harmonics just got louder?" survives the overlap, and the threshold is relative
 * to loudness so it does not depend on how hard the child plays.
 */
export function strike(
  previous: Comb,
  current: Comb,
  rms: number,
  threshold: number,
): number | null {
  let best = -1,
    rise = 0;
  for (let i = 0; i < current.total.length; i++) {
    // Without a fundamental of its own, a candidate is only an echo of a lower note's harmonics.
    if (current.fundamental[i] < current.total[i] * 0.3) continue;
    const gain = current.total[i] - previous.total[i];
    if (gain > rise) {
      rise = gain;
      best = i;
    }
  }
  return best >= 0 && rise > threshold * Math.max(rms, 1e-9) ? LOW_KEY + best : null;
}
/** The strike threshold for the listening-sensitivity setting the parent chose (1 strict, 6 keen). */
export const strikeThreshold = (sensitivity: number) =>
  0.3 / Math.max(1, Math.min(6, sensitivity));
