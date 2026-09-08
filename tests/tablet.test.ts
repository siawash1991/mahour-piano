import test from "node:test";
import assert from "node:assert/strict";
import {
  NoteGate,
  transpose,
  keyFor,
  chunks,
  tabletLessons,
  validBase,
} from "../src/tablet/model.ts";
test("all tablet material fits eight white keys and supported octave transposition", () => {
  for (const lesson of tabletLessons)
    for (const s of lesson.steps) {
      assert.ok(keyFor(s.midi) >= 1 && keyFor(s.midi) <= 8);
      for (const base of [48, 60, 72])
        assert.equal(transpose(s.midi, base) - base, s.midi - 60);
    }
  assert.equal(validBase(61), false);
});
test("chunking never drops or duplicates a note", () => {
  for (const l of tabletLessons) {
    const c = chunks(l.steps);
    assert.deepEqual(c.flat(), l.steps);
    assert.ok(c.every((x) => x.length > 0 && x.length <= 4));
  }
});
test("unstable and low-confidence sound never produces a wrong-note candidate", () => {
  const gate = new NoteGate();
  for (let i = 0; i < 30; i++)
    assert.equal(gate.accept({ midi: 60, confidence: 0.8 }, 0.1), null);
  for (let i = 0; i < 30; i++)
    assert.equal(
      gate.accept({ midi: i % 2 ? 60 : 72, confidence: 0.99 }, 0.1),
      null,
    );
});
test("held notes count once and silence rearms repeated attacks", () => {
  const gate = new NoteGate(),
    p = { midi: 60, confidence: 0.99 };
  assert.equal(gate.accept(p, 0.1), null);
  assert.equal(gate.accept(p, 0.1), null);
  assert.equal(gate.accept(p, 0.1), 60);
  for (let i = 0; i < 30; i++) assert.equal(gate.accept(p, 0.1), null);
  for (let i = 0; i < 3; i++) gate.accept(null, 0);
  gate.accept(p, 0.1);
  gate.accept(p, 0.1);
  assert.equal(gate.accept(p, 0.1), 60);
});
