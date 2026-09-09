import { useRef, useState, useEffect } from "react";
import { audioContext } from "../audio";
import { detectPitch } from "../pitch";
import { NoteGate } from "./model";
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
    node = useRef<MediaStreamAudioSourceNode | null>(null);
  const [active, setActive] = useState(false),
    [level, setLevel] = useState(0),
    [quality, setQuality] = useState<"quiet" | "unclear" | "clear">("quiet");
  const stop = () => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    node.current?.disconnect();
    node.current = null;
    setActive(false);
    setLevel(0);
  };
  const start = async () => {
    stop();
    const id = generation.current;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "این مرورگر به میکروفون دسترسی ندارد. اپ را در Safari یا Chrome و با آدرس HTTPS باز کن.",
      );
    const permission = navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    // Start audio within the same tap as the permission request (Safari activation).
    const readyContext=audioContext().then(ctx=>({ctx,error:null}),error=>({ctx:null,error}));
    const s=await permission;
    if (id !== generation.current) {
      s.getTracks().forEach((t) => t.stop());
      return false;
    }
    stream.current = s;
    s.getTracks().forEach((t) =>
      t.addEventListener?.("ended", () => stop(), { once: true }),
    );
    let ctx: AudioContext;
    try {
      const ready=await readyContext;
      if(!ready.ctx)throw ready.error;
      ctx=ready.ctx;
    } catch (e) {
      stop();
      throw e;
    }
    if (id !== generation.current) {
      s.getTracks().forEach((t) => t.stop());
      return false;
    }
    node.current = ctx.createMediaStreamSource(s);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    node.current.connect(analyser);
    const data = new Float32Array(4096),
      gate = new NoteGate();
    let last = 0;
    setActive(true);
    const read = (now: number) => {
      if (id !== generation.current) return;
      if (now - last >= 35) {
        last = now;
        analyser.getFloatTimeDomainData(data);
        let rms = 0;
        for (const x of data) rms += x * x;
        rms = Math.sqrt(rms / data.length);
        setLevel(Math.min(100, rms * 700));
        if (!allowed.current()) {
          if (rms < 0.008) gate.accept(null, rms);
          setQuality("quiet");
        } else {
          const p = detectPitch(data, ctx.sampleRate);
          setQuality(
            rms < 0.008
              ? "quiet"
              : p && p.confidence >= 0.92
                ? "clear"
                : "unclear",
          );
          const m = gate.accept(p, rms);
          if (m !== null) callback.current(m);
        }
      }
      frame.current = requestAnimationFrame(read);
    };
    frame.current = requestAnimationFrame(read);
    return true;
  };
  useEffect(
    () => () => {
      generation.current++;
      cancelAnimationFrame(frame.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      node.current?.disconnect();
    },
    [],
  );
  return { start, stop, active, level, quality };
}
