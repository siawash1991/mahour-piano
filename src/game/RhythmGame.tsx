import { useEffect, useRef, useState } from "react";
import {
  Mic,
  ArrowRight,
  Play,
  RotateCcw,
  Check,
  Lock,
  Pause,
  Gauge,
  Settings,
} from "lucide-react";
import { useMicrophone } from "../tablet/useMicrophone";
import {
  readTuning,
  saveTuning,
  resolve,
  TUNING_KEYS,
} from "./tuning";
import { fa, noteName, western } from "../curriculum";
import { FantasyIcon } from "../tablet/TabletStudio";
import {
  stages,
  worldList,
  schedule,
  stars,
  tolerance,
  windowFor,
  PERFECT,
  match,
  speeds,
  readSpeed,
  saveSpeed,
  lead,
  board,
  keyLabel,
  type Stage,
  type Key,
} from "./engine";
import type { Attempt } from "../storage";
import "./game.css";
type RecordMap = Record<string, { score: number; stars: number }>;
function load(): RecordMap {
  try {
    const value = JSON.parse(localStorage.getItem("mahour-game") || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, r]) =>
          r &&
          typeof r === "object" &&
          typeof (r as { score?: unknown }).score === "number" &&
          typeof (r as { stars?: unknown }).stars === "number",
      ),
    ) as RecordMap;
  } catch {
    return {};
  }
}
const percent = (s: number) => fa(Math.round(s * 100)) + "٪";
export function RhythmGame({
  onExit,
  onSave,
}: {
  onExit: () => void;
  onSave: (a: Attempt) => void;
}) {
  const [screen, setScreen] = useState<
      "map" | "tune" | "ready" | "play" | "result"
    >("map"),
    [selected, setSelected] = useState(0),
    [records, setRecords] = useState(load),
    [offset, setOffset] = useState(() => readTuning() ?? 0),
    [tuned, setTuned] = useState(() => readTuning() !== null),
    [asked, setAsked] = useState(0),
    [replies, setReplies] = useState<number[]>([]),
    [speed, setSpeedState] = useState(readSpeed),
    [status, setStatus] = useState("روی هر مرحله بزن؛ بازی خودش شروع می‌شود."),
    [heard, setHeard] = useState<number | null>(null),
    [time, setTime] = useState(0),
    [feedback, setFeedback] = useState(""),
    [flash, setFlash] = useState(""),
    [score, setScore] = useState(0),
    [hits, setHits] = useState(0),
    [combo, setCombo] = useState(0),
    [resolved, setResolved] = useState<Set<number>>(new Set());
  const live = useRef(false),
    listening = useRef(false),
    epoch = useRef(0),
    clock = useRef(0),
    start = useRef(0),
    done = useRef(new Set<number>()),
    hit = useRef(0),
    points = useRef(0),
    streak = useRef(0),
    errors = useRef(0),
    clear = useRef(false),
    tuning = useRef(false),
    answers = useRef<number[]>([]),
    flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    handler = useRef<(m: number) => void>(() => {}),
    resume = useRef<HTMLButtonElement | null>(null);
  /** The run in flight: fixed at the moment play starts, so a stale render cannot retime it. */
  const run = useRef<{
    stage: Stage;
    times: number[];
    tol: number;
    keys: Key[];
  }>({ stage: stages[0], times: [], tol: 1, keys: board(stages[0].steps) });
  const stage = stages[selected];
  const mic = useMicrophone(
    (m) => handler.current(m),
    () => live.current || listening.current || tuning.current,
  );
  const signal = useRef(mic.quality);
  signal.current = mic.quality;
  const pulse = (good: boolean, text: string) => {
    setFlash(good ? "success" : "error");
    setFeedback(text);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 450);
  };
  const stop = () => {
    epoch.current++;
    live.current = false;
    listening.current = false;
    tuning.current = false;
    cancelAnimationFrame(clock.current);
    mic.stop();
  };
  const setSpeed = (n: number) => {
    setSpeedState(n);
    saveSpeed(n);
  };
  const finish = () => {
    const { stage: s } = run.current;
    live.current = false;
    mic.stop();
    cancelAnimationFrame(clock.current);
    setScreen("result");
    const n = stars(hit.current, s.steps.length);
    const next = {
      ...records,
      [s.id]: {
        score: Math.max(points.current, records[s.id]?.score || 0),
        stars: Math.max(n, records[s.id]?.stars || 0),
      },
    };
    setRecords(next);
    try {
      localStorage.setItem("mahour-game", JSON.stringify(next));
    } catch {
      setStatus("ذخیره‌سازی مرورگر بسته است؛ نتیجه فقط تا بستن صفحه می‌ماند.");
    }
    onSave({
      id: s.id,
      at: new Date().toISOString(),
      correct: hit.current,
      wrong: errors.current,
      accuracy: Math.round((hit.current / s.steps.length) * 100),
      seconds: Math.round((performance.now() - start.current) / 1000),
      source: "mic",
      partial: false,
      mode: "falling-notes",
      rhythm: Math.round((hit.current / s.steps.length) * 100),
      baseMidi: 60 + offset,
    });
  };
  /** Turn the microphone on. Returns false when the browser or the parent said no. */
  const connect = async () => {
    stop();
    setHeard(null);
    const token = epoch.current;
    setStatus("منتظر اجازهٔ میکروفون…");
    try {
      const ok = await mic.start();
      if (!ok || token !== epoch.current) return false;
      setStatus("میکروفون روشن است.");
      return true;
    } catch (e) {
      setStatus(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "دسترسی میکروفون رد شده است. کنار آدرس سایت، اجازهٔ Microphone را روشن کن. اگر داخل مرورگر برنامه هستی، لینک را در Chrome یا Safari باز کن."
          : "میکروفون فعال نشد. سایت را در Chrome یا Safari با HTTPS باز کن و دستگاه ورودی را بررسی کن.",
      );
      return false;
    }
  };
  /** Ask the child to play three keys, and learn what this particular piano answers with. */
  const tune = async () => {
    stop();
    setScreen("tune");
    answers.current = [];
    setReplies([]);
    setAsked(0);
    setStatus("");
    if (await connect()) {
      tuning.current = true;
      setStatus("آماده‌ام. کلید را آرام بزن و بگذار صدایش تمام شود.");
    }
  };
  const begin = (index = selected) => {
    const s = stages[index];
    const tol = tolerance(speed),
      window = windowFor(tol);
    const times = schedule(
      s.steps.map((step) => step.beats),
      s.bpm * speed,
    );
    run.current = { stage: s, times, tol, keys: board(s.steps) };
    clear.current = false;
    listening.current = false;
    done.current = new Set();
    hit.current = 0;
    points.current = 0;
    streak.current = 0;
    errors.current = 0;
    setScore(0);
    setHits(0);
    setCombo(0);
    setResolved(new Set());
    setTime(0);
    setFeedback("وقتی شماره به خط طلایی رسید، روی ساز بزن");
    setFlash("");
    start.current = performance.now();
    live.current = true;
    setScreen("play");
    const deaf = Math.min(3, times.length);
    const frame = () => {
      if (!live.current) return;
      const elapsed = performance.now() - start.current;
      setTime(elapsed);
      if (signal.current === "clear") clear.current = true;
      times.forEach((at, i) => {
        if (elapsed > at + window && !done.current.has(i)) {
          done.current.add(i);
          errors.current++;
          streak.current = 0;
          setCombo(0);
          setResolved(new Set(done.current));
          pulse(false, "این نت جا ماند؛ بعدی را بگیر!");
        }
      });
      // Bail out only for an input that has never once produced a clear note — silence between
      // notes is normal, and a child who hesitates deserves a missed note, not a cancelled stage.
      if (!clear.current && done.current.size >= deaf) {
        stop();
        setScreen("ready");
        setHeard(null);
        setStatus(
          "هیچ صدای واضحی از ساز نرسید؛ بازی بدون ثبت شکست متوقف شد. ورودی و حساسیت را بررسی کن و دوباره شروع کن.",
        );
        return;
      }
      if (
        done.current.size === times.length &&
        elapsed > times[times.length - 1] + 500
      ) {
        finish();
        return;
      }
      clock.current = requestAnimationFrame(frame);
    };
    clock.current = requestAnimationFrame(frame);
  };
  handler.current = (m) => {
    setHeard(m);
    clear.current = true;
    if (tuning.current) {
      const next = [...answers.current, m];
      answers.current = next;
      setReplies(next);
      if (next.length < TUNING_KEYS.length) {
        setAsked(next.length);
        return;
      }
      tuning.current = false;
      const learned = resolve(TUNING_KEYS, next);
      if (learned === null) {
        answers.current = [];
        setReplies([]);
        setAsked(0);
        tuning.current = true;
        setStatus(
          "نت‌هایی که شنیدم با هم نمی‌خوانند. یک بار دیگر، آرام و تک‌تک بزن.",
        );
        return;
      }
      setOffset(learned);
      saveTuning(learned);
      setTuned(true);
      setStatus(
        learned === 0
          ? "عالی! پیانوی تو دقیقاً همان‌جایی است که انتظار داشتم."
          : `یاد گرفتم! کلید ۱ پیانوی تو ${western(60 + learned)} است.`,
      );
      return;
    }
    if (listening.current) {
      setStatus(`${noteName(m)} شنیدم — میکروفون درست کار می‌کند.`);
      return;
    }
    if (!live.current) return;
    const { stage: s, times, tol } = run.current;
    const window = windowFor(tol);
    const elapsed = performance.now() - start.current;
    // The count-in is free warm-up: notes played before the first one is even catchable are
    // neither judged nor counted, and the gate is re-armed so the real attempt still lands.
    if (elapsed < times[0] - window) {
      mic.rearm();
      setFeedback("صبر کن تا شماره به خط طلایی برسد");
      return;
    }
    const pending = s.steps
      .map((step, index) => ({
        index,
        at: times[index],
        midi: step.midi + offset,
      }))
      .filter((p) => !done.current.has(p.index));
    const { pick, matched, octave } = match(m, pending, elapsed, window);
    if (!pick) return;
    // Playing the right note an octave out settles which octave the keyboard sits in, so the
    // guide and the notes still to come line up with what the child is actually touching.
    if (octave) {
      setOffset(offset + octave);
      saveTuning(offset + octave);
    }
    const delta = elapsed - pick.at;
    if (matched) {
      done.current.add(pick.index);
      hit.current++;
      streak.current++;
      const perfect = Math.abs(delta) <= PERFECT * tol;
      points.current += perfect ? 100 : 60;
      setScore(points.current);
      setHits(hit.current);
      setCombo(streak.current);
      setResolved(new Set(done.current));
      pulse(true, perfect ? "عالی! دقیق روی ضرب ✨" : "درست بود!");
    } else {
      errors.current++;
      streak.current = 0;
      setCombo(0);
      pulse(
        false,
        Math.abs(delta) <= window
          ? `${noteName(m)} شنیدم؛ کلید ${keyLabel(s.steps[pick.index].midi)} را بزن`
          : delta < 0
            ? "کمی زود بود؛ صبر کن به خط برسد"
            : "دیر شد؛ شمارهٔ بعدی را دنبال کن",
      );
    }
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        stop();
        setScreen((s) => (s === "play" ? "ready" : s));
        setStatus("تمرین متوقف شد؛ برای ادامه دوباره «شروع» را بزن.");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      epoch.current++;
      live.current = false;
      cancelAnimationFrame(clock.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (screen === "play" && !mic.active) {
      stop();
      setScreen("ready");
      setStatus(
        "اتصال میکروفون قطع شد؛ امتیاز این اجرای ناتمام ثبت نشد. دوباره وصل کن.",
      );
    }
  }, [mic.active, screen]);
  const unlocked = (i: number) =>
    i === 0 || (records[stages[i - 1].id]?.stars ?? 0) >= 1;
  const next = stages.findIndex((s, i) => unlocked(i) && !records[s.id]?.stars);
  useEffect(() => {
    // Only jump into the map once there is progress to jump to; a fresh child starts at the top.
    if (screen === "map" && next > 0)
      resume.current?.scrollIntoView?.({ block: "center" });
  }, [screen, next]);
  /** One tap on a stage: microphone on, then straight into the falling notes. */
  const choose = async (i: number) => {
    stop();
    setSelected(i);
    setHeard(null);
    // The very first time, learn the child's piano before asking them to play against it.
    if (!tuned) return void tune();
    setScreen("ready");
    if (await connect()) begin(i);
  };
  const speedPicker = (
    <div className="speed-picker" role="group" aria-label="سرعت تمرین">
      <Gauge size={18} />
      <span>سرعت</span>
      {speeds.map((s) => (
        <button
          key={s}
          className={s === speed ? "on" : ""}
          aria-pressed={s === speed}
          onClick={() => setSpeed(s)}
        >
          {percent(s)}
        </button>
      ))}
      <small>
        {speed === 1 ? "سرعت واقعی آهنگ" : "تمرین آرام؛ فرصت بیشتر برای هر نت"}
      </small>
    </div>
  );
  return (
    <div className={`rhythm-game ${flash}`}>
      <header className="game-header">
        <button
          className="small-button"
          onClick={() => {
            stop();
            if (screen === "map") onExit();
            else setScreen("map");
          }}
        >
          <ArrowRight />
          {screen === "map" ? "استودیو" : "نقشهٔ مراحل"}
        </button>
        <b>ماهور · سرزمین موسیقی</b>
        <span>
          ★ {fa(Object.values(records).reduce((n, r) => n + r.score, 0))} امتیاز
        </span>
      </header>
      {screen === "map" ? (
        <div className="world-map">
          <FantasyIcon name="coach" />
          <h1>صد مرحله تا نوازندگی</h1>
          <p>روی مرحله بزن؛ میکروفون روشن می‌شود و بازی خودش شروع می‌شود.</p>
          {speedPicker}
          <button
            className="text-button"
            onClick={() => {
              setScreen("ready");
              setStatus("اینجا می‌توانی میکروفون را آزمایش و تنظیم کنی.");
            }}
          >
            <Settings size={16} /> تنظیم میکروفون
          </button>
          <button className="text-button" onClick={() => void tune()}>
            <Gauge size={16} /> آشنا شدن با پیانوی من
          </button>
          {stages.map((s, i) => {
            const locked = !unlocked(i),
              r = records[s.id],
              world = worldList[s.world];
            return (
              <div key={s.id}>
                {world.from === i && (
                  <div className="world-heading">
                    <b>{world.title}</b>
                    <small>{world.hint}</small>
                  </div>
                )}
                <div
                  className="map-row"
                  style={{
                    transform: `translateX(${[0, 65, 100, 65, 0, -65, -100, -65][i % 8]}px)`,
                  }}
                >
                  {i > 0 && <div className="map-connector" />}
                  <button
                    ref={i === next ? resume : undefined}
                    disabled={locked}
                    className={`stage-square ${r?.stars ? "won" : ""} ${i === next ? "next" : ""}`}
                    onClick={() => void choose(i)}
                    aria-label={`مرحله ${i + 1}: ${s.title}`}
                  >
                    <span>
                      {locked ? <Lock /> : r?.stars ? <Check /> : fa(i + 1)}
                    </span>
                    <small>{r?.stars ? "★".repeat(r.stars) : "♪"}</small>
                  </button>
                  <b>{s.title}</b>
                  <small>
                    {fa(s.steps.length)} نت · {fa(s.bpm)} ضرب در دقیقه
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      ) : screen === "tune" ? (
        <section className="game-ready tune-screen">
          <FantasyIcon name="piano" />
          <h1>بیا با پیانوی تو آشنا شوم</h1>
          <p>
            سه کلید را یکی‌یکی می‌زنی و من یاد می‌گیرم صدای پیانوی تو چطور است.
            این کار فقط یک بار لازم است.
          </p>
          <div className={"mic-status " + (mic.active ? "connected" : "")}>
            <Mic />
            {mic.active ? "گوش می‌دهم" : "میکروفون خاموش"}
            <div className="input-meter">
              <i style={{ width: mic.level + "%" }} />
            </div>
          </div>
          <ol className="tune-steps">
            {TUNING_KEYS.map((midi, i) => (
              <li
                key={midi}
                className={
                  replies[i] !== undefined ? "done" : i === asked ? "now" : ""
                }
              >
                <b>{keyLabel(midi)}</b>
                <span>{noteName(midi)}</span>
                {replies[i] !== undefined ? (
                  <small>
                    <Check size={14} /> {western(replies[i])}
                  </small>
                ) : i === asked ? (
                  <small>حالا این را بزن</small>
                ) : (
                  <small>بعد</small>
                )}
              </li>
            ))}
          </ol>
          {mic.calibrating && <b>۱ ثانیه سکوت؛ صدای اتاق را می‌سنجم.</b>}
          <p role="status">{status}</p>
          <div className="game-buttons">
            {tuned && (
              <button
                className="button"
                onClick={() => {
                  stop();
                  setScreen("map");
                }}
              >
                بریم بازی <Play />
              </button>
            )}
            <button
              className="text-button"
              onClick={() => {
                stop();
                setTuned(true);
                setScreen("map");
              }}
            >
              فعلاً رد شو
            </button>
          </div>
        </section>
      ) : screen === "ready" ? (
        <section className="game-ready">
          <FantasyIcon name="piano" />
          <span>مرحلهٔ {fa(selected + 1)}</span>
          <h1>{stage.title}</h1>
          <p>
            شماره‌ها از بالا می‌آیند. وقتی به خط طلایی رسیدند، همان شماره را روی
            کیبوردت بزن.
          </p>
          {speedPicker}
          <div className={"mic-status " + (mic.active ? "connected" : "")}>
            <Mic />
            {mic.active ? "میکروفون روشن؛ صدای واقعی ساز" : "میکروفون خاموش"}
            <div className="input-meter">
              <i style={{ width: mic.level + "%" }} />
            </div>
          </div>
          <p role="status">{status}</p>
          <div className="microphone-settings">
            <p aria-live="polite">{mic.diagnostic}</p>
            {mic.calibrating && (
              <b>۱ ثانیه هیچ کلیدی نزن؛ دارم صدای محیط را می‌سنجم.</b>
            )}
            <label>
              حساسیت شنیدن{" "}
              <input
                aria-label="حساسیت شنیدن"
                type="range"
                min="1"
                max="6"
                step="1"
                value={mic.sensitivity ?? 2}
                onChange={(e) => mic.setSensitivity(+e.target.value)}
              />
              <b>{fa(mic.sensitivity ?? 2)}</b>
            </label>
            <label>
              میکروفون دستگاه{" "}
              <select
                value={mic.deviceId ?? ""}
                onChange={(e) => {
                  setHeard(null);
                  mic.selectDevice(e.target.value);
                }}
              >
                <option value="">ورودی پیش‌فرض دستگاه</option>
                {mic.devices?.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "میکروفون " + fa(i + 1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={mic.automatic ?? true}
                onChange={(e) => {
                  setHeard(null);
                  mic.setAutomatic(e.target.checked);
                }}
              />
              تقویت خودکار صدای دستگاه (معمولاً خاموش بهتر است؛ شدت ضربه را صاف
              می‌کند)
            </label>
            <small>
              اگر هدفون Bluetooth وصل است، میکروفون داخلی تبلت را انتخاب کن. بعد
              از تغییر ورودی یا تقویت، دوباره فعال‌سازی را بزن.
            </small>
          </div>
          <div className="heard-note">
            آخرین نت شنیده‌شده:{" "}
            <b>
              {heard === null
                ? "هنوز صدایی نشنیدم"
                : western(heard) + " · " + noteName(heard)}
            </b>
          </div>
          <div className="tuning-note">
            {tuned ? (
              <p>
                پیانوی تو شناخته شده است: کلید ۱ = <b>{western(60 + offset)}</b>
              </p>
            ) : (
              <p>هنوز با پیانوی تو آشنا نشده‌ام.</p>
            )}
            <button className="text-button" onClick={() => void tune()}>
              <Gauge size={16} /> آشنا شدن با پیانوی من
            </button>
          </div>
          <div className="game-buttons">
            <button
              className="button outline"
              onClick={async () => {
                if (await connect()) {
                  listening.current = true;
                  setStatus("میکروفون روشن است؛ چند کلید بزن تا بشنوم.");
                }
              }}
            >
              <Mic />
              فعال‌کردن / آزمایش میکروفون
            </button>
            <button
              className="button"
              onClick={async () => {
                if (mic.active || (await connect())) begin(selected);
              }}
            >
              <Play />
              شروع بازی با ساز من
            </button>
          </div>
          <small>
            مرورگر ممکن است اجازهٔ قبلی را به خاطر بسپارد و دوباره سؤال نکند.
            نوار صدا و نت شنیده‌شده نشان می‌دهند ورودی واقعاً کار می‌کند.
          </small>
        </section>
      ) : screen === "play" ? (
        <>
          <div className="game-hud">
            <span>
              امتیاز <b>{fa(score)}</b>
            </span>
            <span>
              پشت سر هم <b>{fa(combo)} 🔥</b>
            </span>
            <span>
              <Gauge size={18} />
              {percent(speed)}
            </span>
            <span>
              <Mic size={18} />
              {mic.active ? "گوش می‌دهم" : "میکروفون قطع شد"}
            </span>
            <button
              className="small-button"
              onClick={() => {
                stop();
                setScreen("ready");
                setStatus("هر وقت آماده بودی، «شروع بازی» را بزن.");
              }}
            >
              <Pause />
              توقف
            </button>
          </div>
          <div className="play-feedback" role="status">
            {mic.quality === "unclear"
              ? "صدا واضح نیست؛ فقط یک کلید و بدون پدال بزن."
              : feedback}
          </div>
          <div className="note-highway" dir="ltr">
            <div className="lanes">
              {run.current.keys.map((k) => (
                <div
                  key={k.midi}
                  className={k.white ? "" : "black"}
                  style={{ left: `${k.left}%`, width: `${k.width}%` }}
                />
              ))}
            </div>
            {run.current.stage.steps.map((s, i) => {
              const y = 100 - ((run.current.times[i] - time) / lead) * 100;
              if (y < -10 || y > 112 || resolved.has(i)) return null;
              const k = run.current.keys.find((x) => x.midi === s.midi)!;
              return (
                <div
                  key={i}
                  className={
                    "falling-note " +
                    (k.white ? "" : "black ") +
                    (Math.abs(run.current.times[i] - time) <
                    windowFor(run.current.tol)
                      ? "near"
                      : "")
                  }
                  style={{ left: `${k.left}%`, width: `${k.width}%`, top: `${y}%` }}
                >
                  {keyLabel(s.midi)}
                </div>
              );
            })}
            <div className="hit-line">
              <span>همین‌جا بزن</span>
            </div>
            {time < lead - 1200 && (
              <div className="countdown">
                {fa(Math.ceil((lead - 200 - time) / 1000))}
              </div>
            )}
          </div>
          <div className="game-piano" dir="ltr">
            {run.current.keys.map((k) => (
              <div
                key={k.midi}
                className={
                  (k.white ? "" : "black ") +
                  (heard === k.midi + offset ? "heard" : "")
                }
                style={{ left: `${k.left}%`, width: `${k.width}%` }}
              >
                {k.white && keyLabel(k.midi)}
              </div>
            ))}
          </div>
          <p className="game-caption">
            <b>
              {heard === null
                ? mic.quality === "quiet"
                  ? "هنوز هیچ صدایی نشنیده‌ام — ساز را نزدیک‌تر کن یا حساسیت را زیاد کن"
                  : "صدا می‌رسد، اما هنوز نتی تشخیص ندادم"
                : `می‌شنوم: ${western(heard)} · ${noteName(heard)} = کلید ${keyLabel(heard - offset)}`}
            </b>{" "}
            کلیدهای این تصویر راهنما هستند؛ روی کیبورد واقعی بزن.
          </p>
        </>
      ) : (
        <section className="game-result">
          <FantasyIcon name="trophy" />
          <h1>
            {stars(hits, stage.steps.length)
              ? "مرحله را رد کردی!"
              : "یک بار دیگر امتحان کنیم"}
          </h1>
          <div className="result-stars">
            {"★".repeat(stars(hits, stage.steps.length))}
            {"☆".repeat(3 - stars(hits, stage.steps.length))}
          </div>
          <strong>{fa(score)} امتیاز</strong>
          <p>
            {fa(hits)} نت درست و به‌موقع از {fa(stage.steps.length)} · سرعت{" "}
            {percent(speed)}
          </p>
          {speed < 1 && stars(hits, stage.steps.length) >= 2 && (
            <p>عالی بود! حالا سرعت را یک پله بالا ببر و دوباره بزن.</p>
          )}
          {speed > 0.5 && stars(hits, stage.steps.length) === 0 && (
            <p>سرعت را کمتر کن و همین مرحله را آرام‌تر تمرین کن.</p>
          )}
          {speedPicker}
          <p>برای بازشدن مرحلهٔ بعد، حداقل ۶۰٪ نت‌ها را درست و به‌موقع بزن.</p>
          <div className="game-buttons">
            <button
              className="button outline"
              onClick={() => void choose(selected)}
            >
              <RotateCcw />
              دوباره بازی کن
            </button>
            {stars(hits, stage.steps.length) > 0 &&
              selected + 1 < stages.length && (
                <button
                  className="button"
                  onClick={() => void choose(selected + 1)}
                >
                  مرحلهٔ بعد <Play />
                </button>
              )}
            <button className="text-button" onClick={() => setScreen("map")}>
              دیدن نقشه
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
