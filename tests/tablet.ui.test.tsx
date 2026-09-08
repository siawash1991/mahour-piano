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
  note: null as null | ((m: number) => void),
  enabled: null as null | (() => boolean),
  start: vi.fn(async () => true),
  stop: vi.fn(),
}));
vi.mock("../src/tablet/useMicrophone", () => ({
  useMicrophone: (note: (m: number) => void, enabled: () => boolean) => {
    io.note = note;
    io.enabled = enabled;
    return {
      start: io.start,
      stop: io.stop,
      active: false,
      level: 0,
      quality: "quiet",
    };
  },
}));
vi.mock("../src/audio", () => ({
  audioContext: vi.fn(async () => ({})),
  playNote: vi.fn(async () => {}),
}));
vi.mock("../src/tablet/voice", () => ({
  speakClip: vi.fn(async () => true),
  stopVoice: vi.fn(),
}));
import { TabletStudio } from "../src/tablet/TabletStudio";
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
  });
}
async function note(m: number) {
  await act(async () => {
    if (io.enabled?.()) io.note?.(m);
  });
}
async function setup() {
  await click("خاموش کردن راهنمای صوتی");
  await click("میکروفون را بررسی کن");
  await note(48);
  await note(48);
  await note(48);
  await click("برچسب‌ها آماده‌اند؛ بریم!");
}
beforeEach(() => {
  localStorage.clear();
  io.start.mockReset().mockResolvedValue(true);
  io.stop.mockClear();
});
afterEach(cleanup);
it("calibrates C3 and transposes numbered practice without accepting C4", async () => {
  const save = vi.fn();
  render(<TabletStudio onExit={() => {}} onSave={save} />);
  await setup();
  expect(localStorage.getItem("mahour-keyboard-base")).toBe("48");
  await click("حالا من می‌زنم");
  await note(60);
  expect(screen.getByRole("status").textContent).toContain("این یکی نبود");
  for (let i = 0; i < 4; i++) await note(48);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "hello",
      baseMidi: 48,
      wrong: 1,
      correct: 4,
      partial: true,
    }),
  );
  expect(
    screen.getByRole("button", { name: "حالا از اول تا آخر" }),
  ).toBeTruthy();
});
it("full performance is recorded separately from chunk practice", async () => {
  const save = vi.fn();
  render(<TabletStudio onExit={() => {}} onSave={save} />);
  await setup();
  await click("حالا من می‌زنم");
  for (let i = 0; i < 4; i++) await note(48);
  await click("حالا از اول تا آخر");
  await click("حالا من می‌زنم");
  for (let i = 0; i < 4; i++) await note(48);
  expect(save.mock.calls[0][0].partial).toBe(true);
  expect(save.mock.calls[1][0].partial).toBe(false);
});
it("stopping practice prevents late microphone events and unearned completion", async () => {
  const save = vi.fn();
  render(<TabletStudio onExit={() => {}} onSave={save} />);
  await setup();
  await click("حالا من می‌زنم");
  await note(48);
  await click("یک کم استراحت");
  for (let i = 0; i < 5; i++) await note(48);
  expect(save).not.toHaveBeenCalled();
  expect(io.stop).toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "شروع دوبارهٔ این تکه" }),
  ).toBeTruthy();
});
it("calibration failure stays recoverable and does not save a mapping", async () => {
  io.start.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  render(<TabletStudio onExit={() => {}} onSave={() => {}} />);
  await click("خاموش کردن راهنمای صوتی");
  await click("میکروفون را بررسی کن");
  expect(screen.getByRole("status").textContent).toContain(
    "اجازهٔ میکروفون داده نشد",
  );
  expect(localStorage.getItem("mahour-keyboard-base")).toBeNull();
});
