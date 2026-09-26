import React, { useEffect, useRef, useState } from "react";
import { Mic, ArrowRight, Play, RotateCcw, Lock, Pause, Gauge, Piano } from "lucide-react";
import { useMicrophone } from "../tablet/useMicrophone";
import { fa, noteName } from "../curriculum";
import {
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
  type Mode,
} from "../game/engine";
import type { Attempt } from "../storage";
import { audioContext, playNote } from "../audio";
import { harpStages, holeFor, DRILLS, BLOW as BLOWS, DRAW as DRAWS, type HarpStage } from "./harp";
import "../game/game.css";
import "./harmonica.css";

type RecordMap = Record<string, { score: number; stars: number }>;
const KEY = "mahour-harp";
function load(): RecordMap {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
const BLUE = "#0a6cd6",
  ORANGE = "#ff8a00";
const color = (blow: boolean) => (blow ? BLUE : ORANGE);
const breath = (blow: boolean) => (blow ? "فوت" : "مک");
/** "سوراخ ۴ فوت" for a harmonica pitch, or the plain note name for one it cannot play. */
export const say = (m: number) => {
  const h = holeFor(m);
  return h ? `سوراخ ${fa(h.hole)} ${breath(h.blow)}` : noteName(m);
};
const percent = (s: number) => fa(Math.round(s * 100)) + "٪";
const PRAISE = ["آفرین! ✨", "عالی! 🎉", "همینه! 💪", "درست زدی! ⭐", "ایول! 🚀"];
const MODES: Record<Mode, { icon: string; name: string; hint: string }> = {
  listen: { icon: "👂", name: "گوش بده", hint: "اول بشنو آهنگ چطوری است" },
  learn: { icon: "🐢", name: "آروم با من", hint: "آجرها صبر می‌کنند تا سوراخ درست را بزنی" },
  rhythm: { icon: "⚡", name: "با ریتم", hint: "به‌موقع بزن و سه ستاره بگیر" },
};
const today = () => new Date().toISOString().slice(0, 10);

/** The brick robot playing a harmonica: held in its LEFT hand (your right, since it faces you), right hand cupped behind. */
export function HarpBuddy({ cheer = false }: { cheer?: boolean }) {
  return (
    <svg className={"brick-buddy harp-buddy" + (cheer ? " cheer" : "")} viewBox="0 0 140 140" aria-hidden="true">
      <rect x="44" y="72" width="52" height="42" rx="6" fill="#e3000b" />
      <rect x="50" y="114" width="16" height="16" rx="3" fill="#0a6cd6" />
      <rect x="74" y="114" width="16" height="16" rx="3" fill="#0a6cd6" />
      <rect x="54" y="6" width="32" height="10" rx="3" fill="#ffcd00" />
      <rect x="34" y="14" width="72" height="52" rx="10" fill="#ffcd00" />
      <circle cx="56" cy="34" r="6" fill="#222" />
      <circle cx="84" cy="34" r="6" fill="#222" />
      <circle cx="58" cy="32" r="2" fill="#fff" />
      <circle cx="86" cy="32" r="2" fill="#fff" />
      {/* the harmonica at the mouth; hole 1 (low) is on the robot's left = your right */}
      <rect x="40" y="50" width="60" height="14" rx="3" fill="#c9d2dc" stroke="#6b7785" strokeWidth="2" />
      <rect x="42" y="57" width="56" height="5" fill="#8a2b1b" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={43.5 + i * 5.5} y="58" width="3" height="3" fill="#222" />
      ))}
      {/* right arm (your left): the cupped hand, behind the high end */}
      <path d="M46 80 Q18 80 26 58" fill="none" stroke="#ffcd00" strokeWidth="11" strokeLinecap="round" />
      <path d="M22 46 q-10 11 0 24 q10 2 18 -2 v-20 q-8 -5 -18 -2 z" fill="#ffcd00" stroke="#c99a00" strokeWidth="2" />
      {/* left arm (your right): thumb under, index finger on top, pinching the low end */}
      <path d="M94 80 Q122 80 114 60" fill="none" stroke="#ffcd00" strokeWidth="11" strokeLinecap="round" />
      <rect x="92" y="44" width="24" height="8" rx="4" fill="#ffcd00" stroke="#c99a00" strokeWidth="2" />
      <rect x="92" y="63" width="24" height="8" rx="4" fill="#ffcd00" stroke="#c99a00" strokeWidth="2" />
      <text x="104" y="96" fontSize="9" fontWeight="900" fill="#1f2a44">چپ</text>
      {cheer && <text x="112" y="30" fontSize="16">♪</text>}
    </svg>
  );
}

