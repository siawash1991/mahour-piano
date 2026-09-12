import { frequency } from "./pitch";
let context: AudioContext | undefined;
export async function audioContext() {
  context ??= new AudioContext();
  if (context.state === "suspended") await context.resume();
  return context;
}
export async function playNote(midi: number, duration = 0.5, volume = 0.2) {
  const ctx = await audioContext();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.08, duration));
  [1, 2, 3].forEach((h, i) => {
    const osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency(midi) * h;
    g.gain.value = [1, 0.25, 0.08][i];
    osc.connect(g);
    g.connect(gain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  });
}
export async function tick(accent = false) {
  const ctx = await audioContext(),
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.frequency.value = accent ? 1100 : 800;
  g.gain.setValueAtTime(0.09, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.065);
}

/** A touch-key voice with a real release envelope; no external samples or microphone. */
export async function startPianoNote(midi: number) {
  const ctx = await audioContext(),
    gain = ctx.createGain(),
    t = ctx.currentTime;
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.035, t + 2);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 8);
  const oscillators = [1, 2, 3].map((h, i) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.frequency.value = frequency(midi) * h;
    g.gain.value = [1, 0.23, 0.07][i];
    o.connect(g);
    g.connect(gain);
    o.start(t);
    o.stop(t + 9);
    return o;
  });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, 0.045);
    oscillators.forEach((o) => {
      try {
        o.stop(now + 0.25);
      } catch {}
    });
    setTimeout(() => gain.disconnect(), 400);
  };
}
