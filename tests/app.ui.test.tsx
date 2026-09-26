import React from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
vi.mock("../src/tablet/useMicrophone", () => ({
  useMicrophone: () => ({ start: vi.fn(), stop: () => {}, active: false, quality: "quiet", rearm: () => {} }),
}));
vi.mock("../src/audio", () => ({
  audioContext: vi.fn(async () => ({})),
  startPianoNote: vi.fn(async () => () => {}),
  playNote: vi.fn(async () => {}),
  tick: vi.fn(async () => {}),
}));
import { App } from "../src/main";
import { harpStages } from "../src/harmonica/harp";
import { schedule, readSpeed } from "../src/game/engine";
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const click = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
  });

it("parent panel opens from the game and returns to the child's instrument", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "🎵 سازدهنی" }));
  await click("بخش والدین");
  expect(screen.getByRole("heading", { name: "پنل والدین" })).toBeTruthy();
  expect(screen.getByText("روزهای تمرین این هفته")).toBeTruthy();
  await click("بازگشت به آموزش کودک");
  expect(screen.getByRole("heading", { name: "سازدهنی دو (C) 🎵" })).toBeTruthy();
});

it("touch harmonica: wait mode checks each hole and saves a star", async () => {
  let now = 0,
    frame: FrameRequestCallback | undefined;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    frame = fn;
    return 1;
  });
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "🎵 سازدهنی" }));
  await click("سازدهنی لمسی · بدون میکروفون");
  await click("مرحله 1: سوراخ ۴: فوت و مک");
  await click("آروم با من");
  const s = harpStages[0],
    times = schedule(s.steps.map((x) => x.beats), s.bpm * readSpeed());
  const pad = (hole: number, blow: boolean) =>
    act(async () => {
      fireEvent.pointerDown(screen.getByRole("button", { name: `سوراخ ${hole} ${blow ? "فوت" : "مک"}` }));
    });
  now = times[0];
  await pad(4, false);
  expect(screen.getByRole("status").textContent).toContain("سوراخ ۴ فوت را بزن");
  for (let i = 0; i < times.length; i++) {
    now = times[i];
    await pad(4, s.steps[i].blow);
  }
  now = times.at(-1)! + 600;
  await act(async () => frame?.(now));
  expect(screen.getByText("آفرین! یادش گرفتی 🎉")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem("mahour-harp")!)["harp-4"].stars).toBe(1);
  expect(JSON.parse(localStorage.getItem("mahour-attempts")!)[0]).toMatchObject({ id: "harp-4", wrong: 1 });
});