/**
 * The harmonica the way the child sees it, looking down at it: numbers on top, hole 1 on the left,
 * the left hand pinching the low end and the right hand cupped round the high end.
 */
function Harp({
  lit,
  heard,
  onPlay,
}: {
  lit: number[];
  heard: number | null;
  onPlay?: (midi: number) => void;
}) {
  const h = heard === null ? null : holeFor(heard);
  return (
    <div className="harp-view" dir="ltr">
      <svg className="hand left" viewBox="0 0 80 110" aria-hidden="true">
        <path d="M10 108 C4 70 6 40 30 30 L64 22 q10 -2 10 8 q0 8 -10 9 L40 44 L40 60 L66 62 q10 1 9 10 q-1 8 -11 7 L38 80 C30 96 28 104 26 108 z" fill="#f2c29b" stroke="#c98d63" strokeWidth="3" />
        <text x="16" y="100" fontSize="13" fontWeight="900" fill="#7a4a2a">چپ</text>
      </svg>
      <div className="harp-body">
        {Array.from({ length: 10 }, (_, i) => {
          const hole = i + 1,
            litBlow = lit.includes(BLOWS[i]),
            litDraw = lit.includes(DRAWS[i]),
            on = h?.hole === hole;
          return (
            <div key={hole} className={"harp-hole" + (litBlow || litDraw ? " lit" : "") + (on ? " heard" : "")}
              style={{ "--c": litDraw ? ORANGE : BLUE } as React.CSSProperties}>
              <b>{fa(hole)}</b>
              <i />
              {onPlay ? (
                <span className="harp-pads">
                  <button aria-label={`سوراخ ${hole} فوت`} className="blow" onPointerDown={() => onPlay(BLOWS[i])}>
                    فوت
                  </button>
                  <button aria-label={`سوراخ ${hole} مک`} className="draw" onPointerDown={() => onPlay(DRAWS[i])}>
                    مک
                  </button>
                </span>
              ) : (
                <small>{on ? breath(h!.blow) : ""}</small>
              )}
            </div>
          );
        })}
      </div>
      <svg className="hand right" viewBox="0 0 80 110" aria-hidden="true">
        <path d="M70 108 C78 70 76 34 52 24 C38 18 22 22 16 34 C12 44 18 50 26 48 L40 44 L40 80 C48 94 52 104 54 108 z" fill="#f2c29b" stroke="#c98d63" strokeWidth="3" />
        <text x="44" y="100" fontSize="13" fontWeight="900" fill="#7a4a2a">راست</text>
      </svg>
    </div>
  );
}

