export function noiseFloor(values: number[]) {
  if (!values.length) return 0.0001;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.max(0.00002, sorted[Math.floor((sorted.length - 1) * 0.2)]);
}
export function signalThreshold(noise: number, sensitivity: number) {
  return Math.max(0.00006, noise * Math.max(1.5, 4 / Math.max(1, sensitivity)));
}
export function meter(rms: number) {
  return rms <= 0
    ? 0
    : Math.max(0, Math.min(100, (20 * Math.log10(rms) + 85) / 0.85));
}
