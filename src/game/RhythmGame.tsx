import { useEffect, useRef, useState } from "react";
import {
  Mic,
  ArrowRight,
  Play,
  RotateCcw,
  Volume2,
  Check,
  Lock,
  Pause,
} from "lucide-react";
import { useMicrophone } from "../tablet/useMicrophone";
import {
  readBase,
  saveBase,
  validBase,
  keyFor,
  transpose,
} from "../tablet/model";
import { fa, noteName, western } from "../curriculum";
import { FantasyIcon } from "../tablet/TabletStudio";
import { stages, schedule, judge, stars } from "./engine";
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
export function RhythmGame({
  onExit,
  onSave,
}: {
  onExit: () => void;
  onSave: (a: Attempt) => void;
}) {
  const [screen, setScreen] = useState<"map" | "ready" | "play" | "result">(
      "map",
    ),
    [selected, setSelected] = useState(0),
    [records, setRecords] = useState(load),
    [base, setBase] = useState(readBase),
    [status, setStatus] = useState("شروع هر مرحله، میکروفون را فعال می‌کند."),
    [heard, setHeard] = useState<number | null>(null),
    [checking, setChecking] = useState(false),
    [time, setTime] = useState(0),
    [feedback, setFeedback] = useState(""),
    [flash, setFlash] = useState(""),
    [score, setScore] = useState(0),
    [hits, setHits] = useState(0),
    [combo, setCombo] = useState(0),
    [resolved, setResolved] = useState<Set<number>>(new Set());
  const live = useRef(false),
    checkRef = useRef(false),
    epoch = useRef(0),
    clock = useRef(0),
    start = useRef(0),
    done = useRef(new Set<number>()),
    hit = useRef(0),
    points = useRef(0),
    streak = useRef(0),
    errors = useRef(0),
    flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    handler = useRef<(m: number) => void>(() => {});
  const stage = stages[selected],
    times = schedule(
      stage.steps.map((s) => s.beats),
      stage.bpm,
    );
  const mic = useMicrophone(
    (m) => handler.current(m),
    () => live.current || checkRef.current,
  );
  const pulse = (good: boolean, text: string) => {
    setFlash(good ? "success" : "error");
    setFeedback(text);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 450);
  };
  const stop = () => {
    epoch.current++;
    live.current = false;
    checkRef.current = false;
    setChecking(false);
    cancelAnimationFrame(clock.current);
    mic.stop();
  };
  const finish = () => {
    live.current = false;
    mic.stop();
    cancelAnimationFrame(clock.current);
    setScreen("result");
    const n = stars(hit.current, stage.steps.length);
    const next = {
      ...records,
      [stage.id]: {
        score: Math.max(points.current, records[stage.id]?.score || 0),
        stars: Math.max(n, records[stage.id]?.stars || 0),
      },
    };
    setRecords(next);
    try {
      localStorage.setItem("mahour-game", JSON.stringify(next));
    } catch {
      setStatus("ذخیره‌سازی مرورگر بسته است؛ نتیجه فقط تا بستن صفحه می‌ماند.");
    }
    onSave({
      id: stage.id,
      at: new Date().toISOString(),
      correct: hit.current,
      wrong: errors.current,
      accuracy: Math.round((hit.current / stage.steps.length) * 100),
      seconds: Math.round((performance.now() - start.current) / 1000),
      source: "mic",
      partial: false,
      mode: "falling-notes",
      rhythm: Math.round((hit.current / stage.steps.length) * 100),
      baseMidi: base,
    });
  };
  const connect = async () => {
    stop();
    const token = epoch.current;
    setStatus("منتظر اجازهٔ میکروفون…");
    try {
      const ok = await mic.start();
      if (!ok || token !== epoch.current) return;
      checkRef.current = true;
      setChecking(true);
      setStatus(
        "میکروفون روشن است. کلید شمارهٔ ۱ (دو) را بزن؛ سپس «شروع بازی» را بزن.",
      );
    } catch (e) {
      setStatus(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "دسترسی میکروفون رد شده است. کنار آدرس سایت، اجازهٔ Microphone را روشن کن. اگر داخل مرورگر برنامه هستی، لینک را در Chrome یا Safari باز کن."
          : "میکروفون فعال نشد. سایت را در Chrome یا Safari با HTTPS باز کن و دستگاه ورودی را بررسی کن.",
      );
    }
  };
  const begin = () => {
    if (!mic.active) return;
    checkRef.current = false;
    setChecking(false);
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
    const frame = () => {
      if (!live.current) return;
      const elapsed = performance.now() - start.current;
      setTime(elapsed);
      times.forEach((at, i) => {
        if (elapsed > at + 380 && !done.current.has(i)) {
          done.current.add(i);
          errors.current++;
          streak.current = 0;
          setCombo(0);
          setResolved(new Set(done.current));
          pulse(false, "این نت جا ماند؛ بعدی را بگیر!");
        }
      });
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
    if (checkRef.current) {
      if (validBase(m)) {
        setBase(m);
        saveBase(m);
        setStatus(
          `صدایت را می‌شنوم! کلید ۱ = ${western(m)}. آمادهٔ بازی هستی.`,
        );
      } else
        setStatus(
          `${noteName(m)} شنیدم. برای تنظیم شماره‌ها، کلید «دو» را بزن.`,
        );
      return;
    }
    if (!live.current) return;
    const elapsed = performance.now() - start.current;
    let closest = -1;
    times.forEach((at, i) => {
      if (
        !done.current.has(i) &&
        (closest === -1 ||
          Math.abs(at - elapsed) < Math.abs(times[closest] - elapsed))
      )
        closest = i;
    });
    if (closest < 0) return;
    const result = judge(
      transpose(stage.steps[closest].midi, base),
      m,
      elapsed - times[closest],
    );
    if (result === "perfect" || result === "good") {
      done.current.add(closest);
      hit.current++;
      streak.current++;
      points.current += result === "perfect" ? 100 : 60;
      setScore(points.current);
      setHits(hit.current);
      setCombo(streak.current);
      setResolved(new Set(done.current));
      pulse(true, result === "perfect" ? "عالی! دقیق روی ضرب ✨" : "درست بود!");
    } else {
      errors.current++;
      streak.current = 0;
      setCombo(0);
      pulse(
        false,
        result === "wrong"
          ? `کلید ${fa(keyFor(stage.steps[closest].midi))} را بزن`
          : result === "early"
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
        setStatus("تمرین متوقف شد؛ برای ادامه میکروفون را دوباره روشن کن.");
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
  const choose = async (i: number) => {
    stop();
    setSelected(i);
    setScreen("ready");
    setHeard(null);
    await connect();
  };
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
          <h1>هر مربع، یک ماجرای موسیقی!</h1>
          <p>روی ساز خودت بزن، ستاره بگیر و مرحلهٔ بعد را باز کن.</p>
          {stages.map((s, i) => {
            const locked = i > 0 && !(records[stages[i - 1].id]?.stars >= 1),
              r = records[s.id];
            return (
              <div
                className="map-row"
                style={{
                  transform: `translateX(${[0, 65, 100, 65, 0, -65, -100, -65][i % 8]}px)`,
                }}
                key={s.id}
              >
                {i > 0 && <div className="map-connector" />}
                <button
                  disabled={locked}
                  className={`stage-square ${r?.stars ? "won" : ""}`}
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
            );
          })}
        </div>
      ) : screen === "ready" ? (
        <section className="game-ready">
          <FantasyIcon name="piano" />
          <span>مرحلهٔ {fa(selected + 1)}</span>
          <h1>{stage.title}</h1>
          <p>
            شماره‌ها از بالا می‌آیند. وقتی به خط طلایی رسیدند، همان شماره را روی
            کیبوردت بزن.
          </p>
          <div className={"mic-status " + (mic.active ? "connected" : "")}>
            <Mic />
            {mic.active ? "میکروفون روشن؛ صدای واقعی ساز" : "میکروفون خاموش"}
            <div className="input-meter">
              <i style={{ width: mic.level + "%" }} />
            </div>
          </div>
          <p role="status">{status}</p>
          <div className="heard-note">
            آخرین نت شنیده‌شده:{" "}
            <b>
              {heard === null
                ? "هنوز صدایی نشنیدم"
                : western(heard) + " · " + noteName(heard)}
            </b>
          </div>
          <label>
            کلید شمارهٔ ۱ شما{" "}
            <select
              disabled={live.current}
              value={base}
              onChange={(e) => {
                setBase(+e.target.value);
                saveBase(+e.target.value);
              }}
            >
              {[48, 60, 72].map((n) => (
                <option value={n} key={n}>
                  {western(n)}
                </option>
              ))}
            </select>
          </label>
          <div className="game-buttons">
            <button className="button outline" onClick={() => void connect()}>
              <Mic />
              فعال‌کردن / آزمایش میکروفون
            </button>
            <button
              className="button"
              disabled={!mic.active || heard === null || !validBase(heard)}
              onClick={begin}
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
              <Mic size={18} />
              {mic.active ? "گوش می‌دهم" : "میکروفون قطع شد"}
            </span>
            <button
              className="small-button"
              onClick={() => {
                stop();
                setScreen("ready");
                setStatus("برای شروع دوباره، میکروفون را فعال کن.");
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
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} />
              ))}
            </div>
            {stage.steps.map((s, i) => {
              const y = 100 - ((times[i] - time) / 3200) * 100;
              if (y < -10 || y > 112 || resolved.has(i)) return null;
              return (
                <div
                  key={i}
                  className={
                    "falling-note " +
                    (Math.abs(times[i] - time) < 380 ? "near" : "")
                  }
                  style={{
                    left: `${(keyFor(s.midi) - 1) * 12.5}%`,
                    top: `${y}%`,
                  }}
                >
                  {fa(keyFor(s.midi))}
                </div>
              );
            })}
            <div className="hit-line">
              <span>همین‌جا بزن</span>
            </div>
            {time < 2000 && (
              <div className="countdown">
                {fa(Math.ceil((3000 - time) / 1000))}
              </div>
            )}
          </div>
          <div className="game-piano" dir="ltr">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                className={
                  heard !== null &&
                  heard === transpose([60, 62, 64, 65, 67, 69, 71, 72][i], base)
                    ? "heard"
                    : ""
                }
                key={i}
              >
                {fa(i + 1)}
                {[0, 1, 3, 4, 5].includes(i) && <i />}
              </div>
            ))}
          </div>
          <p className="game-caption">
            کلیدهای این تصویر راهنما هستند؛ روی کیبورد واقعی بزن.{" "}
            {heard !== null && `می‌شنوم: ${western(heard)}`}
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
            {fa(hits)} نت درست و به‌موقع از {fa(stage.steps.length)}
          </p>
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
