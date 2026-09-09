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
  rearm: vi.fn(),
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
      rearm: io.rearm,
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
  // Most of these exercise play, not the one-time introduction to the child's piano.
  localStorage.setItem("mahour-tuning", "0");
  io.start.mockClear();
  io.rearm.mockClear();
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
  expect(list.length).toBeGreaterThanOrEqual(100);
  expect((list[0] as HTMLButtonElement).disabled).toBe(false);
  expect((list[1] as HTMLButtonElement).disabled).toBe(true);
});

function frames() {
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    frame = fn;
    return 1;
  });
  return (now: number) => act(async () => void frame?.(now));
}

it("an input that never produces a clear note pauses the round without recording failure", async () => {
  const tick = frames();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const save = vi.fn(),
    props = { onExit: () => {}, onSave: save };
  const { rerender } = render(<RhythmGame {...props} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  io.quality = "unclear";
  rerender(<RhythmGame {...props} />);
  now = 60000; // long past both notes of stage one
  await tick(now);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain("بدون ثبت شکست");
});

it("a quiet room between notes is a missed note, not a cancelled stage", async () => {
  const tick = frames();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const save = vi.fn();
  render(<RhythmGame onExit={() => {}} onSave={save} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  // The child lands the first note, then hesitates; the microphone reads silence, as it should.
  now = firstBeat(0, readSpeed());
  await note(60);
  io.quality = "quiet";
  now = 60000;
  await tick(now);
  expect(screen.queryByText("هیچ صدای واضحی از ساز نرسید")).toBe(null);
  // The stage runs to its end and the attempt is recorded rather than thrown away.
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0].correct).toBe(1);
});

it("a note played during the count-in costs nothing and re-arms the gate for the real attempt", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const { container } = render(
    <RhythmGame onExit={() => {}} onSave={() => {}} />,
  );
  await click("مرحله 1: سلام دو، رِ، می ۱");
  now = 500; // still counting in
  await note(60);
  expect(container.querySelector(".rhythm-game.error")).toBe(null);
  // Without the re-arm the microphone would swallow the identical note struck on the beat.
  expect(io.rearm).toHaveBeenCalled();
  now = firstBeat(0, readSpeed());
  await note(60);
  expect(screen.getByText("۱۰۰")).toBeTruthy();
});

it("the right note in the wrong octave re-bases the keyboard instead of failing the child", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  now = firstBeat(0, readSpeed());
  await note(72); // stage 1 wants middle C; this keyboard's "key 1" is an octave up
  expect(screen.getByText("۱۰۰")).toBeTruthy();
  expect(localStorage.getItem("mahour-tuning")).toBe("12");
  // Only the first note re-bases; a genuinely wrong note afterwards is still wrong.
  now = firstBeat(0, readSpeed()) + 100;
  await note(62);
  expect(screen.getByText("۱۰۰")).toBeTruthy();
});

it("a wrong note says what it heard so a parent can tell a mis-hit from a mis-heard key", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  now = firstBeat(0, readSpeed());
  await note(64);
  expect(screen.getByRole("status").textContent).toContain("می شنیدم");
});

it("the first ever stage stops to learn the child's piano before asking them to play", async () => {
  localStorage.clear();
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  expect(screen.getByText("بیا با پیانوی تو آشنا شوم")).toBeTruthy();
  expect(screen.queryByText("همین‌جا بزن")).toBe(null);
  // Three keys are asked for, and what each one answered is remembered as an offset.
  await note(60);
  await note(64);
  await note(67);
  expect(localStorage.getItem("mahour-tuning")).toBe("0");
  expect(screen.getByRole("status").textContent).toContain("عالی");
});

it("a keyboard whose keys sit an octave down is learned, not fought", async () => {
  localStorage.clear();
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  await note(48);
  await note(52);
  await note(55);
  expect(localStorage.getItem("mahour-tuning")).toBe("-12");
  expect(screen.getByRole("status").textContent).toContain("C3");
});

it("readings that disagree are rejected and asked for again rather than averaged", async () => {
  localStorage.clear();
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  await note(60);
  await note(71); // nothing like the E that was asked for
  await note(67);
  expect(localStorage.getItem("mahour-tuning")).toBe(null);
  expect(screen.getByRole("status").textContent).toContain("یک بار دیگر");
  // and it starts over rather than leaving the child stuck
  await note(60);
  await note(64);
  await note(67);
  expect(localStorage.getItem("mahour-tuning")).toBe("0");
});

it("a learned offset is applied to every note the stage asks for", async () => {
  localStorage.setItem("mahour-tuning", "-12");
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<RhythmGame onExit={() => {}} onSave={() => {}} />);
  await click("مرحله 1: سلام دو، رِ، می ۱");
  now = firstBeat(0, readSpeed());
  await note(48); // middle C on this child's keyboard
  expect(screen.getByText("۱۰۰")).toBeTruthy();
});

it("a song opened from the library goes straight to its falling notes, unlocked", async () => {
  render(
    <RhythmGame
      onExit={() => {}}
      onSave={() => {}}
      openStage="concert-fate"
    />,
  );
  await act(async () => {});
  // The concert stages sit at the very end of the map and are normally locked.
  expect(io.start).toHaveBeenCalled();
  expect(screen.getByText("همین‌جا بزن")).toBeTruthy();
});
