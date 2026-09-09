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
  /** Advance `frames` analyser reads at the given amplitude, 40ms apart. */
  const play = async (level: number, frames = 1) => {
    amplitude = level;
    for (let i = 0; i < frames; i++) {
      clock += 40;
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

it("the same note struck twice counts twice, even when the first is still ringing", async () => {
  const { received, play } = await harness();
  await play(0, 31);
  await play(0.02, 4); // first strike
  expect(received).toHaveBeenCalledTimes(1);
  // A keyboard note decays slowly rather than falling silent between strikes, so comparing a
  // frame against the one 40ms before it never sees a rise steep enough to call a new attack.
  for (let i = 0; i < 12; i++) await play(0.02 * 0.97 ** (i + 1));
  expect(received).toHaveBeenCalledTimes(1);
  await play(0.02, 4); // second strike of the very same key
  expect(received).toHaveBeenCalledTimes(2);
  expect(received).toHaveBeenLastCalledWith(60);
});

it("a held note is not mistaken for a second strike", async () => {
  const { received, play } = await harness();
  await play(0, 31);
  await play(0.02, 4);
  expect(received).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 40; i++) await play(0.02 * 0.97 ** (i + 1));
  expect(received).toHaveBeenCalledTimes(1);
});

it("re-arming makes the microphone report an identical note again", async () => {
  const { result, received, play } = await harness();
  await play(0, 31);
  await play(0.02, 4);
  expect(received).toHaveBeenCalledTimes(1);
  act(() => result.current.rearm());
  await play(0.02, 3);
  expect(received).toHaveBeenCalledTimes(2);
});
