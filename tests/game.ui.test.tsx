import React from "react";
import { it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
const io = vi.hoisted(() => ({
  start: vi.fn(async () => true),
  stop: vi.fn(),
  note: null as null | ((m: number) => void),
  enabled: null as null | (() => boolean),
}));
vi.mock("../src/tablet/useMicrophone", () => ({
  useMicrophone: (n: (m: number) => void, e: () => boolean) => {
    io.note = n;
    io.enabled = e;
    return {
      start: io.start,
      stop: io.stop,
      active: true,
      quality: "clear",
      level: 40,
    };
  },
}));
import { RhythmGame } from "../src/game/RhythmGame";
beforeEach(() => {
  localStorage.clear();
  io.start.mockClear();
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
async function note(m: number) {
  await act(async () => {
    if (io.enabled?.()) io.note?.(m);
  });
}
it("every stage requests microphone and requires a heard C before starting", async () => {
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: دو را پیدا کن");
  expect(io.start).toHaveBeenCalledTimes(1);
  expect(
    (
      screen.getByRole("button", {
        name: "شروع بازی با ساز من",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await note(60);
  expect(
    (
      screen.getByRole("button", {
        name: "شروع بازی با ساز من",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
it("wrong pitch flashes red and a timed correct pitch flashes green and adds score", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const { container } = render(
    <RhythmGame onExit={() => {}} onSave={() => {}} />,
  );
  await click("مرحله 1: دو را پیدا کن");
  await note(60);
  await click("شروع بازی با ساز من");
  now = 3200;
  await note(62);
  expect(container.querySelector(".rhythm-game.error")).toBeTruthy();
  await note(60);
  expect(container.querySelector(".rhythm-game.success")).toBeTruthy();
  expect(screen.getByText("۱۰۰")).toBeTruthy();
});
it("later stages remain locked without a passing score", () => {
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  const stages = screen.getAllByRole("button", { name: /مرحله / });
  expect((stages[0] as HTMLButtonElement).disabled).toBe(false);
  expect((stages[1] as HTMLButtonElement).disabled).toBe(true);
});
