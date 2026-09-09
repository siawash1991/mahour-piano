import { it, vi, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
const state = vi.hoisted(() => ({
  context: vi.fn(),
  frame: null as null | FrameRequestCallback,
}));
vi.mock("../src/audio", () => ({ audioContext: state.context }));
import { useMicrophone } from "../src/tablet/useMicrophone";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
/** Drives the hook's analyser by hand: `amplitude` is the level of a middle-C sine wave. */
async function harness() {
  const track = { stop: vi.fn() },
    getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  let amplitude = 0;
  const analyser = {
    connect:vi.fn(),
    fftSize: 4096,
    getFloatTimeDomainData: (data: Float32Array) => {
      for (let i = 0; i < data.length; i++)
        data[i] = amplitude * Math.sin((2 * Math.PI * 261.625565 * i) / 48000);
    },
  };
  state.context.mockImplementation(async () => {
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    return {
      sampleRate: 48000, state:"running", destination:{}, createGain:()=>({gain:{value:1},connect:vi.fn(),disconnect:vi.fn()}),
      createMediaStreamSource: () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createAnalyser: () => analyser,
    };
  });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    state.frame = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const received = vi.fn(),
    { result } = renderHook(() => useMicrophone(received, () => true));
  await act(async () => {
    await result.current.start();
  });
  let clock = 0;
  /** Advance `frames` analyser reads at the given amplitude, `step` ms apart. */
  const play = async (level: number, frames = 1, step = 40) => {
    amplitude = level;
    for (let i = 0; i < frames; i++) {
      clock += step;
      await act(async () => {
        state.frame?.(clock);
      });
    }
  };
  return { result, received, track, play, getUserMedia };
}

it("requests real microphone permission before audio initialization and delivers detected C4", async () => {
  const { result, received, track, play, getUserMedia } = await harness();
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  expect(result.current.active).toBe(true);
  await play(0, 31); // the calibration window: silence sets the noise floor
  await play(0.0007, 4); // quiet, but previously rejected by the fixed .008 gate
  expect(received).toHaveBeenCalledWith(60);
  expect(received).toHaveBeenCalledTimes(1);
  act(() => result.current.stop());
  expect(track.stop).toHaveBeenCalled();
  expect(result.current.active).toBe(false);
});




it("the same key struck again while it still rings counts as a second note", async () => {
  const { received, play } = await harness();
  await play(0, 31);
  await play(0.02, 2); // first strike
  expect(received).toHaveBeenCalledTimes(1);
  // The note rings on and decays rather than falling silent, then the child strikes it again.
  for (let i = 0; i < 8; i++) await play(0.02 * 0.85 ** (i + 1));
  expect(received).toHaveBeenCalledTimes(1);
  await play(0.02, 2);
  expect(received).toHaveBeenCalledTimes(2);
  expect(received).toHaveBeenLastCalledWith(60);
});

it("a held or decaying note is never reported as a new one", async () => {
  const { received, play } = await harness();
  await play(0, 31);
  await play(0.02, 2);
  expect(received).toHaveBeenCalledTimes(1);
  await play(0.02, 20); // held perfectly steady
  for (let i = 0; i < 25; i++) await play(0.02 * 0.97 ** (i + 1)); // and left to decay
  expect(received).toHaveBeenCalledTimes(1);
});

it("an attack that ramps across several frames is one note, not three", async () => {
  const { received, play } = await harness();
  await play(0, 31);
  // Frames land 40ms apart, so all three fall inside the 110ms lock-out after the first.
  await play(0.008);
  await play(0.016);
  await play(0.024);
  expect(received).toHaveBeenCalledTimes(1);
});

it("re-arming lifts the lock-out that keeps one attack from counting twice", async () => {
  const { result, received, play } = await harness();
  await play(0, 31);
  await play(0.008);
  expect(received).toHaveBeenCalledTimes(1);
  act(() => result.current.rearm());
  await play(0.016); // 40ms later: suppressed by the lock-out, but re-arming cleared it
  expect(received).toHaveBeenCalledTimes(2);
});

it("silence never produces a note however long it lasts", async () => {
  const { received, play } = await harness();
  await play(0, 60);
  expect(received).not.toHaveBeenCalled();
});
