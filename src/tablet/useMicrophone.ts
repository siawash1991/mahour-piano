import { useRef, useState, useEffect } from "react";
import { audioContext } from "../audio";
import {
  harmonics,
  strike,
  strikeThreshold,
  ANALYSIS_WINDOW,
  type Comb,
} from "../pitch";
import { noiseFloor, signalThreshold, meter } from "./signal";
export function useMicrophone(
  onNote: (midi: number) => void,
  enabled: () => boolean,
) {
  const callback = useRef(onNote),
    allowed = useRef(enabled);
  callback.current = onNote;
  allowed.current = enabled;
  const stream = useRef<MediaStream | null>(null),
    frame = useRef(0),
    generation = useRef(0),
    node = useRef<MediaStreamAudioSourceNode | null>(null),
    sink = useRef<GainNode | null>(null),
    armed = useRef(0),
    params = useRef({ sensitivity: 2, deviceId: "", automatic: false });
  const [active, setActive] = useState(false),
    [level, setLevel] = useState(0),
    [quality, setQuality] = useState<"quiet" | "unclear" | "clear">("quiet"),
    [calibrating, setCalibrating] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [deviceId, setDevice] = useState(""),
    [sensitivity, setSensitivityState] = useState(2),
    [automatic, setAuto] = useState(false),
    [diagnostic, setDiagnostic] = useState("میکروفون خاموش است"),
    [threshold, setThreshold] = useState(0.0001);
  const stop = () => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    node.current?.disconnect();
    sink.current?.disconnect();
    node.current = null;
    sink.current = null;
    setActive(false);
    setLevel(0);
    setCalibrating(false);
  };
  const start = async () => {
    stop();
    const id = generation.current;
    setDiagnostic("درخواست دسترسی به میکروفون…");
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("میکروفون در این مرورگر در دسترس نیست.");
    const permission = navigator.mediaDevices.getUserMedia({
      audio: {
        ...(params.current.deviceId
          ? { deviceId: { exact: params.current.deviceId } }
          : {}),
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: params.current.automatic,
      },
    });
    const readyContext = audioContext().then(
      (ctx) => ({ ctx, error: null }),
      (error) => ({ ctx: null, error }),
    );
    const s = await permission;
    if (id !== generation.current) {
      s.getTracks().forEach((t) => t.stop());
      return false;
    }
    stream.current = s;
    try {
      const ready = await readyContext;
      if (!ready.ctx) throw ready.error;
      const ctx = ready.ctx;
      if (id !== generation.current) {
        s.getTracks().forEach((t) => t.stop());
        return false;
      }
      node.current = ctx.createMediaStreamSource(s);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = ANALYSIS_WINDOW;
      node.current.connect(analyser);
      // Keep the graph pulled on mobile browsers, without playing microphone audio back.
      sink.current = ctx.createGain();
      sink.current.gain.value = 0;
      analyser.connect(sink.current);
      sink.current.connect(ctx.destination);
      s.getTracks().forEach((t) => {
        t.addEventListener?.(
          "ended",
          () => {
            stop();
            setDiagnostic("اتصال میکروفون قطع شد");
          },
          { once: true },
        );
        t.addEventListener?.("mute", () =>
          setDiagnostic("ورودی توسط دستگاه بی‌صدا شده است"),
        );
      });
      void navigator.mediaDevices
        .enumerateDevices?.()
        .then((list) => {
          if (id === generation.current)
            setDevices(list.filter((d) => d.kind === "audioinput"));
        })
        .catch(() => {});
      const track = s.getAudioTracks?.()[0];
      setDiagnostic(
        track?.label ? "ورودی: " + track.label : "میکروفون متصل است",
      );
      setActive(true);
      setCalibrating(true);
      const data = new Float32Array(ANALYSIS_WINDOW),
        background: number[] = [],
        quiet: Comb = {
          total: new Float32Array(32),
          fundamental: new Float32Array(32),
        };
      let last = 0,
        first: number | null = null,
        noise = 0.0001,
        previous: Comb = quiet;
      const read = (now: number) => {
        if (id !== generation.current) return;
        if (now - last >= 35) {
          last = now;
          first ??= now;
          analyser.getFloatTimeDomainData(data);
          let rms = 0;
          for (const x of data) rms += x * x;
          rms = Math.sqrt(rms / data.length);
          setLevel(meter(rms));
          if (now - first < 1200) {
            background.push(rms);
            setDiagnostic("یک لحظه سکوت؛ صدای محیط را اندازه می‌گیرم.");
          } else {
            // Keep re-measuring the room. Measuring once at the start meant an eager child who
            // played during that second, or a door closing, set a floor too high to hear them
            // for the rest of the stage — with no way back.
            background.push(rms);
            if (background.length > 90) background.shift();
            noise = noiseFloor(background);
            const floor = signalThreshold(noise, params.current.sensitivity);
            setThreshold(floor);
            setCalibrating(false);
            let voiced = false;
            if (rms < floor) {
              // Silence is the reference a note rises out of, so the next frame above the floor
              // is measured against nothing rather than against a stale chord.
              previous = quiet;
              setQuality("quiet");
            } else {
              const current = harmonics(data, ctx.sampleRate);
              for (let i = 0; i < current.total.length; i++)
                if (
                  current.fundamental[i] >= current.total[i] * 0.3 &&
                  current.total[i] > rms * 0.1
                )
                  voiced = true;
              setQuality(voiced ? "clear" : "unclear");
              if (allowed.current() && now - armed.current > 110) {
                const m = strike(
                  previous,
                  current,
                  rms,
                  strikeThreshold(params.current.sensitivity),
                );
                if (m !== null) {
                  armed.current = now;
                  callback.current(m);
                }
              }
              previous = current;
            }
            setDiagnostic(
              ctx.state !== "running"
                ? "پردازش صدا متوقف شده؛ دوباره میکروفون را روشن کن."
                : rms < 0.000001
                  ? "هیچ سیگنالی از این ورودی نمی‌رسد؛ میکروفون دیگری انتخاب کن."
                  : rms < floor
                    ? "صدا خیلی آرام است؛ ساز را نزدیک‌تر یا حساسیت را بیشتر کن."
                    : !voiced
                      ? "صدا دریافت می‌شود، اما نت واضح نیست؛ حالت Piano و بدون افکت."
                      : "صدای نت واضح دریافت می‌شود.",
            );
          }
        }
        frame.current = requestAnimationFrame(read);
      };
      frame.current = requestAnimationFrame(read);
      return true;
    } catch (e) {
      stop();
      throw e;
    }
  };
  const setSensitivity = (n: number) => {
    params.current.sensitivity = n;
    setSensitivityState(n);
  };
  const selectDevice = (id: string) => {
    params.current.deviceId = id;
    setDevice(id);
    stop();
    setDiagnostic("ورودی تغییر کرد؛ میکروفون را دوباره فعال کن.");
  };
  const setAutomatic = (value: boolean) => {
    params.current.automatic = value;
    setAuto(value);
    stop();
    setDiagnostic("تنظیم تغییر کرد؛ میکروفون را دوباره فعال کن.");
  };
  useEffect(
    () => () => {
      generation.current++;
      cancelAnimationFrame(frame.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      node.current?.disconnect();
      sink.current?.disconnect();
    },
    [],
  );
  return {
    start,
    stop,
    /** Drop the short lock-out after a strike, so the very next frame can report a note. */
    rearm: () => (armed.current = 0),
    active,
    level,
    quality,
    calibrating,
    devices,
    deviceId,
    sensitivity,
    setSensitivity,
    selectDevice,
    automatic,
    setAutomatic,
    diagnostic,
    threshold,
  };
}