export function HarmonicaGame({
  onPiano,
  onParents,
  onSave,
}: {
  onPiano: () => void;
  onParents: () => void;
  onSave: (a: Attempt) => void;
}) {
  const [input, setInput] = useState<"touch" | "mic">("mic"),
    [screen, setScreen] = useState<"map" | "intro" | "ready" | "play" | "result">("map"),
    [selected, setSelected] = useState(0),
    [mode, setMode] = useState<Mode>("learn"),
    [records, setRecords] = useState(load),
    [speed, setSpeedState] = useState(readSpeed),
    [status, setStatus] = useState(""),
    [heard, setHeard] = useState<number | null>(null),
    [time, setTime] = useState(0),
    [feedback, setFeedback] = useState(""),
    [flash, setFlash] = useState(""),
    [score, setScore] = useState(0),
    [hits, setHits] = useState(0),
    [combo, setCombo] = useState(0),
    [earned, setEarned] = useState(0),
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
    slipped = useRef(false),
    clear = useRef(false),
    flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    handler = useRef<(m: number) => void>(() => {});
  const run = useRef<{ stage: HarpStage; times: number[]; lengths: number[]; tol: number; mode: Mode }>({
    stage: harpStages[0],
    times: [],
    lengths: [],
    tol: 1,
    mode: "learn",
  });
  const stage = harpStages[selected];
  const mic = useMicrophone(
    (m) => handler.current(m),
    () => input === "mic" && (live.current || listening.current),
    true,
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
    cancelAnimationFrame(clock.current);
    mic.stop();
  };
  const setSpeed = (n: number) => {
    setSpeedState(n);
    saveSpeed(n);
  };
  const finish = () => {
    const { stage: s, mode: how } = run.current;
    live.current = false;
    mic.stop();
    cancelAnimationFrame(clock.current);
    setScreen("result");
    // Practice days are shared with the piano, so the parent panel sees one week.
    try {
      const days: string[] = JSON.parse(localStorage.getItem("mahour-days") || "[]");
      if (!days.includes(today()))
        localStorage.setItem("mahour-days", JSON.stringify([...days, today()].slice(-60)));
    } catch {}
    if (how === "listen") return setEarned(0);
    const n = how === "learn" ? 1 : stars(hit.current, s.steps.length);
    setEarned(n);
    const slower = speeds[speeds.indexOf(speed) - 1];
    if (how === "rhythm" && n === 0 && slower) setSpeed(slower);
    const next = {
      ...records,
      [s.id]: {
        score: Math.max(points.current, records[s.id]?.score || 0),
        stars: Math.max(n, records[s.id]?.stars || 0),
      },
    };
    setRecords(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    onSave({
      id: s.id,
      at: new Date().toISOString(),
      correct: hit.current,
      wrong: errors.current,
      accuracy: Math.round(
        (100 * hit.current) / (how === "learn" ? hit.current + errors.current || 1 : s.steps.length),
      ),
      seconds: Math.round((performance.now() - start.current) / 1000),
      source: input === "touch" ? "screen" : "mic",
      partial: false,
      mode: how === "learn" ? "wait-mode" : "falling-notes",
      rhythm: how === "learn" ? null : Math.round((hit.current / s.steps.length) * 100),
    });
  };
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
          ? "دسترسی میکروفون رد شده است. کنار آدرس سایت، اجازهٔ Microphone را روشن کن."
          : "میکروفون فعال نشد. سایت را در Chrome یا Safari با HTTPS باز کن.",
      );
      return false;
    }
  };
  const begin = (index = selected, how: Mode = mode) => {
    const s = harpStages[index];
    const tol = tolerance(speed),
      window = windowFor(tol),
      beat = 60000 / (s.bpm * speed);
    const times = schedule(s.steps.map((st) => st.beats), s.bpm * speed);
    const lengths = s.steps.map((st) => st.beats * beat);
    run.current = { stage: s, times, lengths, tol, mode: how };
    clear.current = input === "touch" || how !== "rhythm";
    listening.current = false;
    done.current = new Set();
    hit.current = points.current = streak.current = errors.current = 0;
    slipped.current = false;
    setScore(0);
    setHits(0);
    setCombo(0);
    setResolved(new Set());
    setTime(0);
    setFeedback(
      how === "listen"
        ? "نگاه کن و گوش بده 🎶"
        : how === "learn"
          ? "هر آجر روی خط زرد منتظرت می‌ماند؛ آبی = فوت، نارنجی = مک"
          : "وقتی آجر به خط زرد رسید، همان سوراخ را بزن",
    );
    setFlash("");
    start.current = performance.now();
    live.current = true;
    setScreen("play");
    const deaf = Math.min(3, times.length);
    const frame = () => {
      if (!live.current) return;
      const now = performance.now();
      let elapsed = now - start.current;
      if (how === "learn") {
        const n = times.findIndex((_, i) => !done.current.has(i));
        if (n >= 0 && elapsed > times[n]) {
          start.current = now - times[n];
          elapsed = times[n];
        }
      }
      setTime(elapsed);
      if (how === "listen")
        times.forEach((at, i) => {
          if (elapsed >= at && !done.current.has(i)) {
            done.current.add(i);
            setResolved(new Set(done.current));
            void playNote(s.steps[i].midi, Math.min(1.6, (lengths[i] / 1000) * 0.9)).catch(() => {});
          }
        });
      if (how === "rhythm") {
        if (signal.current === "clear") clear.current = true;
        times.forEach((at, i) => {
          if (elapsed > at + window && !done.current.has(i)) {
            done.current.add(i);
            errors.current++;
            streak.current = 0;
            setCombo(0);
            setResolved(new Set(done.current));
            pulse(false, "این یکی جا ماند؛ بعدی را بگیر!");
          }
        });
        if (!clear.current && done.current.size >= deaf) {
          stop();
          setScreen("ready");
          setStatus("هیچ صدای واضحی از سازدهنی نرسید؛ بازی بدون ثبت شکست متوقف شد. ساز را نزدیک میکروفون بگیر.");
          return;
        }
      }
      if (done.current.size === times.length && elapsed > times[times.length - 1] + 500) return finish();
      clock.current = requestAnimationFrame(frame);
    };
    clock.current = requestAnimationFrame(frame);
  };
  const score1 = (index: number, gain: number, text: string) => {
    done.current.add(index);
    hit.current++;
    streak.current++;
    points.current += gain;
    setScore(points.current);
    setHits(hit.current);
    setCombo(streak.current);
    setResolved(new Set(done.current));
    pulse(true, streak.current >= 5 && streak.current % 5 === 0 ? `${fa(streak.current)} تا پشت سر هم! 🔥` : text);
  };
  /** What to say about a wrong note: a pitch no hole makes usually means two holes at once. */
  const miss = (m: number, want: number) =>
    holeFor(m)
      ? `${say(m)} زدی؛ ${say(want)} را بزن`
      : "دو سوراخ با هم صدا داد؛ لب‌ها را غنچه کن تا فقط یک سوراخ بزنی";
  handler.current = (m) => {
    setHeard(m);
    clear.current = true;
    if (listening.current) {
      setStatus(`${say(m)} شنیدم (${noteName(m)}) — میکروفون درست کار می‌کند.`);
      return;
    }
    if (!live.current) return;
    const { stage: s, times, tol, mode: how } = run.current;
    if (how === "listen") return;
    const window = windowFor(tol);
    const elapsed = performance.now() - start.current;
    if (elapsed < times[0] - window) {
      if (input === "mic") mic.rearm();
      setFeedback("صبر کن تا آجر به خط زرد برسد");
      return;
    }
    if (how === "learn") {
      const n = times.findIndex((_, i) => !done.current.has(i));
      if (n < 0) return;
      const want = s.steps[n].midi;
      if (elapsed < times[n] - window) {
        if (input === "mic") mic.rearm();
        setFeedback("صبر کن تا آجر به خط زرد برسد 🙂");
        return;
      }
      if (m === want) {
        score1(n, slipped.current ? 50 : 100, PRAISE[hit.current % PRAISE.length]);
        slipped.current = false;
      } else {
        errors.current++;
        slipped.current = true;
        streak.current = 0;
        setCombo(0);
        pulse(false, miss(m, want));
      }
      return;
    }
    const pending = s.steps
      .map((st, index) => ({ index, at: times[index], midi: st.midi }))
      .filter((p) => !done.current.has(p.index));
    // Octaves are different holes on a harmonica, so an octave is a wrong note here.
    const { pick, matched } = match(m, pending, elapsed, window, false);
    if (!pick) return;
    const delta = elapsed - pick.at;
    if (matched) {
      const perfect = Math.abs(delta) <= PERFECT * tol;
      score1(pick.index, perfect ? 100 : 60, perfect ? "عالی! دقیق روی ضرب ✨" : "درست بود! 👍");
    } else {
      errors.current++;
      streak.current = 0;
      setCombo(0);
      pulse(
        false,
        Math.abs(delta) <= window
          ? miss(m, pick.midi)
          : delta < 0
            ? "کمی زود بود؛ صبر کن به خط برسد"
            : "دیر شد؛ آجر بعدی را دنبال کن",
      );
    }
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        stop();
        setScreen((s) => (s === "play" ? "intro" : s));
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
    if (screen === "play" && input === "mic" && run.current.mode !== "listen" && !mic.active) {
      stop();
      setScreen("ready");
      setStatus("اتصال میکروفون قطع شد؛ امتیاز این اجرای ناتمام ثبت نشد. دوباره وصل کن.");
    }
  }, [mic.active, screen, input]);
  const unlocked = (i: number) =>
    i === 0 ||
    (records[harpStages[i - 1].id]?.stars ?? 0) >= 1 ||
    (i >= DRILLS && (records[harpStages[DRILLS - 3].id]?.stars ?? 0) >= 1);
  const next = harpStages.findIndex((s, i) => unlocked(i) && !records[s.id]?.stars);
  const totalStars = Object.values(records).reduce((n, r) => n + r.stars, 0);
  const choose = (i: number) => {
    stop();
    setSelected(i);
    setHeard(null);
    setStatus("");
    setScreen("intro");
  };
  const startMode = async (how: Mode, i = selected) => {
    stop();
    setMode(how);
    setSelected(i);
    setHeard(null);
    if (input === "touch" || how === "listen") {
      setScreen("ready");
      const token = epoch.current;
      try {
        await audioContext();
        if (token === epoch.current) begin(i, how);
      } catch {
        setStatus("صدا فعال نشد؛ صدای دستگاه را بررسی کن.");
      }
      return;
    }
    setScreen("ready");
    if (await connect()) begin(i, how);
  };
  const touchPlay = (m: number) => {
    void playNote(m, 0.45).catch(() => {});
    handler.current(m);
  };
  const { times: rt, lengths: rl, stage: rs, mode: rm, tol: rtol } = run.current;
  const lit =
    screen !== "play"
      ? []
      : rs.steps
          .filter((_, i) =>
            rm === "listen"
              ? time >= rt[i] && time < rt[i] + rl[i] * 0.85
              : rm === "learn"
                ? i === rt.findIndex((_, j) => !resolved.has(j)) && rt[i] - time < 900
                : !resolved.has(i) && Math.abs(rt[i] - time) < windowFor(rtol) * 0.6,
          )
          .map((s) => s.midi);
  const speedPicker = (
    <div className="speed-picker" role="group" aria-label="سرعت تمرین">
      <Gauge size={18} />
      <span>سرعت</span>
      {speeds.map((s) => (
        <button key={s} className={s === speed ? "on" : ""} aria-pressed={s === speed} onClick={() => setSpeed(s)}>
          {percent(s)}
        </button>
      ))}
    </div>
  );
  const modeButton = (how: Mode, primary = false) => (
    <button key={how} className={`mode-card ${how} ${primary ? "primary" : ""}`} aria-label={MODES[how].name}
      onClick={() => void startMode(how)}>
      <span className="mode-icon">{MODES[how].icon}</span>
      <b>{MODES[how].name}</b>
      <small>{MODES[how].hint}</small>
      {primary && <em>پیشنهاد من</em>}
    </button>
  );
  const holdTips = (
    <div className="hold-card">
      <HarpBuddy />
      <ol>
        <li><b>دست چپ</b> ساز را بگیرد: شست زیر، انگشت اشاره روی ساز.</li>
        <li>شماره‌ها رو به بالا؛ <b>سوراخ ۱</b> (صدای بم) سمت چپ تو.</li>
        <li><b>دست راست</b> مثل کاسه پشت ساز.</li>
        <li>لب‌ها غنچه، آرام نفس بکش؛ محکم فوت نکن.</li>
      </ol>
    </div>
  );
  const stageButton = (i: number) => {
    const s = harpStages[i],
      locked = !unlocked(i),
      r = records[s.id];
    return (
      <div className="stage-slot" key={s.id}>
        <button disabled={locked} className={`stage-brick ${r?.stars ? "won" : ""} ${i === next ? "next" : ""}`}
          style={{ "--c": i < DRILLS ? BLUE : ORANGE } as React.CSSProperties}
          onClick={() => choose(i)} aria-label={`مرحله ${i + 1}: ${s.title}`}>
          <span>{locked ? <Lock /> : s.song ? "🎵" : fa(i + 1)}</span>
        </button>
        <small className="stage-name">{s.title}</small>
        <small className="stage-stars">
          {[0, 1, 2].map((n) => (
            <i key={n} className={(r?.stars ?? 0) > n ? "on" : ""}>★</i>
          ))}
        </small>
      </div>
    );
  };
  return (
    <div className={`rhythm-game harmonica ${flash}`}>
      <header className="game-header">
        <button className="brick-button small" onClick={() => {
          stop();
          if (screen === "map") onParents();
          else setScreen("map");
        }}>
          <ArrowRight />
          {screen === "map" ? "بخش والدین" : "نقشه"}
        </button>
        <b className="logo"><i />ماهور و شهر آجری موسیقی</b>
        <span className="star-count">⭐ {fa(totalStars)}</span>
      </header>
      {screen === "map" ? (
        <div className="world-map">
          <div className="instrument-switch" role="tablist" aria-label="ساز">
            <button role="tab" aria-selected={false} onClick={() => { stop(); onPiano(); }}><Piano size={18} /> پیانو</button>
            <button role="tab" aria-selected className="on">🎵 سازدهنی</button>
          </div>
          <section className="hero-card">
            <HarpBuddy cheer={totalStars > 0} />
            <div>
              <h1>سازدهنی دو (C) 🎵</h1>
              <p>
                {next >= 0 ? `مرحلهٔ بعد: ${harpStages[next].title}` : "همه را تمام کردی! برای خانواده بنواز."}
              </p>
              {next >= 0 && (
                <button className="brick-button big" onClick={() => choose(next)}>
                  <Play /> ادامه بده
                </button>
              )}
            </div>
          </section>
          {holdTips}
          <section className="world-card open" style={{ "--c": BLUE } as React.CSSProperties}>
            <div className="world-title"><span className="world-number">🌬</span><span><b>نفس و سوراخ‌ها</b><small>فوت و مک، سوراخ‌های ۴ تا ۷</small></span></div>
            <div className="stage-grid">{harpStages.slice(0, DRILLS).map((_, i) => stageButton(i))}</div>
          </section>
          <section className="world-card open" style={{ "--c": ORANGE } as React.CSSProperties}>
            <div className="world-title"><span className="world-number">🎵</span><span><b>آهنگ‌ها</b><small>بعد از مرحلهٔ «تا سوراخ ۶» باز می‌شوند</small></span></div>
            <div className="stage-grid">{harpStages.slice(DRILLS).map((_, i) => stageButton(i + DRILLS))}</div>
          </section>
          <footer className="grown-ups">
            <small>با چه سازدهنی‌ای می‌زنی؟</small>
            <div className="input-choice" role="group" aria-label="روش نواختن">
              <button className={input === "mic" ? "on" : ""} aria-pressed={input === "mic"} onClick={() => { stop(); setInput("mic"); }}>
                سازدهنی واقعی · میکروفون
              </button>
              <button className={input === "touch" ? "on" : ""} aria-pressed={input === "touch"} onClick={() => { stop(); setInput("touch"); }}>
                سازدهنی لمسی · بدون میکروفون
              </button>
            </div>
          </footer>
        </div>
      ) : screen === "intro" ? (
        <section className="stage-intro">
          <small>سازدهنی · مرحلهٔ {fa(selected + 1)}</small>
          <h1>{stage.title}</h1>
          <p>{stage.hint}</p>
          <div className="note-preview" dir="ltr" aria-label="تب">
            {stage.steps.slice(0, 14).map((st, i) => (
              <i key={i} style={{ "--c": color(st.blow), flexGrow: st.beats } as React.CSSProperties}>
                {fa(st.hole)}
              </i>
            ))}
            {stage.steps.length > 14 && <span>…</span>}
          </div>
          <p className="harp-legend"><i className="blow" /> آبی = فوت (بیرون) · <i className="draw" /> نارنجی = مک (داخل)</p>
          <div className="mode-cards">
            {(["listen", "learn", "rhythm"] as Mode[]).map((how) => modeButton(how, how === (records[stage.id]?.stars ? "rhythm" : "learn")))}
          </div>
          {speedPicker}
          {status && <p role="status">{status}</p>}
        </section>
      ) : screen === "ready" ? (
        <section className="game-ready">
          {holdTips}
          <h1>{stage.title}</h1>
          <div className={"mic-status " + (mic.active ? "connected" : "")}>
            <Mic />
            {mic.active ? "گوش می‌دهم" : "میکروفون خاموش"}
            <div className="input-meter"><i style={{ width: mic.level + "%" }} /></div>
          </div>
          <p role="status">{status}</p>
          {input === "mic" && (
            <div className="microphone-settings">
              <p aria-live="polite">{mic.diagnostic}</p>
              {mic.calibrating && <b>۱ ثانیه سکوت؛ صدای اتاق را می‌سنجم.</b>}
              <label>
                حساسیت شنیدن{" "}
                <input aria-label="حساسیت شنیدن" type="range" min="1" max="6" step="1" value={mic.sensitivity ?? 2}
                  onChange={(e) => mic.setSensitivity(+e.target.value)} />
                <b>{fa(mic.sensitivity ?? 2)}</b>
              </label>
            </div>
          )}
          <div className="heard-note">
            آخرین صدای شنیده‌شده: <b>{heard === null ? "هنوز صدایی نشنیدم" : `${say(heard)} · ${noteName(heard)}`}</b>
          </div>
          <div className="game-buttons">
            {input === "mic" && (
              <button className="brick-button outline" onClick={async () => {
                if (await connect()) {
                  listening.current = true;
                  setStatus("میکروفون روشن است؛ سوراخ ۴ را فوت کن تا بشنوم.");
                }
              }}>
                <Mic /> آزمایش میکروفون
              </button>
            )}
            <button className="brick-button" onClick={async () => {
              if (input === "touch" || mic.active || (await connect())) begin(selected, mode);
            }}>
              <Play /> شروع
            </button>
          </div>
        </section>
      ) : screen === "play" ? (
        <div className="play-area">
          <div className="game-hud">
            <span className="hud-mode">{MODES[rm].icon} {MODES[rm].name}</span>
            {rm !== "listen" && <span>امتیاز <b>{fa(score)}</b></span>}
            {rm !== "listen" && <span className={combo >= 3 ? "hot" : ""}>پشت سر هم <b>{fa(combo)} 🔥</b></span>}
            <span><Gauge size={18} />{percent(speed)}</span>
            <button className="brick-button small" onClick={() => { stop(); setScreen("intro"); }}>
              <Pause /> توقف
            </button>
          </div>
          <div className="play-feedback" role="status">
            {input === "mic" && rm !== "listen" && mic.quality === "unclear"
              ? "صدا واضح نیست؛ فقط یک سوراخ، آرام و پیوسته."
              : feedback}
          </div>
          <div className="progress-bar"><i style={{ width: (100 * resolved.size) / rs.steps.length + "%" }} /></div>
          <div className="stage3d" dir="ltr">
            <div className="note-highway">
              <div className="lanes">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} style={{ left: `${i * 10}%`, width: "10%" } as React.CSSProperties} />
                ))}
              </div>
              {rs.steps.map((st, i) => {
                const bottom = ((rt[i] - time) / lead) * 100,
                  height = Math.max(4, (rl[i] / lead) * 100 - 1.2);
                if (bottom > 104 || bottom + height < -8 || resolved.has(i)) return null;
                return (
                  <div key={i}
                    className={"falling-note harp-note " + (lit.includes(st.midi) && Math.abs(rt[i] - time) < 900 ? "near" : "")}
                    style={{ left: `${(st.hole - 1) * 10}%`, width: "10%", bottom: `${bottom}%`, height: `${height}%`, "--c": color(st.blow) } as React.CSSProperties}>
                    <span>{fa(st.hole)}<small>{breath(st.blow)}</small></span>
                  </div>
                );
              })}
            </div>
            <div className="hit-line"><span>همین‌جا بزن</span></div>
            {time < lead - 1200 && <div className="countdown">{fa(Math.ceil((lead - 200 - time) / 1000))}</div>}
          </div>
          <Harp lit={lit} heard={heard} onPlay={input === "touch" && rm !== "listen" ? touchPlay : undefined} />
          {input === "mic" && rm !== "listen" && (
            <p className="game-caption">
              <b>{heard === null ? (mic.quality === "quiet" ? "هنوز صدایی نشنیدم — ساز را نزدیک‌تر بگیر" : "صدا می‌رسد، اما هنوز نتی تشخیص ندادم") : `می‌شنوم: ${say(heard)} · ${noteName(heard)}`}</b>
            </p>
          )}
        </div>
      ) : (
        <section className="game-result">
          <HarpBuddy cheer={rm === "listen" || earned > 0} />
          <h1>
            {rm === "listen" ? "دیدی چطوری بود؟ حالا نوبت توست!" : rm === "learn" ? "آفرین! یادش گرفتی 🎉" : earned ? "مرحله را رد کردی! 🏆" : "یک بار دیگر امتحان کنیم 💪"}
          </h1>
          {rm !== "listen" && (
            <>
              <div className="result-stars">
                {[0, 1, 2].map((n) => (
                  <i key={n} className={earned > n ? "on" : ""} style={{ animationDelay: n * 0.25 + "s" }}>★</i>
                ))}
              </div>
              <strong>{fa(score)} امتیاز</strong>
              <p>
                {rm === "learn"
                  ? `${fa(hits)} نت درست${errors.current ? ` · ${fa(errors.current)} بار اشتباه` : " · بدون حتی یک اشتباه!"}`
                  : `${fa(hits)} نت درست و به‌موقع از ${fa(rs.steps.length)} · سرعت ${percent(speed)}`}
              </p>
            </>
          )}
          <div className="mode-cards compact">
            {rm === "listen" && modeButton("learn", true)}
            {rm !== "listen" && (
              <button className="brick-button outline" onClick={() => void startMode(rm)}>
                <RotateCcw /> دوباره
              </button>
            )}
            {rm !== "rhythm" && modeButton("rhythm", rm === "learn")}
            {rm !== "listen" && records[rs.id]?.stars > 0 && selected + 1 < harpStages.length && (
              <button className="brick-button" onClick={() => choose(selected + 1)}>
                مرحلهٔ بعد <Play />
              </button>
            )}
          </div>
          <button className="text-button" onClick={() => setScreen("map")}>دیدن نقشه</button>
        </section>
      )}
    </div>
  );
}
