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
  quality: "clear",
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
      quality: io.quality,
      level: 40,
    };
  },
}));
import { RhythmGame } from "../src/game/RhythmGame";
import { stages, schedule, readSpeed } from "../src/game/engine";
beforeEach(() => {
  localStorage.clear();
  io.start.mockClear();
  io.quality = "clear";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
  });
}
async function note(m: number) {
  await act(async () => {
    if (io.enabled?.()) io.note?.(m);
  });
}
/** The beat of the first falling note at the currently selected speed. */
const firstBeat = (index: number, speed: number) =>
  schedule(
    stages[index].steps.map((s) => s.beats),
    stages[index].bpm * speed,
  )[0];

it("tapping a stage turns on the microphone and drops straight into play", async () => {
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  expect(io.start).toHaveBeenCalledTimes(1);
  expect(screen.getByText("همین‌جا بزن")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "شروع بازی با ساز من" })).toBe(
    null,
  );
});

it("a refused microphone keeps the child on the setup screen instead of an empty game", async () => {
  io.start.mockImplementationOnce(async () => {
    throw new DOMException("no", "NotAllowedError");
  });
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  expect(screen.queryByText("همین‌جا بزن")).toBe(null);
  expect(screen.getByRole("status").textContent).toContain("رد شده است");
});

it("wrong pitch flashes red and a timed correct pitch flashes green and adds score", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const { container } = render(
    <RhythmGame onExit={() => {}} onSave={() => {}} />,
  );
  await click("مرحله 1: سلام دو، رِ، می ۱");
  now = firstBeat(0, readSpeed());
  await note(62);
  expect(container.querySelector(".rhythm-game.error")).toBeTruthy();
  await note(60);
  expect(container.querySelector(".rhythm-game.success")).toBeTruthy();
  expect(screen.getByText("۱۰۰")).toBeTruthy();
});

it("half speed stretches the schedule and still scores a note played that late", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const { container } = render(
    <RhythmGame onExit={() => {}} onSave={() => {}} />,
  );
  await click("۵۰٪");
  await click("مرحله 1: سلام دو، رِ، می ۱");
  // 300ms off the beat is only "good" at full speed, but the widened window still counts it.
  now = firstBeat(0, 0.5) + 300;
  await note(60);
  expect(container.querySelector(".rhythm-game.success")).toBeTruthy();
  expect(screen.getByText("۱۰۰")).toBeTruthy();
  cleanup();
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  expect(
    (screen.getByRole("button", { name: "۵۰٪" }) as HTMLButtonElement)
      .ariaPressed,
  ).toBe("true");
});

it("later stages remain locked without a passing score", () => {
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  const list = screen.getAllByRole("button", { name: /مرحله / });
  expect(list.length).toBe(100);
  expect((list[0] as HTMLButtonElement).disabled).toBe(false);
  expect((list[1] as HTMLButtonElement).disabled).toBe(true);
});

it("uncertain input pauses a round without recording failure", async () => {
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    frame = fn;
    return 1;
  });
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const save = vi.fn(),
    props = { onExit: () => {}, onSave: save };
  const { rerender } = render(<RhythmGame {...props} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  io.quality = "unclear";
  rerender(<RhythmGame {...props} />);
  now = firstBeat(0, readSpeed()) + 2000;
  await act(async () => {
    frame?.(now);
  });
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain("بدون ثبت شکست");
});
