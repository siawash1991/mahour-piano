import test from "node:test";
import assert from "node:assert/strict";
import {
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
