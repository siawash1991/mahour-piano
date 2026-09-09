import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Piano,
  BookOpen,
  Music2,
  ChartNoAxesCombined,
  Settings2,
  ArrowLeft,
  Play,
  Pause,
  Mic,
  Volume2,
  RotateCcw,
  Check,
  Star,
  Headphones,
  ChevronLeft,
  Download,
  Printer,
  Keyboard,
  Usb,
  Flag,
  Timer,
  X,
} from "lucide-react";
import {
  allLessons,
  lessons,
  songs,
  levels,
  fa,
  noteName,
  keyNumber,
  western,
  type Lesson,
  type Step,
} from "./curriculum";
import { audioContext, playNote, tick } from "./audio";
import { detectPitch } from "./pitch";
import { readAttempts, saveAttempts, type Attempt } from "./storage";
import "./style.css";
import { Staff } from "./Staff";
import { RhythmGame } from "./game/RhythmGame";
import {stages} from "./game/engine";
import { TabletStudio, FantasyIcon } from "./tablet/TabletStudio";
type View =
  | "home"
  | "path"
  | "songs"
  | "practice"
  | "progress"
  | "guide"
  | "tablet"
  | "game";

export function App() {
  const [view, setView] = useState<View>("game"),
    [lesson, setLesson] = useState<Lesson>(lessons[0]),
    [attempts, setAttempts] = useState(readAttempts),
    [notation, setNotation] = useState("number"),
    [bpm, setBpm] = useState(70),
    [mode, setMode] = useState("wait"),
    [source, setSource] = useState("mic"),
    [mic, setMic] = useState(false),
    [midiReady, setMidiReady] = useState(false),
    [message, setMessage] = useState("آماده‌ای؟ اولین نت را بزن."),
    [running, setRunning] = useState(false),
    [index, setIndex] = useState(0),
    [correct, setCorrect] = useState(0),
    [wrong, setWrong] = useState(0),
    [heard, setHeard] = useState<number | null>(null),
    [demo, setDemo] = useState(false),
    [metronome, setMetronome] = useState(false),
    [section, setSection] = useState(-1),
    [result, setResult] = useState<Attempt | null>(null),
    [filter, setFilter] = useState(-1),
    [storageWarning, setStorageWarning] = useState(false),
    [countIn, setCountIn] = useState<number | null>(null);
  const chordBuffer = useRef<{ at: number; notes: Set<number> }>({
    at: 0,
    notes: new Set(),
  });
  const stream = useRef<MediaStream | null>(null),
    raf = useRef(0),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    midiAccess = useRef<MIDIAccess | null>(null),
    started = useRef(0),
    rhythmStart = useRef(0),
    timing = useRef<number[]>([]),
    handler = useRef<(m: number, s: string) => void>(() => {}),
    runRef = useRef(false),
    indexRef = useRef(0),
    correctRef = useRef(0),
    wrongRef = useRef(0),
    counting = useRef(false),
    lastScreen = useRef(0);
  const steps =
      section < 0
        ? lesson.steps
        : lesson.steps.slice(section * 4, section * 4 + 4),
    completed = new Set(
      attempts.filter((a) => !a.partial && a.accuracy >= 80).map((a) => a.id),
    );
  const next =
    allLessons.find((l) => !completed.has(l.id) && l.kind === "lesson") ||
    lessons[0];
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setDemo(false);
    setCountIn(null);
    counting.current = false;
  };
  const stopMic = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setMic(false);
  };
  const stop = () => {
    runRef.current = false;
    setRunning(false);
    clearTimers();
    setMetronome(false);
    stopMic();
  };
  const reset = () => {
    stop();
    indexRef.current = 0;
    correctRef.current = 0;
    wrongRef.current = 0;
    setIndex(0);
    setCorrect(0);
    setWrong(0);
    setResult(null);
    setHeard(null);
    chordBuffer.current = { at: 0, notes: new Set() };
    timing.current = [];
    setMessage("آماده‌ای؟ اولین نت را بزن.");
  };
  const open = (l: Lesson) => {
    reset();
    setLesson(l);
    setBpm(l.bpm);
    setNotation(l.level < 2 ? "number" : l.level < 3 ? "name" : "staff");
    setSection(-1);
    if (l.steps.some((s) => s.chord?.length)) setSource("midi");
    setView("practice");
  };
  const navigate = (v: View) => {
    stop();
    setView(v);
  };
  const finish = () => {
    runRef.current = false;
    setRunning(false);
    setMetronome(false);
    stopMic();
    const a: Attempt = {
      id: lesson.id,
      at: new Date().toISOString(),
      correct: correctRef.current,
      wrong: wrongRef.current,
      accuracy: Math.round(
        (100 * correctRef.current) /
          (correctRef.current + wrongRef.current || 1),
      ),
      seconds: Math.max(
        1,
        Math.round((performance.now() - started.current) / 1000),
      ),
      source,
      partial: section >= 0,
      mode,
      rhythm: timing.current.length
        ? Math.round(
            (timing.current.filter(
              (t) => t <= Math.max(180, (60000 / bpm) * 0.3),
            ).length /
              timing.current.length) *
              100,
          )
        : null,
    };
    setAttempts((prev) => {
      const list = [...prev, a].slice(-1000);
      if (!saveAttempts(list)) setStorageWarning(true);
      return list;
    });
    setResult(a);
    setMessage("آفرین ماهور! این تمرین را تمام کردی.");
  };
  const begin = async () => {
    reset();
    started.current = performance.now();
    rhythmStart.current = 0;
    runRef.current = true;
    setRunning(true);
    if (source === "mic") {
      await startMic();
      if (!runRef.current) return;
    } else await audioContext();
    if (mode === "rhythm") {
      counting.current = true;
      setMessage("چهار ضرب گوش کن؛ بعد شروع کن.");
      for (let i = 0; i < 4; i++)
        timers.current.push(
          setTimeout(
            () => {
              setCountIn(4 - i);
              void tick(i === 0);
            },
            (i * 60000) / bpm,
          ),
        );
      timers.current.push(
        setTimeout(
          () => {
            counting.current = false;
            setCountIn(null);
            rhythmStart.current = performance.now();
            setMessage("حالا شروع کن!");
          },
          (4 * 60000) / bpm,
        ),
      );
    } else setMessage("اولین نت را بزن؛ من منتظرم.");
  };
  handler.current = (m, s) => {
    if (s !== source || !runRef.current || counting.current || demo) return;
    const now = performance.now();
    if (s === "screen" && now - lastScreen.current < 90) return;
    lastScreen.current = now;
    setHeard(m);
    const expected = steps[indexRef.current];
    if (!expected) return;
    const required = [expected.midi, ...(expected.chord || [])];
    if (required.includes(m)) {
      if (required.length > 1) {
        if (now - chordBuffer.current.at > 220)
          chordBuffer.current = { at: now, notes: new Set() };
        chordBuffer.current.notes.add(m);
        if (!required.every((n) => chordBuffer.current.notes.has(n))) {
          setMessage(
            "کلیدهای این گروه را هم‌زمان بزن: " +
              required.map(western).join(" + "),
          );
          return;
        }
        chordBuffer.current = { at: 0, notes: new Set() };
      }
      if (mode === "rhythm" && rhythmStart.current) {
        const beats = steps
          .slice(0, indexRef.current)
          .reduce((n, v) => n + v.beats, 0);
        timing.current.push(
          Math.abs(now - (rhythmStart.current + (beats * 60000) / bpm)),
        );
      }
      correctRef.current++;
      setCorrect(correctRef.current);
      indexRef.current++;
      setIndex(indexRef.current);
      if (indexRef.current >= steps.length) finish();
      else
        setMessage(
          "درست بود! حالا " +
            noteName(steps[indexRef.current].midi) +
            " را بزن.",
        );
    } else {
      wrongRef.current++;
      setWrong(wrongRef.current);
      setMessage(
        `${noteName(m)} شنیدم؛ ${noteName(expected.midi)} (${western(expected.midi)}) را ${m > expected.midi ? "سمت چپ‌تر" : "سمت راست‌تر"} پیدا کن.`,
      );
    }
  };
  const startMic = async () => {
    stopMic();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (!runRef.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const ctx = await audioContext(),
        analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      let candidate = -1,
        stable = 0,
        last = -1,
        quiet = 0,
        prevRms = 0,
        lastAt = 0,
        frameAt = 0;
      setMic(true);
      const frame = () => {
        if (!stream.current) return;
        const now = performance.now();
        if (now - frameAt > 65) {
          frameAt = now;
          analyser.getFloatTimeDomainData(data);
          const p = detectPitch(data, ctx.sampleRate);
          if (!p) {
            quiet++;
            if (quiet >= 2) last = -1;
            stable = 0;
            candidate = -1;
            prevRms = 0;
          } else {
            quiet = 0;
            if (candidate === p.midi) stable++;
            else {
              candidate = p.midi;
              stable = 1;
            }
            const onset = p.rms > Math.max(0.015, prevRms * 1.65);
            if (
              stable >= 2 &&
              (p.midi !== last || onset) &&
              now - lastAt > 240
            ) {
              last = p.midi;
              lastAt = now;
              handler.current(p.midi, "mic");
            }
            prevRms = p.rms;
          }
        }
        raf.current = requestAnimationFrame(frame);
      };
      frame();
    } catch (e) {
      stopMic();
      runRef.current = false;
      setRunning(false);
      clearTimers();
      setMessage(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "اجازهٔ میکروفون داده نشد. از تنظیمات مرورگر اجازه بده یا پیانوی روی صفحه را انتخاب کن."
          : "میکروفون در دسترس نیست. اتصال دستگاه و اجازهٔ مرورگر را بررسی کن؛ پیانوی روی صفحه هم قابل استفاده است.",
      );
    }
  };
  const connectMidi = async () => {
    try {
      const nav = navigator;
      if (!nav.requestMIDIAccess) {
        setMessage(
          "این مرورگر MIDI ندارد؛ Chrome دسکتاپ یا میکروفون را امتحان کن.",
        );
        return;
      }
      const access = await nav.requestMIDIAccess();
      midiAccess.current = access;
      const attach = () => {
        setMidiReady(access.inputs.size > 0);
        access.inputs.forEach(
          (input) =>
            (input.onmidimessage = (e) => {
              if (e.data && (e.data[0] & 0xf0) === 0x90 && e.data[2] > 0)
                handler.current(e.data[1], "midi");
            }),
        );
        setMessage(
          access.inputs.size
            ? "پیانو متصل است. «شروع تمرین» را بزن."
            : "MIDI فعال است؛ هنوز پیانویی متصل نیست. کابل USB را بررسی کن.",
        );
      };
      access.onstatechange = attach;
      attach();
    } catch {
      setMessage("اتصال MIDI مجاز نشد. اجازهٔ مرورگر یا کابل را بررسی کن.");
    }
  };
  const demonstration = async () => {
    reset();
    await audioContext();
    setDemo(true);
    setMessage("اول گوش کن؛ بعد نوبت توست.");
    let ms = 0;
    steps.forEach((s, i) => {
      timers.current.push(
        setTimeout(() => {
          setIndex(i);
          [s.midi, ...(s.chord || [])].forEach(
            (m) => void playNote(m, ((s.beats * 60) / bpm) * 0.85),
          );
        }, ms),
      );
      ms += (s.beats * 60000) / bpm;
    });
    timers.current.push(
      setTimeout(() => {
        setDemo(false);
        setIndex(0);
        setMessage("نوبت توست! شروع تمرین را بزن.");
      }, ms),
    );
  };
  useEffect(() => {
    if (!metronome) return;
    void tick(true);
    let count = 0;
    const id = setInterval(() => {
      void tick(++count % 4 === 0);
    }, 60000 / bpm);
    return () => clearInterval(id);
  }, [metronome, bpm]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        view !== "practice" ||
        source !== "screen" ||
        e.repeat ||
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      const i = "asdfghjk".indexOf(e.key.toLowerCase());
      if (i >= 0) {
        const m = [60, 62, 64, 65, 67, 69, 71, 72][i];
        void playNote(m);
        handler.current(m, "screen");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [view, source]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      stopMic();
      timers.current.forEach(clearTimeout);
      midiAccess.current?.inputs.forEach(
        (input) => (input.onmidimessage = null),
      );
    };
  }, []);
  const download = () => {
    const blob = new Blob(
        [
          JSON.stringify(
            { version: 1, exportedAt: new Date().toISOString(), attempts },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "piano-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const navs: [View, string, React.ReactNode][] = [
    ["home", "استودیوی من", <FantasyIcon name="piano" />],
    ["path", "مسیر یادگیری", <BookOpen size={21} />],
    ["songs", "آهنگ‌ها", <FantasyIcon name="coach" />],
    ["progress", "گزارش تمرین", <FantasyIcon name="trophy" />],
  ];
  if (view === "game")
    return (
      <RhythmGame
        onExit={() => navigate("home")}
        onSave={(a) =>
          setAttempts((prev) => {
            const list = [...prev, a].slice(-1000);
            saveAttempts(list);
            return list;
          })
        }
      />
    );
  if (view === "tablet")
    return (
      <TabletStudio
        onExit={() => navigate("home")}
        onSave={(a) =>
          setAttempts((prev) => {
            const list = [...prev, a].slice(-1000);
            if (!saveAttempts(list)) setStorageWarning(true);
            return list;
          })
        }
      />
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <span className="brand-icon">
            <Piano />
          </span>
          <span>
            ماهور<span className="brand-sub">سفر کوچک پیانو</span>
          </span>
        </a>
        <div className="profile">
          <span className="avatar">م</span>
          <div>
            <b>ماهورِ نوازنده</b>
            <small>هر روز، یک کشف تازه</small>
          </div>
          <span className="online" />
        </div>
        <nav>
          {navs.map(([v, label, icon]) => (
            <button
              key={v}
              className={
                view === v || (v === "path" && view === "practice")
                  ? "nav active"
                  : "nav"
              }
              onClick={() => navigate(v)}
            >
              {icon}
              {label}
              {v === "songs" && <span className="badge">۸</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="daily">
            <span>قدم‌های کوچک، موسیقی بزرگ</span>
            <p>پیشنهاد امروز: ۱۰ دقیقه بازی، شنیدن و پیانو.</p>
            <div className="mini-keys">♪ ♫ ♪</div>
          </div>
          <button className="nav" onClick={() => navigate("guide")}>
            <Settings2 size={20} />
            راهنمای والدین
          </button>
          <div className="local">
            <span /> بدون حساب کاربری · ذخیره روی دستگاه
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            {view === "practice"
              ? "اتاق تمرین"
              : navs.find((n) => n[0] === view)?.[1] || "راهنمای والدین"}
          </span>
          <div className="header-right">
            <span>
              <Star size={16} /> {fa(completed.size)} تمرین کامل
            </span>
            <span className="avatar small">م</span>
          </div>
        </header>
        <main>
          {storageWarning && (
            <div className="notice">
              ذخیره‌سازی مرورگر در دسترس نیست. پیش از بستن صفحه از گزارش خروجی
              بگیر.
            </div>
          )}
          {view === "home" && (
            <>
              <div className="greeting">
                <div>
                  <div className="eyebrow">یک روز تازه، یک ملودی تازه</div>
                  <h1>
                    سلام ماهور! <span className="wave">✦</span>
                  </h1>
                  <p>امروز کدام صدا را کشف می‌کنیم؟</p>
                </div>
                <div className="date-chip">
                  <Timer size={17} /> آرام و کوتاه تمرین کن
                </div>
              </div>
              <button className="tablet-entry" onClick={() => navigate("game")}>
                <FantasyIcon name="coach" />
                <span>
                  <small>مخصوص کیبورد واقعی تو</small>
                  <b>بازی ریتم با کیبورد واقعی</b>
                  <span>
                    ۱۰۰ مرحله از آسان تا آهنگ کامل؛ سرعت را خودت کم و زیاد کن.
                  </span>
                </span>
                <span className="entry-cta">
                  بریم با کیبورد <ChevronLeft />
                </span>
              </button>
              <div className="home-grid">
                <section className="hero">
                  <div className="hero-copy">
                    <span className="light-label">
                      قدم بعدی تو · مرحلهٔ {fa(next.level + 1)}
                    </span>
                    <h2>{next.title}</h2>
                    <p>{next.concept}</p>
                    <button className="button cream" onClick={() => open(next)}>
                      بریم تمرین کنیم <ArrowLeft size={18} />
                    </button>
                    <div className="hero-meta">
                      <span>
                        <Timer size={15} />
                        {fa(next.minutes)} دقیقه
                      </span>
                      <span>
                        <Headphones size={15} />
                        بشنو، پیدا کن، بنواز
                      </span>
                    </div>
                  </div>
                  <div className="hero-keyboard" aria-hidden="true">
                    <FantasyIcon name="piano" className="hero-generated" />
                  </div>
                </section>
                <section className="today card">
                  <div className="section-top">
                    <h3>تمرین کوچک امروز</h3>
                    <span className="icon-disc yellow">
                      <Flag size={18} />
                    </span>
                  </div>
                  <p>سه قدم، با همراهی مامان یا بابا</p>
                  {[
                    ["۱", "گوش بده", "یک بار ملودی را بشنو"],
                    ["۲", "آرام امتحان کن", "چهار نت را با هم یاد بگیر"],
                    ["۳", "جشن بگیر", "یک اجرای کوچک برای خانواده"],
                  ].map(([n, t, d]) => (
                    <div className="today-step" key={n}>
                      <span>{n}</span>
                      <div>
                        <b>{t}</b>
                        <small>{d}</small>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
              <section className="path-preview">
                <div className="section-top">
                  <div>
                    <h2>مسیر نوازنده شدن</h2>
                    <p>از اولین کلید، تا اولین اجرای تو</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("path")}
                  >
                    دیدن مسیر کامل <ChevronLeft size={16} />
                  </button>
                </div>
                <div className="level-strip">
                  {levels.map((lv, i) => (
                    <button
                      key={lv.title}
                      className={
                        "level-card " + (i === next.level ? "current" : "")
                      }
                      onClick={() => {
                        setFilter(i);
                        navigate("path");
                      }}
                    >
                      <span className="level-symbol">
                        <FantasyIcon
                          name={i < 2 ? "piano" : i < 4 ? "coach" : "trophy"}
                        />
                      </span>
                      <small>مرحلهٔ {fa(i + 1)}</small>
                      <b>{lv.title}</b>
                      <span>{lv.subtitle}</span>
                      <div className="level-line">
                        <i
                          style={{
                            width: `${(allLessons.filter((l) => l.level === i && completed.has(l.id)).length / allLessons.filter((l) => l.level === i).length) * 100}%`,
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <div className="section-top">
                  <div>
                    <h2>آهنگ‌هایی که می‌شناسی</h2>
                    <p>یک آهنگ آشنا، یک حس خوب</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("songs")}
                  >
                    همهٔ آهنگ‌ها <ChevronLeft size={16} />
                  </button>
                </div>
                <div className="song-grid">
                  {songs.slice(0, 3).map((s, i) => (
                    <SongCard
                      key={s.id}
                      lesson={s}
                      i={i}
                      done={completed.has(s.id)}
                      onClick={() => open(s)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "path" && (
            <>
              <PageTitle
                title="هر قدم، یک توانایی تازه"
                text="شماره‌ها کم‌کم کنار می‌روند؛ گوش و چشم و دست با هم یاد می‌گیرند."
              />
              <div className="filter-row">
                <button
                  className={filter < 0 ? "selected" : ""}
                  onClick={() => setFilter(-1)}
                >
                  همهٔ مراحل
                </button>
                {levels.map((l, i) => (
                  <button
                    className={filter === i ? "selected" : ""}
                    key={i}
                    onClick={() => setFilter(i)}
                  >
                    {fa(i + 1)}. {l.title}
                  </button>
                ))}
              </div>
              {levels.map(
                (lv, i) =>
                  (filter === -1 || filter === i) && (
                    <section key={i} className="curriculum-section">
                      <div className="section-top">
                        <h2>
                          <span className="inline-symbol">{lv.icon}</span>{" "}
                          {lv.title}
                        </h2>
                        <small>{lv.subtitle}</small>
                      </div>
                      <div className="lesson-grid">
                        {allLessons
                          .filter((l) => l.level === i)
                          .map((l, j) => (
                            <button
                              className="lesson-card"
                              key={l.id}
                              onClick={() => open(l)}
                            >
                              <span
                                className={
                                  "lesson-number " +
                                  (completed.has(l.id) ? "done" : "")
                                }
                              >
                                {completed.has(l.id) ? (
                                  <Check size={22} />
                                ) : (
                                  fa(j + 1)
                                )}
                              </span>
                              <div>
                                <h3>{l.title}</h3>
                                <p>{l.subtitle}</p>
                                <small>
                                  {l.kind === "song" ? "آهنگ" : "درس و تمرین"} ·{" "}
                                  {fa(l.minutes)} دقیقه
                                </small>
                              </div>
                              <ChevronLeft size={18} />
                            </button>
                          ))}
                      </div>
                    </section>
                  ),
              )}
              <div className="notice">
                مرحلهٔ آخر پل ورود به سطح متوسط است. برای تسلط بر اجرای هم‌زمان
                دو دست، پدال و حالت بدن، بازبینی دوره‌ای معلم لازم است؛ این مسیر
                معادل مدرک ABRSM نیست.
              </div>
            </>
          )}
          {view === "songs" && (
            <>
              <PageTitle
                title="کتابخانهٔ آهنگ‌های من"
                text="گوش بده، بخش‌بخش تمرین کن و بعد یک اجرای کامل داشته باش."
              />
              <div className="song-grid library">
                {songs.map((s, i) => (
                  <SongCard
                    key={s.id}
                    lesson={s}
                    i={i}
                    done={completed.has(s.id)}
                    onClick={() => open(s)}
                  />
                ))}
              </div>
              <p className="muted">
                ملودی‌های سنتی یا آثار قدیمی با تنظیم آموزشی مستقل؛ «گزیده» یعنی
                بخشی از اثر، نه نسخهٔ کامل.
              </p>
            </>
          )}
          {view === "practice" && (
            <>
              <div className="practice-heading">
                <div>
                  <button
                    className="text-button"
                    onClick={() => navigate("path")}
                  >
                    مسیر یادگیری / مرحلهٔ {fa(lesson.level + 1)}
                  </button>
                  <h1>{lesson.title}</h1>
                  <p>{lesson.concept}</p>
                </div>
                <span className="icon-disc green">
                  <Music2 />
                </span>
              </div>
              <div className="practice-layout">
                <div className="practice-main">
                  <section className="card controls">
                    <div className="control-row">
                      <label>
                        روش نمایش
                        <select
                          disabled={running || demo}
                          value={notation}
                          onChange={(e) => setNotation(e.target.value)}
                        >
                          <option value="number">شمارهٔ کلید</option>
                          <option value="name">نام نت</option>
                          <option value="staff">نت روی خط</option>
                        </select>
                      </label>
                      <label>
                        ورودی
                        <select
                          disabled={running || demo}
                          value={source}
                          onChange={(e) => {
                            stop();
                            setSource(e.target.value);
                            setMessage("ورودی انتخاب شد؛ شروع تمرین را بزن.");
                          }}
                        >
                          <option
                            value="screen"
                            disabled={lesson.steps.some((s) => s.chord?.length)}
                          >
                            پیانوی روی صفحه
                          </option>
                          <option
                            value="mic"
                            disabled={lesson.steps.some((s) => s.chord?.length)}
                          >
                            میکروفون · تک‌نت
                          </option>
                          <option value="midi">پیانوی USB / MIDI</option>
                        </select>
                      </label>
                      <label>
                        تمرین
                        <select
                          disabled={running || demo}
                          value={mode}
                          onChange={(e) => setMode(e.target.value)}
                        >
                          <option value="wait">با حوصله · نت درست</option>
                          <option value="rhythm">با ریتم · زمان شروع نت</option>
                        </select>
                      </label>
                    </div>
                    <div className="control-row secondary">
                      <label className="tempo">
                        سرعت{" "}
                        <input
                          aria-label="سرعت مترونوم"
                          disabled={running || demo}
                          type="range"
                          min="40"
                          max="130"
                          value={bpm}
                          onChange={(e) => setBpm(+e.target.value)}
                        />
                        <b>{fa(bpm)}</b>
                      </label>
                      <button
                        disabled={demo || mic || (running && mode === "rhythm")}
                        className={"small-button " + (metronome ? "on" : "")}
                        onClick={() => setMetronome(!metronome)}
                      >
                        <Timer size={16} /> مترونوم{" "}
                        {metronome ? "روشن" : "خاموش"}
                      </button>
                    </div>
                  </section>
                  <section className="card score-card">
                    <div className="section-top">
                      <span className="eyebrow">
                        {section < 0
                          ? "اجرای کامل"
                          : "تمرین بخش " + fa(section + 1)}
                      </span>
                      <span className="muted">
                        {fa(Math.min(index, steps.length))} از{" "}
                        {fa(steps.length)} نت
                      </span>
                    </div>
                    <div className="score-scroll" dir="ltr">
                      {notation === "staff" ? (
                        <Staff
                          steps={steps.slice(
                            Math.max(
                              0,
                              Math.floor(
                                Math.min(index, steps.length - 1) / 8,
                              ) * 8,
                            ),
                            Math.max(
                              0,
                              Math.floor(
                                Math.min(index, steps.length - 1) / 8,
                              ) * 8,
                            ) + 8,
                          )}
                          current={index % 8}
                        />
                      ) : (
                        <div className="note-strip">
                          {steps.map((s, i) => (
                            <div
                              key={i}
                              className={
                                "note-tile " +
                                (i === index ? "target " : "") +
                                (i < index ? "played" : "")
                              }
                            >
                              <small>
                                {s.hand === "L" ? "چپ" : "راست"} ·{" "}
                                {western(s.midi)}
                              </small>
                              <b>
                                {notation === "number"
                                  ? keyNumber(s.midi)
                                  : noteName(s.midi)}
                              </b>
                              {s.chord && (
                                <small>
                                  {s.chord.map(western).join(" + ")} +
                                </small>
                              )}
                              <span>{fa(s.beats)} ضرب</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="progress-track">
                      <i
                        style={{ width: `${(index / steps.length) * 100}%` }}
                      />
                    </div>
                    <div className="feedback" role="status" aria-live="polite">
                      <span
                        className={"listen-dot " + (mic ? "listening" : "")}
                      />
                      {countIn !== null ? "آماده… " + fa(countIn) : message}
                    </div>
                    <div className="practice-actions">
                      <button
                        className="button"
                        disabled={demo || (source === "midi" && !midiReady)}
                        onClick={() => (running ? stop() : void begin())}
                      >
                        {running ? <Pause size={18} /> : <Play size={18} />}{" "}
                        {running ? "توقف تمرین" : "شروع تمرین"}
                      </button>
                      <button
                        className="button outline"
                        disabled={running}
                        onClick={() => (demo ? reset() : void demonstration())}
                      >
                        {demo ? <Pause size={18} /> : <Volume2 size={18} />}{" "}
                        {demo ? "توقف نمایش" : "اول گوش بده"}
                      </button>
                      <button
                        aria-label="شروع دوباره"
                        className="icon-button"
                        onClick={reset}
                      >
                        <RotateCcw size={19} />
                      </button>
                    </div>
                    {source === "midi" && (
                      <button
                        className="small-button"
                        onClick={() => void connectMidi()}
                      >
                        <Usb size={16} /> اتصال پیانوی MIDI
                      </button>
                    )}
                    {source === "mic" && (
                      <p className="input-tip">
                        <Mic size={16} /> در اتاق آرام، بدون پدال، هر بار یک نت
                        بزن و کامل رها کن. هنگام نمایش، میکروفون خاموش است.
                      </p>
                    )}
                    <div className="stats-line">
                      <span>
                        درست <b>{fa(correct)}</b>
                      </span>
                      <span>
                        دوباره امتحان کردیم <b>{fa(wrong)}</b>
                      </span>
                      <span>
                        آخرین صدا <b>{heard === null ? "—" : western(heard)}</b>
                      </span>
                    </div>
                  </section>
                  <section className="card keyboard-card">
                    <div className="section-top">
                      <h3>پیانوی تو</h3>
                      <span className="muted">
                        <Keyboard size={15} /> A S D F G H J K
                      </span>
                    </div>
                    <div className="keyboard-scroll">
                      <div className="piano-keys" dir="ltr">
                        {(() => {
                          const min = Math.min(
                              60,
                              ...steps.flatMap((s) => [
                                s.midi,
                                ...(s.chord || []),
                              ]),
                            ),
                            max = Math.max(
                              72,
                              ...steps.flatMap((s) => [
                                s.midi,
                                ...(s.chord || []),
                              ]),
                            );
                          const start = Math.floor(min / 12) * 12,
                            end = Math.ceil((max + 1) / 12) * 12;
                          const whites = Array.from(
                            { length: end - start },
                            (_, i) => start + i,
                          ).filter((m) => ![1, 3, 6, 8, 10].includes(m % 12));
                          return whites.map((m) => (
                            <div className="key-wrap" key={m}>
                              <button
                                disabled={source !== "screen" || demo}
                                aria-label={western(m)}
                                className={
                                  "white-key " +
                                  (running &&
                                  [
                                    steps[index]?.midi,
                                    ...(steps[index]?.chord || []),
                                  ].includes(m)
                                    ? "expected"
                                    : "")
                                }
                                onClick={() => {
                                  if (source === "screen" && !demo) {
                                    void playNote(m);
                                    handler.current(m, "screen");
                                  }
                                }}
                              >
                                <span>
                                  {notation === "number"
                                    ? keyNumber(m)
                                    : noteName(m)}
                                </span>
                                <small>{western(m)}</small>
                              </button>
                              {[0, 2, 5, 7, 9].includes(m % 12) && (
                                <button
                                  disabled={source !== "screen" || demo}
                                  aria-label={western(m + 1)}
                                  className={
                                    "black-key " +
                                    (running &&
                                    [
                                      steps[index]?.midi,
                                      ...(steps[index]?.chord || []),
                                    ].includes(m + 1)
                                      ? "expected"
                                      : "")
                                  }
                                  onClick={() => {
                                    if (source === "screen" && !demo) {
                                      void playNote(m + 1);
                                      handler.current(m + 1, "screen");
                                    }
                                  }}
                                >
                                  <small>{noteName(m + 1)}</small>
                                </button>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                    <p className="muted">
                      چپ = صدای بم‌تر · راست = صدای زیرتر. برای ثبت امتیاز، اول
                      «شروع تمرین» را بزن.
                    </p>
                  </section>
                  {result && (
                    <section className="result card" role="status">
                      <Star size={30} />
                      <h2>یک قدم جلوتر رفتی!</h2>
                      <p>
                        دقت نت‌ها: {fa(result.accuracy)}٪{" "}
                        {result.rhythm !== null &&
                          ` · شروع‌های به‌موقع: ${fa(result.rhythm)}٪`}
                      </p>
                      <p>
                        {result.partial
                          ? "این نتیجه برای یک بخش است؛ برای ثبت درس، اجرای کامل را تمام کن."
                          : result.accuracy >= 80
                            ? "این تمرین در مسیرت ثبت شد."
                            : "یک بار دیگر آرام‌تر امتحان کنیم؛ با دقت ۸۰٪ این درس کامل می‌شود."}
                      </p>
                      <button className="button" onClick={reset}>
                        یک بار دیگر
                      </button>
                    </section>
                  )}
                </div>
                <aside className="practice-notes">
                  <section className="card">
                    <span className="icon-disc yellow">
                      <BookOpen size={20} />
                    </span>
                    <h3>قبل از نواختن</h3>
                    <ol>
                      {lesson.instructions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </section>
                  <section className="card">
                    <h3>کوچک‌کوچک یاد بگیر</h3>
                    <p>چهار نت کافی است. بعد سراغ بخش بعد برو.</p>
                    <select
                      aria-label="انتخاب بخش تمرین"
                      disabled={running || demo}
                      value={section}
                      onChange={(e) => {
                        reset();
                        setSection(+e.target.value);
                      }}
                    >
                      <option value={-1}>اجرای کامل</option>
                      {Array.from(
                        { length: Math.ceil(lesson.steps.length / 4) },
                        (_, i) => (
                          <option value={i} key={i}>
                            بخش {fa(i + 1)} · نت {fa(i * 4 + 1)} تا{" "}
                            {fa(Math.min(i * 4 + 4, lesson.steps.length))}
                          </option>
                        ),
                      )}
                    </select>
                  </section>
                  <div className="gentle-note">
                    <Headphones size={21} />
                    <p>اشتباه کردن بخشی از یادگیری است. عجله نداریم!</p>
                  </div>
                  {lesson.credit && (
                    <small className="muted">{lesson.credit}</small>
                  )}
                </aside>
              </div>
            </>
          )}
          {view === "progress" && (
            <>
              <PageTitle
                title="قصهٔ تمرین‌های ماهور"
                text="گزارش واقعی اجراها روی همین مرورگر؛ تمرین روی صفحه از پیانوی واقعی جداست."
              />
              <div className="summary-grid">
                {[
                  [fa(completed.size), "تمرین کامل‌شده"],
                  [fa(attempts.length), "اجرای ثبت‌شده"],
                  [
                    fa(
                      Math.round(
                        attempts.reduce((n, a) => n + a.seconds, 0) / 60,
                      ),
                    ),
                    "دقیقه تمرین",
                  ],
                  [
                    attempts.length
                      ? fa(
                          Math.round(
                            attempts.reduce((n, a) => n + a.accuracy, 0) /
                              attempts.length,
                          ),
                        ) + "٪"
                      : "—",
                    "میانگین دقت نت",
                  ],
                ].map(([n, t]) => (
                  <div className="card summary" key={t}>
                    <b>{n}</b>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <div className="section-top">
                <h2>آخرین اجراها</h2>
                <button className="button outline" onClick={download}>
                  <Download size={17} /> خروجی گزارش
                </button>
              </div>
              {attempts.length === 0 ? (
                <div className="card empty">
                  <Music2 size={36} />
                  <h3>اولین داستان هنوز شروع نشده!</h3>
                  <p>یک تمرین را کامل کن تا گزارشش اینجا ثبت شود.</p>
                  <button className="button" onClick={() => open(next)}>
                    شروع اولین تمرین
                  </button>
                </div>
              ) : (
                <div className="card table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>تمرین</th>
                        <th>تاریخ</th>
                        <th>ورودی</th>
                        <th>دقت نت</th>
                        <th>ریتم</th>
                        <th>اجرا</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...attempts]
                        .reverse()
                        .slice(0, 50)
                        .map((a, i) => (
                          <tr key={i}>
                            <td>
                              {allLessons.find((l) => l.id === a.id)?.title || stages.find(s=>s.id===a.id)?.title ||
                                a.id}
                            </td>
                            <td>
                              {new Date(a.at).toLocaleDateString("fa-IR")}
                            </td>
                            <td>
                              {a.source === "mic"
                                ? "میکروفون"
                                : a.source === "midi"
                                  ? "MIDI"
                                  : "روی صفحه"}
                            </td>
                            <td>{fa(a.accuracy)}٪</td>
                            <td>
                              {a.rhythm === null ? "—" : fa(a.rhythm) + "٪"}
                            </td>
                            <td>{a.partial ? "بخشی" : "کامل"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="notice">
                این گزارش پیشرفت روی نت‌های تمرین‌شده را نشان می‌دهد؛ کیفیت حالت
                دست، بیان موسیقایی، کشش نت و کیفیت صدای آکورد را نمی‌سنجد.
                پاک‌کردن داده‌های مرورگر گزارش را حذف می‌کند؛ خروجی JSON نسخهٔ
                پشتیبان خواندنی است.
              </div>
            </>
          )}
          {view === "guide" && (
            <>
              <PageTitle
                title="همراهِ نوازندهٔ کوچک"
                text="شما تشویق می‌کنید؛ ماهور کشف می‌کند."
              />
              <div className="guide-grid">
                <section className="card">
                  <h2>برچسب‌ها را چطور بزنیم؟</h2>
                  <p>
                    دو وسط (C4) را پیدا کنید: کلید سفید سمت چپِ گروه دو کلید
                    سیاه نزدیک مرکز ساز. برچسب کاغذی کم‌چسب را فقط روی ۸ کلید
                    سفید بگذارید.
                  </p>
                  <div className="sticker-row" dir="ltr">
                    {[60, 62, 64, 65, 67, 69, 71, 72].map((m) => (
                      <div key={m}>
                        <b>{keyNumber(m)}</b>
                        <span>{noteName(m)}</span>
                        <small>{western(m)}</small>
                      </div>
                    ))}
                  </div>
                  <p>
                    <b>شمارهٔ کلید ≠ شمارهٔ انگشت.</b> انگشت‌ها در هر دست: شست ۱
                    تا کوچک ۵. شماره‌های این برچسب فقط برای یافتن کلیدند. از
                    مرحلهٔ سوم برچسب‌ها را تدریجی بردارید.
                  </p>
                  <button
                    className="button outline"
                    onClick={() => window.print()}
                  >
                    <Printer size={18} /> چاپ راهنما و برچسب‌ها
                  </button>
                </section>
                <section className="card">
                  <h2>روال پیشنهادی ۱۰ دقیقه‌ای</h2>
                  <ol>
                    <li>۲ دقیقه: گوش‌دادن و دست‌زدن با ضرب.</li>
                    <li>۳ دقیقه: یک الگوی کوچک با دست آزاد.</li>
                    <li>۳ دقیقه: چهار نت از آهنگ محبوب.</li>
                    <li>۲ دقیقه: اجرای دلخواه و تشویق تلاش.</li>
                  </ol>
                  <p>
                    این زمان پیشنهاد طراحی است؛ با حوصله و انرژی کودک تنظیم
                    کنید. در خستگی یا درد توقف کنید. صندلی و زیرپایی متناسب
                    باشد.
                  </p>
                </section>
                <section className="card">
                  <h2>شنیدن و اصلاح اجرا</h2>
                  <p>
                    میکروفون صدای تک‌نت را با YIN تخمین می‌زند. پیانوی کوک، محیط
                    آرام، صدای تلویزیون خاموش و پدال رها باشد. برای تکرار یک نت،
                    آن را کامل رها کنید. در نت‌های بم، صدای ضعیف و هارمونیک‌های
                    قوی امکان خطای اکتاو وجود دارد.
                  </p>
                  <p>
                    میکروفون فقط در HTTPS یا localhost و با اجازهٔ شما فعال
                    می‌شود. صدا ضبط یا آپلود نمی‌شود. برای تشخیص مطمئن‌تر کلید و
                    زمان شروع نت از USB / MIDI در مرورگر پشتیبان استفاده کنید.
                  </p>
                  <p>
                    حالت ریتم پس از ۴ ضرب شروع می‌شود. امتیاز آن درصد شروع نت‌ها
                    در فاصلهٔ مجاز (حداقل ۱۸۰ میلی‌ثانیه یا ۳۰٪ ضرب) است؛ کشش و
                    رهاکردن نت سنجیده نمی‌شود.
                  </p>
                </section>
                <section className="card">
                  <h2>تا کجا پیش می‌رویم؟</h2>
                  <p>
                    ۶ مرحله و ۸ آهنگ: شماره، نام نت، کلید سل و فا، ریتم، دست چپ،
                    جابه‌جایی دست و گام. مرحلهٔ پایانی مقدمات ورود به سطح متوسط
                    است؛ تسلط متوسط نیازمند رپرتوار گسترده‌تر، اجرای هم‌زمان دو
                    دست، پدال و بازخورد معلم است.
                  </p>
                  <p>
                    تمرین هم‌زمان دو دست و آکورد با MIDI ارزیابی می‌شود؛ همهٔ
                    نت‌های گروه باید در بازهٔ ۲۲۰ میلی‌ثانیه شروع شوند. میکروفون
                    فقط تک‌نت را می‌سنجد. وضعیت بدن و طول نگه‌داشتن نت ارزیابی
                    خودکار ندارند.
                  </p>
                </section>
                <section className="card">
                  <h2>حریم خصوصی و دسترسی</h2>
                  <p>
                    حساب، تبلیغات و Analytics نداریم. صدا در مرورگر پردازش
                    می‌شود؛ فقط امتیاز تمرین در localStorage می‌ماند. این گزارش
                    بین دستگاه‌ها همگام نمی‌شود. کد عمومی هیچ گزارش تمرین یا
                    صدایی ندارد.
                  </p>
                  <p>
                    فونت و فایل‌ها از همان دامنه بارگیری می‌شوند؛ CDN خارجی در
                    اجرای اپ لازم نیست. دسترسی به دامنهٔ Vercel ممکن است به شبکه
                    یا VPN بستگی داشته باشد.
                  </p>
                </section>
                <section className="card sources">
                  <h2>پایهٔ پژوهش</h2>
                  <a
                    href="https://pianoadventures.com/piano-books/basic-faqs/parents/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Faber Piano Adventures — همراهی والدین و یادگیری کودک
                  </a>
                  <a
                    href="https://www.abrsm.org/en-us/about-practical-grades"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ABRSM — اجرا، تکنیک، شنیدن و نت‌خوانی
                  </a>
                  <a
                    href="https://pubmed.ncbi.nlm.nih.gov/12002874/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    مقالهٔ YIN — تخمین فرکانس پایه
                  </a>
                  <a
                    href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia"
                    target="_blank"
                    rel="noreferrer"
                  >
                    MDN — شرایط استفاده از میکروفون
                  </a>
                  <a
                    href="https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API"
                    target="_blank"
                    rel="noreferrer"
                  >
                    MDN — پشتیبانی Web MIDI
                  </a>
                  <p>
                    این اپ محصول رسمی Faber یا ABRSM نیست؛ تمرین‌ها و تنظیم‌های
                    آموزشی مستقل نوشته شده‌اند.
                  </p>
                </section>
              </div>
            </>
          )}
        </main>
        <footer>
          <span>ساخته شده برای کشف کردن، نه عجله کردن.</span>
          <button onClick={() => navigate("guide")}>
            راهنما و حریم خصوصی <ChevronLeft size={13} />
          </button>
        </footer>
      </div>
    </div>
  );
}
function PageTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="page-title">
      <div className="eyebrow">ماهور · سفر کوچک پیانو</div>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}
function SongCard({
  lesson,
  i,
  done,
  onClick,
}: {
  lesson: Lesson;
  i: number;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button className="song-card" onClick={onClick}>
      <div className={"song-art art-" + (i % 4)}>
        <FantasyIcon
          name={i % 3 === 0 ? "coach" : i % 3 === 1 ? "piano" : "trophy"}
        />
        <small>
          {lesson.id === "twinkle"
            ? "TWINKLE"
            : lesson.id === "ode"
              ? "BEETHOVEN"
              : "PIANO NOTES"}
        </small>
        <div className="song-play">
          <Play size={16} fill="currentColor" />
        </div>
      </div>
      <div className="song-info">
        <div className="section-top">
          <small>
            مرحلهٔ {fa(lesson.level + 1)} · {fa(lesson.minutes)} دقیقه
          </small>
          {done && <Check size={16} />}
        </div>
        <h3>{lesson.title}</h3>
        <p>{lesson.subtitle}</p>
      </div>
    </button>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
