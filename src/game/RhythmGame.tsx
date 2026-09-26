import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  Piano,
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
import { readTuning, saveTuning, resolve, TUNING_KEYS } from "./tuning";
import { fa, noteName, western, songs } from "../curriculum";
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
  noteColor,
  type Stage,
  type Key,
  type Mode,
} from "./engine";
import type { Attempt } from "../storage";
import "./game.css";
import { TouchPiano } from "./TouchPiano";
import { audioContext, playNote } from "../audio";
import { harmonize, chordAt, beatOf, type Chord } from "../lessons/harmony";
import { playBand, strum, readBandOn, saveBandOn, type Band } from "../lessons/backing";
import { units, allLessons as lessonList, type Activity } from "../lessons/journey";
import { Talk, Jam, Ear, Find, Echo, Rhythm, Read, SongPick, type Bus } from "../lessons/Activities";
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
function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function saveList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* private browsing: progress lasts until the page closes */
  }
}
const today = () => new Date().toISOString().slice(0, 10);
/** The whole-song stage for a song id: the one a lesson plays and the Songs tab shares stars with. */
const songStage = (id: string) => {
  const i = stages.findIndex((s) => s.song === id && s.id.endsWith("-all"));
  return i >= 0 ? i : stages.findIndex((s) => s.song === id);
};
const ACTIVITY_ICON: Record<Activity["kind"], string> = {
  talk: "💬",
  jam: "🎸",
  ear: "👂",
  find: "🔍",
  echo: "🔁",
  rhythm: "🥁",
  read: "🔤",
  song: "🎵",
};
const percent = (s: number) => fa(Math.round(s * 100)) + "٪";
const BRICKS = ["#e3000b", "#ffcd00", "#0a6cd6", "#00a650", "#ff8a00", "#8e44ad"];
const PRAISE = ["آفرین! ✨", "عالی! 🎉", "همینه! 💪", "درست زدی! ⭐", "ایول! 🚀"];
const MODES: Record<Mode, { icon: string; name: string; hint: string }> = {
  listen: { icon: "👂", name: "گوش بده", hint: "اول ببین و بشنو آهنگ چطوری است" },
  learn: { icon: "🐢", name: "آروم با من", hint: "آجرها صبر می‌کنند تا کلید درست را بزنی" },
  rhythm: { icon: "⚡", name: "با ریتم", hint: "به‌موقع بزن و سه ستاره بگیر" },
};
/** A little robot built out of bricks, who cheers the child on. */
export function BrickBuddy({ cheer = false }: { cheer?: boolean }) {
  return (
    <svg className={"brick-buddy" + (cheer ? " cheer" : "")} viewBox="0 0 120 130" aria-hidden="true">
      <g className="arms">
        <rect x="6" y="72" width="20" height="12" rx="4" fill="#ffcd00" transform={cheer ? "rotate(-50 26 78)" : ""} />
        <rect x="94" y="72" width="20" height="12" rx="4" fill="#ffcd00" transform={cheer ? "rotate(50 94 78)" : ""} />
      </g>
      <rect x="26" y="64" width="68" height="46" rx="6" fill="#e3000b" />
      <circle cx="46" cy="87" r="7" fill="#b3000a" />
      <circle cx="74" cy="87" r="7" fill="#b3000a" />
      <rect x="34" y="110" width="20" height="16" rx="3" fill="#0a6cd6" />
      <rect x="66" y="110" width="20" height="16" rx="3" fill="#0a6cd6" />
      <rect x="44" y="4" width="32" height="12" rx="3" fill="#ffcd00" />
      <rect x="24" y="14" width="72" height="50" rx="10" fill="#ffcd00" />
      <circle cx="46" cy="36" r="6" fill="#222" />
      <circle cx="74" cy="36" r="6" fill="#222" />
      <circle cx="48" cy="34" r="2" fill="#fff" />
      <circle cx="76" cy="34" r="2" fill="#fff" />
      <path d={cheer ? "M44 48 Q60 62 76 48 Z" : "M46 49 Q60 58 74 49"} fill={cheer ? "#222" : "none"} stroke="#222" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
/** Every star the child has ever earned becomes a brick in their tower. */
function Tower({ count }: { count: number }) {
  const shown = Math.min(count, 36);
  return (
    <div className="tower" aria-label={`برج آجری: ${fa(count)} آجر`}>
      <div className="tower-bricks">
        {Array.from({ length: shown }, (_, i) => (
          <i key={i} style={{ background: BRICKS[Math.floor(i / 3) % BRICKS.length] }} />
        ))}
      </div>
      <b>{fa(count)} آجر</b>
      <small>{fa(3 - (count % 3))} ستارهٔ دیگر تا طبقهٔ بعد</small>
    </div>
  );
}
export function RhythmGame({
  onExit,
  onHarmonica,
  onSave,
  openStage,
}: {
  onExit: () => void;
  /** Switch the child over to the harmonica world. */
  onHarmonica?: () => void;
  onSave: (a: Attempt) => void;
  /** A stage to jump straight into, from the song library. Ignores the usual unlock order. */
  openStage?: string;
}) {
  const [input, setInput] = useState<"touch" | "mic">("touch");
  const [screen, setScreen] = useState<
      "map" | "intro" | "tune" | "ready" | "play" | "result" | "lesson"
    >("map"),
    [tab, setTab] = useState<"path" | "songs" | "free">("path"),
    [openUnit, setOpenUnit] = useState<number | null>(null),
    [passed, setPassed] = useState(() => readList("mahour-journey")),
    [days, setDays] = useState(() => readList("mahour-days")),
    [lesson, setLesson] = useState<{ id: string; step: number } | null>(null),
    [bandOn, setBandOnState] = useState(readBandOn),
    [openWorld, setOpenWorld] = useState<number | null>(null),
    [openSong, setOpenSong] = useState<string | null>(null),
    [mode, setMode] = useState<Mode>("rhythm"),
    [earned, setEarned] = useState(0),
    [selected, setSelected] = useState(0),
    [records, setRecords] = useState(load),
    [offset, setOffset] = useState(() => readTuning() ?? 0),
    [tuned, setTuned] = useState(() => readTuning() !== null),
    [asked, setAsked] = useState(0),
    [replies, setReplies] = useState<number[]>([]),
    [speed, setSpeedState] = useState(readSpeed),
    [status, setStatus] = useState(""),
    [heard, setHeard] = useState<number | null>(null),
    [time, setTime] = useState(0),
    [feedback, setFeedback] = useState(""),
    [flash, setFlash] = useState(""),
    [score, setScore] = useState(0),
    [hits, setHits] = useState(0),
    [combo, setCombo] = useState(0),
    [resolved, setResolved] = useState<Set<number>>(new Set()),
    [bursts, setBursts] = useState<{ id: number; midi: number }[]>([]);
  const effectiveOffset = input === "touch" ? 0 : offset;
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
    burstId = useRef(0),
    clear = useRef(false),
    tuning = useRef(false),
    answers = useRef<number[]>([]),
    flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    handler = useRef<(m: number) => void>(() => {}),
    resume = useRef<HTMLButtonElement | null>(null),
    band = useRef<Band | null>(null),
    lessonMic = useRef(false),
    bus: Bus = useRef(null);
  /** The run in flight: fixed at the moment play starts, so a stale render cannot retime it. */
  const run = useRef<{
    stage: Stage;
    times: number[];
    lengths: number[];
    tol: number;
    keys: Key[];
    mode: Mode;
    chords: Chord[];
  }>({
    chords: [],
    stage: stages[0],
    times: [],
    lengths: [],
    tol: 1,
    keys: board(stages[0].steps),
    mode: "rhythm",
  });
  const stage = stages[selected];
  const mic = useMicrophone(
    (m) => handler.current(m),
    () =>
      input === "mic" &&
      (live.current || listening.current || tuning.current || lessonMic.current),
  );
  const signal = useRef(mic.quality);
  signal.current = mic.quality;
  const pulse = (good: boolean, text: string) => {
    setFlash(good ? "success" : "error");
    setFeedback(text);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 450);
  };
  const burst = (midi: number) => {
    const id = ++burstId.current;
    setBursts((b) => [...b, { id, midi }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 700);
  };
  const stop = () => {
    epoch.current++;
    band.current?.stop();
    band.current = null;
    lessonMic.current = false;
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
  const practised = () => {
    if (days.includes(today())) return;
    const next = [...days, today()].slice(-60);
    setDays(next);
    saveList("mahour-days", next);
  };
  const finish = () => {
    const { stage: s, mode: how } = run.current;
    band.current?.stop();
    band.current = null;
    practised();
    live.current = false;
    mic.stop();
    cancelAnimationFrame(clock.current);
    setScreen("result");
    // Listening is a demonstration: nothing is scored, saved or unlocked.
    if (how === "listen") return setEarned(0);
    // Finishing the patient mode always earns the first star; rhythm earns the other two.
    const n = how === "learn" ? 1 : stars(hit.current, s.steps.length);
    setEarned(n);
    // Two or three misses in a row is the cue to make it easier, not to try harder at the same speed.
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
      localStorage.setItem("mahour-game", JSON.stringify(next));
    } catch {
      setStatus("ذخیره‌سازی مرورگر بسته است؛ نتیجه فقط تا بستن صفحه می‌ماند.");
    }
    onSave({
      id: s.id,
      at: new Date().toISOString(),
      correct: hit.current,
      wrong: errors.current,
      accuracy: Math.round(
        (100 * hit.current) /
          (how === "learn" ? hit.current + errors.current || 1 : s.steps.length),
      ),
      seconds: Math.round((performance.now() - start.current) / 1000),
      source: input === "touch" ? "screen" : "mic",
      partial: false,
      mode: how === "learn" ? "wait-mode" : "falling-notes",
      rhythm:
        how === "learn" ? null : Math.round((hit.current / s.steps.length) * 100),
      baseMidi: 60 + effectiveOffset,
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
  const begin = (index = selected, how: Mode = mode) => {
    const s = stages[index];
    const tol = tolerance(speed),
      window = windowFor(tol),
      beat = 60000 / (s.bpm * speed);
    const times = schedule(
      s.steps.map((step) => step.beats),
      s.bpm * speed,
    );
    const lengths = s.steps.map((step) => step.beats * beat);
    const chords = harmonize(s.steps);
    run.current = { stage: s, times, lengths, tol, keys: board(s.steps), mode: how, chords };
    clear.current = input === "touch" || how !== "rhythm";
    listening.current = false;
    done.current = new Set();
    hit.current = 0;
    points.current = 0;
    streak.current = 0;
    errors.current = 0;
    slipped.current = false;
    setScore(0);
    setHits(0);
    setCombo(0);
    setResolved(new Set());
    setBursts([]);
    setTime(0);
    setFeedback(
      how === "listen"
        ? "نگاه کن و گوش بده؛ پیانو خودش می‌زند 🎶"
        : how === "learn"
          ? "هر آجر روی خط زرد منتظرت می‌ماند؛ کلید هم‌رنگش را بزن"
          : "وقتی آجر به خط زرد رسید، کلیدش را بزن",
    );
    setFlash("");
    start.current = performance.now();
    live.current = true;
    setScreen("play");
    // The band counts the child in and plays under the melody; wait mode answers each note instead.
    if (bandOn && how !== "learn") {
      const token = epoch.current;
      playBand(chords, s.bpm * speed, times[0])
        .then((b) => {
          if (token === epoch.current && live.current) band.current = b;
          else b.stop();
        })
        .catch(() => {});
    }
    const deaf = Math.min(3, times.length);
    const frame = () => {
      if (!live.current) return;
      const now = performance.now();
      let elapsed = now - start.current;
      if (how === "learn") {
        // Wait mode: the clock stops with the next brick sitting on the line until it is played.
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
            burst(s.steps[i].midi);
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
  const score1 = (index: number, gain: number, text: string, midi: number) => {
    done.current.add(index);
    hit.current++;
    streak.current++;
    points.current += gain;
    setScore(points.current);
    setHits(hit.current);
    setCombo(streak.current);
    setResolved(new Set(done.current));
    burst(midi);
    pulse(
      true,
      streak.current >= 5 && streak.current % 5 === 0
        ? `${fa(streak.current)} تا پشت سر هم! 🔥`
        : text,
    );
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
    if (lessonMic.current) {
      bus.current?.(m - offset);
      return;
    }
    if (listening.current) {
      setStatus(`${noteName(m)} شنیدم — میکروفون درست کار می‌کند.`);
      return;
    }
    if (!live.current) return;
    const { stage: s, times, tol, mode: how } = run.current;
    if (how === "listen") return;
    const window = windowFor(tol);
    const elapsed = performance.now() - start.current;
    // The count-in is free warm-up: notes played before the first one is even catchable are
    // neither judged nor counted, and the gate is re-armed so the real attempt still lands.
    if (elapsed < times[0] - window) {
      if (input === "mic") mic.rearm();
      setFeedback("صبر کن تا آجر به خط زرد برسد");
      return;
    }
    const rebase = (octave: number) => {
      // Playing the right note an octave out settles which octave the keyboard sits in, so the
      // guide and the notes still to come line up with what the child is actually touching.
      if (octave && input === "mic") {
        setOffset(offset + octave);
        saveTuning(offset + octave);
      }
    };
    if (how === "learn") {
      const n = times.findIndex((_, i) => !done.current.has(i));
      if (n < 0) return;
      const want = s.steps[n].midi + effectiveOffset;
      if (elapsed < times[n] - window) {
        if (input === "mic") mic.rearm();
        setFeedback("صبر کن تا آجر به خط زرد برسد 🙂");
        return;
      }
      const octave =
        input === "mic" && m !== want && (m - want) % 12 === 0 ? m - want : 0;
      if (m === want || octave) {
        rebase(octave);
        score1(n, slipped.current ? 50 : 100, PRAISE[hit.current % PRAISE.length], s.steps[n].midi);
        if (bandOn)
          void strum(chordAt(run.current.chords, beatOf(s.steps, n)), 0.8).catch(() => {});
        slipped.current = false;
      } else {
        errors.current++;
        slipped.current = true;
        streak.current = 0;
        setCombo(0);
        pulse(
          false,
          `${noteName(m)} زدی؛ کلید ${keyLabel(s.steps[n].midi)} (${noteName(s.steps[n].midi)}) را بزن — همان که می‌درخشد`,
        );
      }
      return;
    }
    const pending = s.steps
      .map((step, index) => ({
        index,
        at: times[index],
        midi: step.midi + effectiveOffset,
      }))
      .filter((p) => !done.current.has(p.index));
    const { pick, matched, octave } = match(
      m,
      pending,
      elapsed,
      window,
      input === "mic",
    );
    if (!pick) return;
    rebase(octave);
    const delta = elapsed - pick.at;
    if (matched) {
      const perfect = Math.abs(delta) <= PERFECT * tol;
      score1(
        pick.index,
        perfect ? 100 : 60,
        perfect ? "عالی! دقیق روی ضرب ✨" : "درست بود! 👍",
        s.steps[pick.index].midi,
      );
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
    if (
      screen === "play" &&
      input === "mic" &&
      run.current.mode !== "listen" &&
      !mic.active
    ) {
      stop();
      setScreen("ready");
      setStatus(
        "اتصال میکروفون قطع شد؛ امتیاز این اجرای ناتمام ثبت نشد. دوباره وصل کن.",
      );
    }
  }, [mic.active, screen, input]);
  const unlocked = (i: number) =>
    i === 0 || (records[stages[i - 1].id]?.stars ?? 0) >= 1;
  const next = stages.findIndex((s, i) => unlocked(i) && !records[s.id]?.stars);
  const lessonOpen = (k: number) => k === 0 || passed.includes(lessonList[k - 1].id);
  const nextLesson = lessonList.findIndex(
    (l, k) => lessonOpen(k) && !passed.includes(l.id),
  );

  const currentWorld = openWorld ?? stages[Math.max(0, next)].world;
  const totalStars = Object.values(records).reduce((n, r) => n + r.stars, 0);
  const opened = useRef(false);
  useEffect(() => {
    if (openStage && !opened.current) {
      opened.current = true;
      const i = stages.findIndex((s) => s.id === openStage);
      if (i >= 0) choose(i);
    }
  }, [openStage]);
  useEffect(() => {
    // Only jump into the map once there is progress to jump to; a fresh child starts at the top.
    if (screen === "map" && tab === "path" && nextLesson > 0)
      resume.current?.scrollIntoView?.({ block: "center" });
  }, [screen, nextLesson, tab]);
  useEffect(() => {
    if (screen === "play")
      document
        .querySelector(".rhythm-game")
        ?.scrollIntoView?.({ block: "start" });
  }, [screen]);
  const setBand = (on: boolean) => {
    setBandOnState(on);
    saveBandOn(on);
    if (!on) {
      band.current?.stop();
      band.current = null;
    }
  };
  const lessonAt = (id: string) => lessonList.find((l) => l.id === id)!;
  const knows = (id: string, n = 1) =>
    (records[stages[songStage(id)]?.id]?.stars ?? 0) >= n;
  /** Enter a lesson at one of its activities; a real piano is listened to the whole way through. */
  const openLesson = (id: string, step = 0) => {
    stop();
    setLesson({ id, step });
    setScreen("lesson");
    if (input === "mic")
      void connect().then((ok) => {
        if (ok) lessonMic.current = true;
      });
  };
  const advance = () => {
    if (!lesson) return;
    practised();
    const l = lessonAt(lesson.id),
      step = lesson.step + 1;
    if (step >= l.activities.length && !passed.includes(l.id)) {
      const list = [...passed, l.id];
      setPassed(list);
      saveList("mahour-journey", list);
    }
    openLesson(l.id, step);
  };
  /** A review offers only songs already played; the child always picks from at most three. */
  const choicesFor = (a: Extract<Activity, { kind: "song" }>) => {
    const known = a.review ? a.songs.filter((id) => knows(id)) : a.songs;
    return (known.length ? known : a.songs).slice(0, 3);
  };
  const activityView = (a: Activity) => {
    const props = { input, bus, onDone: advance };
    switch (a.kind) {
      case "talk":
        return <Talk activity={a} {...props} />;
      case "jam":
        return <Jam activity={a} {...props} />;
      case "ear":
        return <Ear activity={a} {...props} />;
      case "find":
        return <Find activity={a} {...props} />;
      case "echo":
        return <Echo activity={a} {...props} />;
      case "rhythm":
        return <Rhythm activity={a} {...props} />;
      case "read":
        return <Read activity={a} {...props} />;
      case "song":
        return (
          <SongPick
            activity={a}
            choices={choicesFor(a)}
            onSong={(id, how) => void startMode(how, songStage(id))}
          />
        );
    }
  };
  /** Tapping a stage opens its card, where the child picks how to play it. */
  const choose = (i: number) => {
    stop();
    setLesson(null);
    setSelected(i);
    setHeard(null);
    setStatus("");
    setScreen("intro");
  };
  /** One tap starts touch audio or connects the selected physical input. */
  const startMode = async (how: Mode, i = selected) => {
    stop();
    setMode(how);
    setSelected(i);
    setHeard(null);
    // A demonstration never listens, so it needs no microphone and no introduction to the piano.
    if (input === "touch" || how === "listen") {
      setScreen("ready");
      const token = epoch.current;
      try {
        await audioContext();
        if (token === epoch.current) begin(i, how);
      } catch {
        setStatus(
          "صدا فعال نشد؛ صدای دستگاه را بررسی کن و دوباره شروع را بزن.",
        );
      }
      return;
    }
    // The very first time, learn the child's piano before asking them to play against it.
    if (!tuned) return void tune();
    setScreen("ready");
    if (await connect()) begin(i, how);
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
        {speed === 1 ? "سرعت واقعی آهنگ 🐇" : "آرام‌تر؛ فرصت بیشتر برای هر نت 🐢"}
      </small>
    </div>
  );
  const stageButton = (i: number, free = false, label?: string) => {
    const s = stages[i],
      locked = !free && !unlocked(i),
      r = records[s.id],
      short =
        label ??
        (s.title.replace(worldList[s.world].title, "").replace(/^ · /, "").trim() ||
          fa(i + 1));
    return (
      <div className="stage-slot" key={s.id}>
        <button
          ref={!free && i === next ? resume : undefined}
          disabled={locked}
          className={`stage-brick ${r?.stars ? "won" : ""} ${!free && i === next ? "next" : ""}`}
          style={{ "--c": BRICKS[s.world % BRICKS.length] } as React.CSSProperties}
          onClick={() => choose(i)}
          aria-label={`مرحله ${i + 1}: ${s.title}`}
        >
          <span>{locked ? <Lock /> : short}</span>
        </button>
        <small className="stage-stars">
          {[0, 1, 2].map((n) => (
            <i key={n} className={(r?.stars ?? 0) > n ? "on" : ""}>
              ★
            </i>
          ))}
        </small>
      </div>
    );
  };
  const modeButton = (how: Mode, primary = false) => (
    <button
      key={how}
      className={`mode-card ${how} ${primary ? "primary" : ""}`}
      aria-label={MODES[how].name}
      onClick={() => void startMode(how)}
    >
      <span className="mode-icon">{MODES[how].icon}</span>
      <b>{MODES[how].name}</b>
      <small>{MODES[how].hint}</small>
      {primary && <em>پیشنهاد من</em>}
    </button>
  );
  const week = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + k);
    return d.toISOString().slice(0, 10);
  });
  const recommended: Mode = records[stage.id]?.stars ? "rhythm" : "learn";
  // Keys to glow: the demo's note, the brick waiting on the line, or any brick inside its window.
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
  return (
    <div
      className={`rhythm-game ${flash} ${input === "touch" ? "touch-mode" : ""}`}
    >
      <header className="game-header">
        <button
          className="brick-button small"
          onClick={() => {
            stop();
            setLesson(null);
            if (screen === "map") onExit();
            else setScreen("map");
          }}
        >
          <ArrowRight />
          {screen === "map" ? "بخش والدین" : "نقشه"}
        </button>
        <b className="logo">
          <i />
          ماهور و شهر آجری موسیقی
        </b>
        <span className="star-count">⭐ {fa(totalStars)}</span>
      </header>
      {screen === "map" ? (
        <div className="world-map">
          {onHarmonica && (
            <div className="instrument-switch" role="tablist" aria-label="ساز">
              <button role="tab" aria-selected className="on">
                <Piano size={18} /> پیانو
              </button>
              <button
                role="tab"
                aria-selected={false}
                onClick={() => {
                  stop();
                  onHarmonica();
                }}
              >
                🎵 سازدهنی
              </button>
            </div>
          )}
          <section className="hero-card">
            <BrickBuddy cheer={totalStars + passed.length > 0} />
            <div>
              <h1>سلام ماهور! 👋</h1>
              <p>
                {nextLesson >= 0
                  ? `درس بعدی: ${lessonList[nextLesson].title}`
                  : "همهٔ درس‌ها را تمام کردی! حالا برای خانواده کنسرت بده."}
              </p>
              {nextLesson >= 0 && (
                <button
                  className="brick-button big"
                  onClick={() => openLesson(lessonList[nextLesson].id)}
                >
                  <Play /> ادامه بده
                </button>
              )}
              <div className="week" aria-label="تمرین این هفته">
                {week.map((d) => (
                  <i key={d} className={days.includes(d) ? "on" : ""} />
                ))}
                <small>
                  این هفته {fa(week.filter((d) => days.includes(d)).length)} روز
                  تمرین · هدف: ۳ روز
                </small>
              </div>
            </div>
            <Tower count={totalStars + passed.length} />
          </section>
          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === "path"}
              className={tab === "path" ? "on" : ""}
              onClick={() => setTab("path")}
            >
              🗺️ مسیر یادگیری
            </button>
            <button
              role="tab"
              aria-selected={tab === "songs"}
              className={tab === "songs" ? "on" : ""}
              onClick={() => setTab("songs")}
            >
              🎵 آهنگ‌ها
            </button>
            <button
              role="tab"
              aria-selected={tab === "free"}
              className={tab === "free" ? "on" : ""}
              onClick={() => setTab("free")}
            >
              🧱 تمرین آزاد
            </button>
          </div>
          {tab === "path"
            ? units.map((u, ui) => {
                const list = lessonList.filter((l) => l.unit === ui),
                  got = list.filter((l) => passed.includes(l.id)).length,
                  closed = !lessonOpen(lessonList.indexOf(list[0])),
                  open =
                    (openUnit ?? lessonList[Math.max(0, nextLesson)].unit) === ui;
                return (
                  <section
                    key={ui}
                    className={`world-card ${open ? "open" : ""} ${closed ? "closed" : ""}`}
                    style={{ "--c": BRICKS[ui % BRICKS.length] } as React.CSSProperties}
                  >
                    <button
                      className="world-title"
                      aria-expanded={open}
                      onClick={() => setOpenUnit(open ? -1 : ui)}
                    >
                      <span className="world-number">
                        {closed ? <Lock size={20} /> : u.icon}
                      </span>
                      <span>
                        <small>واحد {fa(ui + 1)}</small>
                        <b>{u.title}</b>
                      </span>
                      <em>
                        {fa(got)}/{fa(list.length)}
                      </em>
                    </button>
                    {open && (
                      <div className="lesson-list">
                        {list.map((l) => {
                          const k = lessonList.indexOf(l),
                            ok = lessonOpen(k),
                            won = passed.includes(l.id);
                          return (
                            <button
                              key={l.id}
                              ref={k === nextLesson ? resume : undefined}
                              disabled={!ok}
                              className={`lesson-row ${won ? "won" : ""} ${k === nextLesson ? "next" : ""}`}
                              onClick={() => openLesson(l.id)}
                              aria-label={`درس ${l.title}`}
                            >
                              <span className="lesson-num">
                                {won ? "✓" : ok ? fa(k + 1) : <Lock size={18} />}
                              </span>
                              <span>
                                <b>{l.title}</b>
                                <small>{l.skill}</small>
                              </span>
                              <em>
                                {l.activities
                                  .map((a) => ACTIVITY_ICON[a.kind])
                                  .join(" ")}
                              </em>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            : tab === "free"
            ? worldList.map((w) => {
                const list = stages
                    .map((s, i) => ({ s, i }))
                    .filter((x) => x.s.world === w.index),
                  got = list.filter((x) => records[x.s.id]?.stars).length,
                  closed = !unlocked(w.from),
                  open = currentWorld === w.index;
                return (
                  <section
                    key={w.index}
                    className={`world-card ${open ? "open" : ""} ${closed ? "closed" : ""}`}
                    style={{ "--c": BRICKS[w.index % BRICKS.length] } as React.CSSProperties}
                  >
                    <button
                      className="world-title"
                      aria-expanded={open}
                      onClick={() => setOpenWorld(open ? -1 : w.index)}
                    >
                      <span className="world-number">
                        {closed ? <Lock size={20} /> : fa(w.index + 1)}
                      </span>
                      <span>
                        <b>{w.title}</b>
                        <small>{w.hint}</small>
                      </span>
                      <em>
                        {fa(got)}/{fa(list.length)}
                      </em>
                    </button>
                    {open && (
                      <div className="stage-grid">
                        {list.map((x) => stageButton(x.i))}
                      </div>
                    )}
                  </section>
                );
              })
            : [...songs]
                .sort((a, b) => a.level - b.level)
                .filter((song) => stages.some((s) => s.song === song.id))
                .map((song, n) => {
                  const list = stages
                      .map((s, i) => ({ s, i }))
                      .filter((x) => x.s.song === song.id),
                    got = list.reduce((t, x) => t + (records[x.s.id]?.stars ?? 0), 0),
                    open = openSong === song.id;
                  return (
                    <section
                      key={song.id}
                      className={`world-card song ${open ? "open" : ""}`}
                      style={{ "--c": BRICKS[n % BRICKS.length] } as React.CSSProperties}
                    >
                      <button
                        className="world-title"
                        aria-expanded={open}
                        onClick={() => setOpenSong(open ? null : song.id)}
                      >
                        <span className="world-number">🎵</span>
                        <span>
                          <b>{song.title}</b>
                          <small>{song.subtitle}</small>
                        </span>
                        <em>⭐ {fa(got)}</em>
                      </button>
                      {open && (
                        <div className="stage-grid">
                          {list.map((x) =>
                            stageButton(
                              x.i,
                              true,
                              x.s.id.startsWith("concert-")
                                ? "🎤 کنسرت"
                                : undefined,
                            ),
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
          <footer className="grown-ups">
            <small>با چه پیانویی می‌زنی؟</small>
            <div className="input-choice" role="group" aria-label="روش نواختن">
              <button
                className={input === "touch" ? "on" : ""}
                aria-pressed={input === "touch"}
                onClick={() => {
                  stop();
                  setInput("touch");
                }}
              >
                پیانوی لمسی · بدون میکروفون
              </button>
              <button
                className={input === "mic" ? "on" : ""}
                aria-pressed={input === "mic"}
                onClick={() => {
                  stop();
                  setInput("mic");
                }}
              >
                کیبورد واقعی · میکروفون
              </button>
            </div>
            {input === "mic" && (
              <div className="mic-tools">
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
              </div>
            )}
          </footer>
        </div>
      ) : screen === "lesson" && lesson ? (
        (() => {
          const l = lessonAt(lesson.id),
            u = units[l.unit],
            a = l.activities[lesson.step],
            after = lessonList[lessonList.indexOf(l) + 1];
          return (
            <section className="lesson">
              <div className="lesson-head">
                <small>
                  {u.icon} {u.title}
                </small>
                <h1>{l.title}</h1>
                <div className="lesson-steps" aria-label="قدم‌های درس">
                  {l.activities.map((x, k) => (
                    <i
                      key={k}
                      className={
                        k < lesson.step ? "done" : k === lesson.step ? "now" : ""
                      }
                    >
                      {ACTIVITY_ICON[x.kind]}
                    </i>
                  ))}
                </div>
              </div>
              {a ? (
                <div key={lesson.id + lesson.step}>{activityView(a)}</div>
              ) : (
                <div className="lesson-done">
                  <BrickBuddy cheer />
                  <h2>آفرین ماهور! 🎉</h2>
                  <p className="skill">
                    حالا بلدی: <b>{l.skill}</b>
                  </p>
                  <div className="game-buttons">
                    {after && (
                      <button
                        className="brick-button big"
                        onClick={() => openLesson(after.id)}
                      >
                        درس بعدی: {after.title} ▶
                      </button>
                    )}
                    <button
                      className="text-button"
                      onClick={() => {
                        stop();
                        setLesson(null);
                        setScreen("map");
                      }}
                    >
                      دیدن نقشه
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })()
      ) : screen === "intro" ? (
        <section className="stage-intro">
          <small>
            {worldList[stage.world].title} · مرحلهٔ {fa(selected + 1)}
          </small>
          <h1>{stage.title}</h1>
          <div className="note-preview" dir="ltr" aria-hidden="true">
            {stage.steps.slice(0, 14).map((st, i) => (
              <i
                key={i}
                style={
                  { "--c": noteColor(st.midi), flexGrow: st.beats } as React.CSSProperties
                }
              >
                {keyLabel(st.midi)}
              </i>
            ))}
            {stage.steps.length > 14 && <span>…</span>}
          </div>
          <p>
            {fa(stage.steps.length)} آجر ·{" "}
            {records[stage.id]?.stars
              ? "★".repeat(records[stage.id].stars) + " گرفته‌ای"
              : "هنوز ستاره نداری"}
          </p>
          <div className="mode-cards">
            {(["listen", "learn", "rhythm"] as Mode[]).map((how) =>
              modeButton(how, how === recommended),
            )}
          </div>
          {speedPicker}
          {status && <p role="status">{status}</p>}
        </section>
      ) : screen === "tune" ? (
        <section className="game-ready tune-screen">
          <BrickBuddy />
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
                style={{ "--c": noteColor(midi) } as React.CSSProperties}
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
                className="brick-button"
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
      ) : screen === "ready" && input === "touch" ? (
        <section className="game-ready">
          <h1>{stage.title}</h1>
          <p role="status">
            {status || "کلیدها را امتحان کن، سپس بازی را شروع کن."}
          </p>
          <button
            className="brick-button"
            onClick={() => void startMode(mode)}
          >
            شروع بازی با پیانوی لمسی
          </button>
          <TouchPiano
            steps={stage.steps}
            onNote={setHeard}
            onError={() => setStatus("صدای دستگاه را بررسی کن.")}
          />
        </section>
      ) : screen === "ready" ? (
        <section className="game-ready">
          <BrickBuddy />
          <span>مرحلهٔ {fa(selected + 1)}</span>
          <h1>{stage.title}</h1>
          <p>
            آجرها از بالا می‌آیند. وقتی به خط زرد رسیدند، همان شماره را روی
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
              className="brick-button outline"
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
              className="brick-button"
              onClick={async () => {
                if (mic.active || (await connect())) begin(selected, mode);
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
        <div className="play-area">
          <div className="game-hud">
            <span className="hud-mode">
              {MODES[rm].icon} {MODES[rm].name}
            </span>
            {rm !== "listen" && (
              <span>
                امتیاز <b>{fa(score)}</b>
              </span>
            )}
            {rm !== "listen" && (
              <span className={combo >= 3 ? "hot" : ""}>
                پشت سر هم <b>{fa(combo)} 🔥</b>
              </span>
            )}
            <span>
              <Gauge size={18} />
              {percent(speed)}
            </span>
            <button
              className={"band-toggle " + (bandOn ? "on" : "")}
              aria-pressed={bandOn}
              onClick={() => setBand(!bandOn)}
            >
              🎸 گروه {bandOn ? "روشن" : "خاموش"}
            </button>
            {input === "mic" && rm !== "listen" && (
              <span>
                <Mic size={18} />
                {mic.active ? "گوش می‌دهم" : "میکروفون قطع شد"}
              </span>
            )}
            <button
              className="brick-button small"
              onClick={() => {
                stop();
                if (lesson) openLesson(lesson.id, lesson.step);
                else setScreen("intro");
              }}
            >
              <Pause />
              توقف
            </button>
          </div>
          <div className="play-feedback" role="status">
            {input === "mic" && rm !== "listen" && mic.quality === "unclear"
              ? "صدا واضح نیست؛ فقط یک کلید و بدون پدال بزن."
              : feedback}
          </div>
          <div className="progress-bar">
            <i style={{ width: (100 * resolved.size) / rs.steps.length + "%" }} />
          </div>
          <div className="stage3d" dir="ltr">
            <div className="note-highway">
              <div className="lanes">
                {run.current.keys.map((k) => (
                  <div
                    key={k.midi}
                    className={k.white ? "" : "black"}
                    style={
                      {
                        left: `${k.left}%`,
                        width: `${k.width}%`,
                        "--c": noteColor(k.midi),
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
              {rs.steps.map((s, i) => {
                const bottom = ((rt[i] - time) / lead) * 100,
                  height = Math.max(4, (rl[i] / lead) * 100 - 1.2);
                if (bottom > 104 || bottom + height < -8 || resolved.has(i))
                  return null;
                const k = run.current.keys.find((x) => x.midi === s.midi)!;
                return (
                  <div
                    key={i}
                    className={
                      "falling-note " +
                      (k.white ? "" : "black ") +
                      (lit.includes(s.midi) && Math.abs(rt[i] - time) < 900
                        ? "near"
                        : "")
                    }
                    style={
                      {
                        left: `${k.left}%`,
                        width: `${k.width}%`,
                        bottom: `${bottom}%`,
                        height: `${height}%`,
                        "--c": noteColor(s.midi),
                      } as React.CSSProperties
                    }
                  >
                    <span>{keyLabel(s.midi)}</span>
                  </div>
                );
              })}
            </div>
            <div className="hit-line">
              <span>همین‌جا بزن</span>
            </div>
            {bursts.map((b) => {
              const k = run.current.keys.find((x) => x.midi === b.midi);
              return (
                k && (
                  <div
                    key={b.id}
                    className="burst"
                    style={
                      {
                        left: `${k.left + k.width / 2}%`,
                        "--c": noteColor(b.midi),
                      } as React.CSSProperties
                    }
                  >
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <i key={n} style={{ "--a": n * 60 + "deg" } as React.CSSProperties} />
                    ))}
                  </div>
                )
              );
            })}
            {time < lead - 1200 && (
              <div className="countdown">
                {fa(Math.ceil((lead - 200 - time) / 1000))}
              </div>
            )}
          </div>
          {input === "touch" ? (
            <>
              <TouchPiano
                steps={rs.steps}
                lit={lit}
                onNote={(m) => handler.current(m)}
                onError={() =>
                  setFeedback("صدای دستگاه پخش نشد؛ صدا را روشن کن.")
                }
              />
              <p className="game-caption">
                با کامپیوتر: A S D F G H J K
              </p>
            </>
          ) : (
            <>
              <div className="touch-piano-wrapper">
                <div className="game-piano touch-piano guide" dir="ltr">
                  {run.current.keys.map((k) => (
                    <div
                      key={k.midi}
                      className={
                        (k.white ? "" : "black ") +
                        (heard === k.midi + offset ? "pressed " : "") +
                        (lit.includes(k.midi) ? "lit" : "")
                      }
                      style={
                        {
                          left: `${k.left}%`,
                          width: `${k.width}%`,
                          "--c": noteColor(k.midi),
                        } as React.CSSProperties
                      }
                    >
                      <b>{keyLabel(k.midi)}</b>
                      {k.white && <small>{noteName(k.midi)}</small>}
                    </div>
                  ))}
                </div>
              </div>
              {rm !== "listen" && (
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
              )}
            </>
          )}
        </div>
      ) : (
        <section className="game-result">
          <BrickBuddy cheer={rm === "listen" || earned > 0} />
          <h1>
            {rm === "listen"
              ? "دیدی چطوری بود؟ حالا نوبت توست!"
              : rm === "learn"
                ? "آفرین! یادش گرفتی 🎉"
                : earned
                  ? "مرحله را رد کردی! 🏆"
                  : "یک بار دیگر امتحان کنیم 💪"}
          </h1>
          {rm !== "listen" && (
            <>
              <div className="result-stars">
                {[0, 1, 2].map((n) => (
                  <i key={n} className={earned > n ? "on" : ""} style={{ animationDelay: n * 0.25 + "s" }}>
                    ★
                  </i>
                ))}
              </div>
              <strong>{fa(score)} امتیاز</strong>
              <p>
                {rm === "learn"
                  ? `${fa(hits)} آجر ساختی${errors.current ? ` · ${fa(errors.current)} بار کلید اشتباه` : " · بدون حتی یک اشتباه!"}`
                  : `${fa(hits)} نت درست و به‌موقع از ${fa(rs.steps.length)} · سرعت ${percent(speed)}`}
              </p>
            </>
          )}
          {rm === "learn" && (
            <p>حالا «با ریتم» بزن تا ستاره‌های دوم و سوم را هم بگیری.</p>
          )}
          {rm === "rhythm" && speed < 1 && earned >= 2 && (
            <p>عالی بود! حالا سرعت را یک پله بالا ببر و دوباره بزن.</p>
          )}
          {rm === "rhythm" && earned === 0 && (
            <p>
              اول «آروم با من» را بزن، یا سرعت را کمتر کن. برای رد شدن، ۶۰٪
              نت‌ها را به‌موقع بزن.
            </p>
          )}
          {lesson && (
            <div className="game-buttons">
              <button className="brick-button big" onClick={advance}>
                ادامهٔ درس ▶
              </button>
              <button
                className="brick-button outline"
                onClick={() => void startMode(rm)}
              >
                <RotateCcw />
                دوباره
              </button>
            </div>
          )}
          {!lesson && (
          <div className="mode-cards compact">
            {rm === "listen" && modeButton("learn", true)}
            {rm !== "listen" && (
              <button
                className="brick-button outline"
                onClick={() => void startMode(rm)}
              >
                <RotateCcw />
                دوباره بازی کن
              </button>
            )}
            {rm !== "rhythm" && modeButton("rhythm", rm === "learn")}
            {rm !== "listen" &&
              records[rs.id]?.stars > 0 &&
              selected + 1 < stages.length && (
                <button
                  className="brick-button"
                  onClick={() => choose(selected + 1)}
                >
                  مرحلهٔ بعد <Play />
                </button>
              )}
          </div>
          )}
          {rm === "rhythm" && earned === 0 && speed > 0.5 && (
            <p>سرعت را برایت یک پله کم کردم تا راحت‌تر بزنی 🐢</p>
          )}
          {rm === "rhythm" && speedPicker}
          <button className="text-button" onClick={() => setScreen("map")}>
            دیدن نقشه
          </button>
        </section>
      )}
    </div>
  );
}
