import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOW, DRAW, holeFor, tab, harpStages, DRILLS } from "../src/harmonica/harp.ts";
import { detectPitch, frequency } from "../src/pitch.ts";

test("C harmonica is Richter tuned from middle C", () => {
  assert.deepEqual(BLOW.slice(0, 4), [60, 64, 67, 72]);
  assert.deepEqual(DRAW.slice(3, 7), [74, 77, 81, 83]);
  // Holes 4–7 are a full C major scale.
  assert.deepEqual(tab("4 -4 5 -5 6 -6 -7 7").map((s) => s.midi), [72, 74, 76, 77, 79, 81, 83, 84]);
  assert.deepEqual(holeFor(67), { hole: 3, blow: true }); // G4 is 3 blow (also 2 draw)
  assert.equal(holeFor(61), null);
});

test("every stage step is a playable hole and songs are available", () => {
  assert.ok(harpStages.length > DRILLS + 5);
  for (const s of harpStages)
    for (const st of s.steps) {
      const h = holeFor(st.midi)!;
      assert.equal((st.blow ? BLOW : DRAW)[st.hole - 1], st.midi, s.id);
      assert.ok(h, s.id);
    }
  const mary = harpStages.find((s) => s.id === "harp-song-mary")!;
  assert.deepEqual(
    mary.steps.slice(0, 7).map((s) => (s.blow ? "" : "-") + s.hole),
    ["5", "-4", "4", "-4", "5", "5", "5"],
  );
});

test("pitch detector hears reed-like tones across the harmonica range", () => {
  const rate = 48000;
  for (const midi of [60, 72, 84, 93]) {
    const f = frequency(midi),
      x = new Float32Array(2048);
    // A reed: strong fundamental with bright harmonics.
    for (let i = 0; i < x.length; i++)
      x[i] = [1, 0.6, 0.4, 0.25].reduce((n, a, h) => n + 0.05 * a * Math.sin((2 * Math.PI * f * (h + 1) * i) / rate), 0);
    assert.equal(detectPitch(x, rate, 0, 2000, 240)?.midi, midi, "midi " + midi);
  }
});
