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
