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
it("requests real microphone permission before audio initialization and delivers detected C4", async () => {
  const track = { stop: vi.fn() },
    getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  const analyser = {
    fftSize: 4096,
    getFloatTimeDomainData: (data: Float32Array) => {
      for (let i = 0; i < data.length; i++)
        data[i] = 0.12 * Math.sin((2 * Math.PI * 261.625565 * i) / 48000);
    },
  };
  state.context.mockImplementation(async () => {
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    return {
      sampleRate: 48000,
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
  expect(result.current.active).toBe(true);
  for (const time of [100, 140, 180, 220])
    await act(async () => {
      state.frame?.(time);
    });
  expect(received).toHaveBeenCalledWith(60);
  expect(received).toHaveBeenCalledTimes(1);
  act(() => result.current.stop());
  expect(track.stop).toHaveBeenCalled();
  expect(result.current.active).toBe(false);
});
