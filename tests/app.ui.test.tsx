import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
vi.mock("../src/audio", () => ({
  audioContext: vi.fn(async () => ({})),
  playNote: vi.fn(async () => {}),
  tick: vi.fn(async () => {}),
}));
import { App } from "../src/main";
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
  });
}
async function key(name: string) {
  await new Promise((r) => setTimeout(r, 100));
  await click(name);
}
beforeEach(() => localStorage.clear());
afterEach(cleanup);
describe("practice flows", () => {
  it("records wrong notes, completes first lesson and persists report", async () => {
    render(<App />);
    await click("بریم تمرین کنیم");
    await click("شروع تمرین");
    await key("D4");
    expect(screen.getByRole("status").textContent).toContain("رِ شنیدم");
    for (let i = 0; i < 4; i++) await key("C4");
    expect(screen.getByText("یک قدم جلوتر رفتی!")).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem("mahour-attempts")!);
    expect(saved[0]).toMatchObject({
      id: "hello",
      correct: 4,
      wrong: 1,
      accuracy: 80,
      source: "screen",
      partial: false,
    });
    await click("گزارش تمرین");
    expect(screen.getByText("روی صفحه")).toBeTruthy();
  });
  it("partial practice does not mark the entire lesson complete", async () => {
    render(<App />);
    await click("بریم تمرین کنیم");
    fireEvent.change(
      screen.getByRole("combobox", { name: "انتخاب بخش تمرین" }),
      { target: { value: "0" } },
    );
    await click("شروع تمرین");
    for (let i = 0; i < 4; i++) await key("C4");
    expect(
      JSON.parse(localStorage.getItem("mahour-attempts")!)[0].partial,
    ).toBe(true);
    expect(screen.getByText("۰ تمرین کامل")).toBeTruthy();
  });
  it("demo never adds progress, and stops on navigation", async () => {
    vi.useFakeTimers();
    render(<App />);
    await click("بریم تمرین کنیم");
    await click("اول گوش بده");
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(localStorage.getItem("mahour-attempts")).toBeNull();
    expect(screen.getByRole("button", { name: "شروع تمرین" })).toBeTruthy();
    vi.useRealTimers();
  });
  it("microphone rejection gives recoverable feedback", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException("denied", "NotAllowedError")),
      },
    });
    render(<App />);
    await click("بریم تمرین کنیم");
    fireEvent.change(screen.getByRole("combobox", { name: "ورودی" }), {
      target: { value: "mic" },
    });
    await click("شروع تمرین");
    expect(screen.getByRole("status").textContent).toContain(
      "اجازهٔ میکروفون داده نشد",
    );
    expect(screen.getByRole("button", { name: "شروع تمرین" })).toBeTruthy();
  });

  it("MIDI groups require both expected notes before advancing", async () => {
    const input: { onmidimessage: ((e: { data: Uint8Array }) => void) | null } =
      { onmidimessage: null };
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: vi.fn(async () => ({
        inputs: new Map([["piano", input]]),
        onstatechange: null,
      })),
    });
    render(<App />);
    await click("مسیر یادگیری");
    await act(async () => {
      fireEvent.click(screen.getByText("با هم، در یک لحظه").closest("button")!);
    });
    await click("اتصال پیانوی MIDI");
    await click("شروع تمرین");
    const send = async (m: number) => {
      await act(async () => {
        input.onmidimessage?.({ data: new Uint8Array([144, m, 90]) });
      });
    };
    await send(60);
    expect(screen.getByText("۰ از ۴ نت")).toBeTruthy();
    await send(48);
    expect(screen.getByText("۱ از ۴ نت")).toBeTruthy();
    for (const m of [64, 67, 64]) {
      await send(m);
      await send(48);
    }
    expect(
      JSON.parse(localStorage.getItem("mahour-attempts")!)[0],
    ).toMatchObject({ source: "midi", correct: 4, accuracy: 100 });
  });
  it("loads saved progress after remount", () => {
    localStorage.setItem(
      "mahour-attempts",
      JSON.stringify([
        {
          id: "hello",
          at: new Date().toISOString(),
          accuracy: 100,
          correct: 4,
          wrong: 0,
          seconds: 9,
          source: "screen",
          partial: false,
          mode: "wait",
          rhythm: null,
        },
      ]),
    );
    render(<App />);
    expect(screen.getByText("۱ تمرین کامل")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "سه دوست کنار هم" }),
    ).toBeTruthy();
  });
});
