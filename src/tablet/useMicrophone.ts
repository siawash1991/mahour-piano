import { useRef, useState, useEffect } from "react";
import { audioContext } from "../audio";
import { detectPitch } from "../pitch";
import { NoteGate } from "./model";
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
    gate = useRef(new NoteGate()),
    params = useRef({ sensitivity: 2, deviceId: "", automatic: true });
  const [active, setActive] = useState(false),
    [level, setLevel] = useState(0),
    [quality, setQuality] = useState<"quiet" | "unclear" | "clear">("quiet"),
    [calibrating, setCalibrating] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [deviceId, setDevice] = useState(""),
    [sensitivity, setSensitivityState] = useState(2),
    [automatic, setAuto] = useState(true),
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
      analyser.fftSize = 4096;
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
      const data = new Float32Array(4096),
        background: number[] = [];
      gate.current.reset();
      let last = 0,
        first: number | null = null,
        noise = 0.0001,
        lastAttack = -1000,
        envelope = 0;
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
            noise = noiseFloor(background);
            const floor = signalThreshold(noise, params.current.sensitivity);
            setThreshold(floor);
            setCalibrating(false);
            const p = detectPitch(data, ctx.sampleRate, floor);
            setQuality(
              rms < floor
                ? "quiet"
                : p && p.confidence >= 0.88
                  ? "clear"
                  : "unclear",
            );
            setDiagnostic(
              ctx.state !== "running"
                ? "پردازش صدا متوقف شده؛ دوباره میکروفون را روشن کن."
                : rms < 0.000001
                  ? "هیچ سیگنالی از این ورودی نمی‌رسد؛ میکروفون دیگری انتخاب کن."
                  : rms < floor
                    ? "صدا خیلی آرام است؛ ساز را نزدیک‌تر یا حساسیت را بیشتر کن."
                    : !p
                      ? "صدا دریافت می‌شود، اما نت واضح نیست؛ حالت Piano و بدون افکت."
                      : "صدای نت واضح دریافت می‌شود.",
            );
            if (!allowed.current()) {
              if (rms < floor) gate.current.accept(null, rms, floor, 0.88);
            } else {
              // A struck key rises above the decaying tail of the one before it. Measuring the
              // rise against a slow-release peak — not against the single previous frame — is
              // what lets the same note, played twice in a row, register twice.
              if (
                p &&
                rms > Math.max(floor * 1.5, envelope * 1.4) &&
                now - lastAttack > 110
              ) {
                gate.current.reset();
                lastAttack = now;
              }
              const m = gate.current.accept(p, rms, floor, 0.88);
              if (m !== null) callback.current(m);
            }
            envelope = Math.max(rms, envelope * 0.9);
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
    /** Forget the last note heard, so an identical note struck next still counts. */
    rearm: () => gate.current.reset(),
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
