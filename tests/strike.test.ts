import test from "node:test";
import assert from "node:assert/strict";
import {
  harmonics,
  strike,
  strikeThreshold,
  frequency,
  detectPitch,
  LOW_KEY,
  HIGH_KEY,
} from "../src/pitch.ts";
const RATE = 48000,
  N = 2048;
/** A piano-like tone: inharmonic partials that fall away above the fundamental. */
function tone(midi: number, amp: number, n = N) {
  const f0 = frequency(midi),
    B = 0.0004,
    out = new Float32Array(n);
  for (let p = 1; p <= 14; p++) {
    const f = p * f0 * Math.sqrt(1 + B * p * p);
    if (f * 2 >= RATE) break;
    const a = (1 / p ** 1.3) * amp,
      phase = (p * 1.7) % 6.283;
    for (let i = 0; i < n; i++)
      out[i] += a * Math.sin((2 * Math.PI * f * i) / RATE + phase);
  }
  return out;
}
const room = (x: Float32Array, noise = 0.006) =>
  x.map((v) => v + (Math.random() * 2 - 1) * noise);
const together = (...xs: Float32Array[]) =>
  xs[0].map((_, i) => xs.reduce((s, x) => s + x[i], 0));
const rms = (x: Float32Array) => {
  let s = 0;
  for (const v of x) s += v * v;
  return Math.sqrt(s / x.length);
};
const silence = () => room(new Float32Array(N));
/** What the microphone would report for one frame following another. */
const heard = (before: Float32Array, after: Float32Array, sensitivity = 2) =>
  strike(
    harmonics(before, RATE),
    harmonics(after, RATE),
    rms(after),
    strikeThreshold(sensitivity),
  );
const KEYS = [60, 62, 64, 65, 67, 69, 71, 72];
const every = (make: (m: number) => [Float32Array, Float32Array]) =>
  KEYS.map((m) => heard(...make(m)));

test("a note struck into a quiet room is heard, at every key and every volume", () => {
  for (const amp of [0.3, 0.1, 0.03, 0.01])
    assert.deepEqual(
      every((m) => [silence(), room(tone(m, amp))]),
      KEYS,
      `missed at amplitude ${amp}`,
    );
});
test("a note struck while the note before it is still ringing is still heard", () => {
  assert.deepEqual(
    every((m) => [
      room(tone(m - 2, 0.15)),
      room(together(tone(m - 2, 0.13), tone(m, 0.15))),
    ]),
    KEYS,
  );
  // A fifth below rings through the new note's harmonics; the old detector answered with it.
  assert.deepEqual(
    every((m) => [
      room(tone(m - 7, 0.15)),
      room(together(tone(m - 7, 0.13), tone(m, 0.15))),
    ]),
    KEYS,
  );
});
test("a note struck over a held-down sustain pedal is still heard", () => {
  assert.deepEqual(
    every((m) => [
      room(together(tone(m - 2, 0.15), tone(m - 4, 0.12))),
      room(together(tone(m - 2, 0.13), tone(m - 4, 0.1), tone(m, 0.15))),
    ]),
    KEYS,
  );
});
test("the same key struck again while it rings counts as a new note", () => {
  assert.deepEqual(
    every((m) => [room(tone(m, 0.08)), room(tone(m, 0.25))]),
    KEYS,
  );
});
test("a ringing or held note is never mistaken for a new one", () => {
  for (const m of KEYS) {
    assert.equal(heard(room(tone(m, 0.25)), room(tone(m, 0.21))), null, "decay");
    assert.equal(heard(room(tone(m, 0.25)), room(tone(m, 0.25))), null, "held");
  }
});
test("silence and room noise alone are never a note", () => {
  for (let i = 0; i < 20; i++) {
    assert.equal(heard(silence(), silence()), null);
    assert.equal(
      heard(room(new Float32Array(N), 0.02), room(new Float32Array(N), 0.025)),
      null,
    );
  }
});
test("the octave above is not reported for a note that has no fundamental of its own", () => {
  // C4's harmonics land on every one of C5's, so a naive comb hears both.
  for (const m of [60, 65, 67]) assert.equal(heard(silence(), room(tone(m, 0.2))), m);
});
test("the wrong key is reported as the wrong key, not silently forgiven", () => {
  assert.equal(heard(silence(), room(tone(64, 0.2))), 64);
  assert.notEqual(heard(silence(), room(tone(64, 0.2))), 60);
});
test("sensitivity trades reach against false notes, and covers the playable range", () => {
  assert.ok(strikeThreshold(1) > strikeThreshold(6));
  assert.equal(strikeThreshold(2), 0.15);
  for (const m of [LOW_KEY, 60, HIGH_KEY])
    assert.equal(heard(silence(), room(tone(m, 0.2))), m, `key ${m}`);
});
test("the old monophonic detector is why this was needed: it cannot hear through a ringing note", () => {
  const mix = room(together(tone(58, 0.15), tone(60, 0.15)));
  const yin = detectPitch(mix, RATE, 0.0001);
  assert.ok(yin === null || yin.midi !== 60, "YIN was never going to answer this correctly");
  assert.equal(heard(room(tone(58, 0.15)), mix), 60);
});

/** A piano tone `cents` away from concert pitch — no home piano is exactly in tune. */
function offTune(midi: number, cents: number, amp = 0.2, n = 4096) {
  const f0 = frequency(midi) * 2 ** (cents / 1200),
    out = new Float32Array(n);
  for (let p = 1; p <= 14; p++) {
    const f = p * f0 * Math.sqrt(1 + 0.0004 * p * p);
    if (f * 2 >= RATE) break;
    for (let i = 0; i < n; i++)
      out[i] += (amp / p ** 1.3) * Math.sin((2 * Math.PI * f * i) / RATE + p);
  }
  return room(out);
}
test("a note is told apart from the keys either side of it, even out of tune and low down", () => {
  // A semitone near middle C is only ~15Hz wide, so a window short enough for the high notes
  // cannot resolve it. That is what made "do" the note the app kept missing.
  let worst = 1,
    worstAt = "";
  for (const midi of [48, 50, 55, 58, 60, 62, 64, 67, 72, 76, 79])
    for (const cents of [-35, -15, 0, 15, 35]) {
      const comb = harmonics(offTune(midi, cents), RATE);
      const rank = [...comb.total]
        .map((v, i) => ({ midi: LOW_KEY + i, v, f: comb.fundamental[i] }))
        .filter((r) => r.f >= r.v * 0.3)
        .sort((a, b) => b.v - a.v);
      assert.equal(rank[0].midi, midi, `heard ${rank[0].midi} for ${midi} at ${cents} cents`);
      const margin = (rank[0].v - rank[1].v) / rank[0].v;
      if (margin < worst) {
        worst = margin;
        worstAt = `${midi} at ${cents} cents`;
      }
    }
  assert.ok(worst > 0.2, `narrowest win was only ${(worst * 100) | 0}% (${worstAt})`);
});
test("an out-of-tune piano still reports the note that was struck", () => {
  for (const midi of [48, 60, 64, 72, 79])
    for (const cents of [-35, -15, 15, 35]) {
      const x = offTune(midi, cents);
      assert.equal(
        strike(
          { total: new Float32Array(32), fundamental: new Float32Array(32) },
          harmonics(x, RATE),
          rms(x),
          strikeThreshold(2),
        ),
        midi,
        `${midi} at ${cents} cents`,
      );
    }
});
