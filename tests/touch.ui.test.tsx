import React from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
const io = vi.hoisted(() => ({
  start: vi.fn(),
  release: vi.fn(),
  tone: vi.fn(),
}));
vi.mock("../src/tablet/useMicrophone", () => ({
  useMicrophone: () => ({
    start: io.start,
    stop: () => {},
    active: false,
    quality: "quiet",
    rearm: () => {},
  }),
}));
vi.mock("../src/audio", () => ({
  audioContext: vi.fn(async () => ({})),
  startPianoNote: io.tone,
}));
import { RhythmGame } from "../src/game/RhythmGame";
import { TouchPiano } from "../src/game/TouchPiano";
import { stages, schedule, readSpeed } from "../src/game/engine";
beforeEach(() => {
  localStorage.clear();
  io.start.mockClear();
  io.release.mockClear();
  io.tone.mockReset().mockResolvedValue(io.release);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
  });
}
it("new player starts and scores from touch without permission or calibration", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  expect(io.start).not.toHaveBeenCalled();
  expect(screen.queryByText("بیا با پیانوی تو آشنا شوم")).toBeNull();
  now = schedule(
    stages[0].steps.map((s) => s.beats),
    stages[0].bpm * readSpeed(),
  )[0];
  await click("کلید C4");
  expect(screen.getByText("۱۰۰")).toBeTruthy();
  expect(io.tone).toHaveBeenCalledWith(60);
});
it("sounding keys stop on leaving exercise and repeated down is not duplicated", async () => {
  const note = vi.fn(),
    { unmount } = render(
      <TouchPiano steps={stages[0].steps} onNote={note} onError={() => {}} />,
    );
  fireEvent.keyDown(window, { key: "a", code: "KeyA" });
  fireEvent.keyDown(window, { key: "a", code: "KeyA", repeat: true });
  await act(async () => {});
  expect(note).toHaveBeenCalledTimes(1);
  unmount();
  expect(io.release).toHaveBeenCalledTimes(1);
});
it("touch attempts finish and are stored as screen input", async () => {
  let now = 0;
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    frame = fn;
    return 1;
  });
  const save = vi.fn();
  render(<RhythmGame onExit={() => {}} onSave={save} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  const times = schedule(
    stages[0].steps.map((s) => s.beats),
    stages[0].bpm * readSpeed(),
  );
  const names = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  for (let i = 0; i < times.length; i++) {
    now = times[i];
    const m = stages[0].steps[i].midi;
    await click("کلید " + names[m % 12] + (Math.floor(m / 12) - 1));
    await new Promise((r) => setTimeout(r, 270));
  }
  now = times.at(-1)! + 600;
  await act(async () => {
    frame?.(now);
  });
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      source: "screen",
      correct: times.length,
      accuracy: 100,
    }),
  );
  expect(io.start).not.toHaveBeenCalled();
});
it("two held keys release independently and re-striking scores again", async () => {
  const releases = [vi.fn(), vi.fn(), vi.fn()];
  io.tone.mockImplementation(
    async () => releases[io.tone.mock.calls.length - 1],
  );
  const notes = vi.fn();
  render(
    <TouchPiano steps={stages[0].steps} onNote={notes} onError={() => {}} />,
  );
  fireEvent.keyDown(window, { key: "a", code: "KeyA" });
  fireEvent.keyDown(window, { key: "s", code: "KeyS" });
  await act(async () => {});
  expect(notes.mock.calls.map((c) => c[0])).toEqual([60, 62]);
  fireEvent.keyUp(window, { key: "a", code: "KeyA" });
  expect(releases[0]).toHaveBeenCalledTimes(1);
  expect(releases[1]).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "a", code: "KeyA" });
  await act(async () => {});
  expect(notes).toHaveBeenCalledTimes(3);
  fireEvent.blur(window);
  expect(releases[1]).toHaveBeenCalledTimes(1);
  expect(releases[2]).toHaveBeenCalledTimes(1);
});
