import React, { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { TouchPiano, GuidePiano } from "../game/TouchPiano";
import { noteColor } from "../game/engine";
import { fa, noteName, songs } from "../curriculum";
import { playNote, tick } from "../audio";
import { Staff } from "../Staff";
import { groove } from "./harmony";
import { playBand, type Band } from "./backing";
import { parseRhythm, judgeTaps } from "./rhythm";
import type { Activity } from "./journey";
import type { Mode } from "../game/engine";

/** Microphone notes arrive here, already moved into the app's octave. */
export type Bus = React.MutableRefObject<((m: number) => void) | null>;
type Props<K extends Activity["kind"]> = {
  activity: Extract<Activity, { kind: K }>;
  input: "touch" | "mic";
  bus: Bus;
  onDone: (score: number) => void;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PRAISE = ["درست شنیدی! 👂", "آفرین، دقیق بود! ✨", "همین بود! 🎉", "گوش تیزی داری! 🦊"];

/** The keyboard for an activity: playable on screen, or a picture of the real one. */
function Keys({
  low,
  high,
  lit,
  onNote,
  input,
  bus,
  bare,
}: {
  low: number;
  high: number;
  lit?: number[];
  onNote: (m: number) => void;
  input: "touch" | "mic";
  bus: Bus;
  bare?: boolean;
}) {
  const [heard, setHeard] = useState<number | null>(null);
  const latest = useRef(onNote);
  latest.current = onNote;
  useEffect(() => {
    bus.current = (m) => {
      setHeard(m);
      latest.current(m);
    };
    return () => {
      bus.current = null;
    };
  }, [bus]);
  const steps = [
    { midi: low, beats: 1 },
    { midi: high, beats: 1 },
  ];
  return input === "touch" ? (
    <TouchPiano steps={steps} lit={lit} bare={bare} onNote={(m) => latest.current(m)} onError={() => {}} />
  ) : (
    <GuidePiano steps={steps} lit={lit} heard={heard} bare={bare} />
  );
}
function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="bubble" role="status">
      {children}
    </div>
  );
}
function Rounds({ n, of }: { n: number; of: number }) {
  return (
    <div className="rounds" aria-label={`${fa(n)} از ${fa(of)}`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </div>
  );
}

export function Talk({ activity, input, bus, onDone }: Props<"talk">) {
  const keys = activity.keys ?? [];
  const play = async () => {
    for (const m of keys) {
      void playNote(m, 0.6, 0.25).catch(() => {});
      await wait(450);
    }
  };
  return (
    <section className="activity talk">
      <Bubble>{activity.text}</Bubble>
      <div className="activity-buttons">
        {keys.length > 0 && (
          <button className="brick-button outline" onClick={() => void play()}>
            <Volume2 /> بشنو
          </button>
        )}
        <button className="brick-button big" onClick={() => onDone(1)}>
          فهمیدم! ▶
        </button>
      </div>
      {keys.length > 0 && (
        <Keys
          low={Math.min(...keys, 60)}
          high={Math.max(...keys, 72)}
          lit={keys}
          onNote={() => {}}
          input={input}
          bus={bus}
        />
      )}
    </section>
  );
}

const JAM: Record<string, { low: number; high: number; allowed: (m: number) => boolean; pattern: [number, number[]][] }> = {
  black: {
    low: 54,
    high: 83,
    allowed: (m) => [1, 3, 6, 8, 10].includes(m % 12),
    pattern: [
      [6, [6, 10, 1]],
      [3, [3, 6, 10]],
    ],
  },
  "white-penta": {
    low: 60,
    high: 81,
    allowed: (m) => [0, 2, 4, 7, 9].includes(m % 12),
    pattern: [
      [0, [0, 4, 7]],
      [9, [9, 0, 4]],
    ],
  },
  all: { low: 48, high: 84, allowed: () => true, pattern: [[0, [0, 4, 7]], [5, [5, 9, 0]], [7, [7, 11, 2]], [0, [0, 4, 7]]] },
};
export function Jam({ activity, input, bus, onDone }: Props<"jam">) {
  const set = JAM[activity.keys],
    bpm = 92;
  const [left, setLeft] = useState<number | null>(null),
    [count, setCount] = useState(0),
    [hint, setHint] = useState("");
  const band = useRef<Band | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    band.current?.stop();
    band.current = null;
    if (timer.current) clearInterval(timer.current);
  };
  useEffect(() => stop, []);
  const start = async () => {
    const bars = Math.ceil((activity.seconds * bpm) / 60 / 4);
    setLeft(activity.seconds);
    try {
      band.current = await playBand(groove(set.pattern, bars), bpm, 400, { countIn: false });
    } catch {
      /* no sound device: free play still works */
    }
    const end = performance.now() + activity.seconds * 1000;
    timer.current = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - performance.now()) / 1000));
      setLeft(s);
      if (s === 0) stop();
    }, 250);
  };
  return (
    <section className="activity jam">
      <Bubble>{hint || activity.text}</Bubble>
      {left === null ? (
        <button className="brick-button big" onClick={() => void start()}>
          🎸 گروه را روشن کن
        </button>
      ) : left > 0 ? (
        <div className="jam-meter">
          <b>{fa(count)} نت ساختی</b>
          <div className="progress-bar">
            <i style={{ width: `${100 - (100 * left) / activity.seconds}%` }} />
          </div>
        </div>
      ) : (
        <div className="activity-buttons">
          <b className="done-note">🎉 {fa(count)} نت! تو آهنگ خودت را ساختی.</b>
          <button className="brick-button big" onClick={() => onDone(1)}>
            ادامه ▶
          </button>
        </div>
      )}
      <Keys
        low={set.low}
        high={set.high}
        input={input}
        bus={bus}
        onNote={(m) => {
          if (!left) return;
          if (set.allowed(m)) {
            setCount((c) => c + 1);
            setHint("");
          } else setHint(activity.keys === "black" ? "این یکی سفید بود؛ روی سیاه‌ها بمان 🙂" : "روی کلیدهای رنگی‌تر بمان 🙂");
        }}
      />
    </section>
  );
}

type EarRound = { notes: [number, number][]; answer: string };
const EAR: Record<string, { choices: [string, string][]; make: () => EarRound; say: string }> = {
  highlow: {
    say: "گوش کن! این صدا زیر است یا بم؟",
    choices: [
      ["high", "🐦 زیر"],
      ["low", "🐻 بم"],
    ],
    make: () => {
      const high = Math.random() < 0.5;
      const m = high ? 79 + Math.floor(Math.random() * 10) : 40 + Math.floor(Math.random() * 10);
      return { notes: [[m, 0.3]], answer: high ? "high" : "low" };
    },
  },
  loudsoft: {
    say: "گوش کن! این صدا بلند است یا آهسته؟",
    choices: [
      ["loud", "🦁 بلند"],
      ["soft", "🐭 آهسته"],
    ],
    make: () => {
      const loud = Math.random() < 0.5;
      return { notes: [[60 + [0, 4, 7][Math.floor(Math.random() * 3)], loud ? 0.4 : 0.035]], answer: loud ? "loud" : "soft" };
    },
  },
  updown: {
    say: "دو صدا می‌شنوی. دومی بالا رفت، پایین آمد، یا همان بود؟",
    choices: [
      ["up", "⬆️ بالا"],
      ["down", "⬇️ پایین"],
      ["same", "➡️ همان"],
    ],
    make: () => {
      const white = [60, 62, 64, 65, 67, 69, 71, 72];
      const a = white[1 + Math.floor(Math.random() * 6)];
      const dir = ["up", "down", "same"][Math.floor(Math.random() * 3)];
      const step = 1 + Math.floor(Math.random() * 2);
      const i = white.indexOf(a);
      const b = dir === "same" ? a : white[Math.min(7, Math.max(0, i + (dir === "up" ? step : -step)))];
      return { notes: [[a, 0.25], [b, 0.25]], answer: dir };
    },
  },
};
export function Ear({ activity, onDone }: Props<"ear">) {
  const game = EAR[activity.game];
  const [round, setRound] = useState(() => game.make()),
    [n, setN] = useState(0),
    [say, setSay] = useState(game.say),
    [mood, setMood] = useState("");
  const clean = useRef(0),
    missed = useRef(false);
  const play = async (r = round) => {
    for (const [m, v] of r.notes) {
      void playNote(m, 0.7, v).catch(() => {});
      await wait(700);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => void play(round), 500);
    return () => clearTimeout(t);
  }, [round]);
  const answer = (a: string) => {
    if (a === round.answer) {
      if (!missed.current) clean.current++;
      missed.current = false;
      setMood("good");
      setSay(PRAISE[n % PRAISE.length]);
      const next = n + 1;
      setN(next);
      setTimeout(() => {
        setMood("");
        if (next >= activity.rounds) onDone(clean.current / activity.rounds);
        else {
          setSay(game.say);
          setRound(game.make());
        }
      }, 800);
    } else {
      missed.current = true;
      setMood("oops");
      setSay("نه دقیقاً؛ یک بار دیگر گوش کن 👂");
      void play();
    }
  };
  return (
    <section className={"activity ear " + mood}>
      <Rounds n={n} of={activity.rounds} />
      <Bubble>{say}</Bubble>
      <button className="brick-button outline" onClick={() => void play()}>
        <Volume2 /> دوباره بشنو
      </button>
      <div className="ear-choices">
        {game.choices.map(([id, label]) => (
          <button key={id} className="ear-choice" onClick={() => answer(id)}>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function Find({ activity, input, bus, onDone }: Props<"find">) {
  const low = 48,
    high = 84,
    t = activity.target;
  // Which "thing" a key belongs to: a black-key group (named by its lowest key), or itself.
  const group = (m: number): number | null => {
    const pc = m % 12;
    if (t === "two") return [1, 3].includes(pc) ? m - pc + 1 : null;
    if (t === "three") return [6, 8, 10].includes(pc) ? m - pc + 6 : null;
    return pc === t ? m : null;
  };
  const all = new Set<number>();
  for (let m = low; m <= high; m++) {
    const g = group(m);
    if (g !== null) all.add(g);
  }
  const [found, setFound] = useState<number[]>([]),
    [say, setSay] = useState(activity.text),
    [wrong, setWrong] = useState(0);
  const members = (g: number) =>
    t === "two" ? [g, g + 2] : t === "three" ? [g, g + 2, g + 4] : [g];
  const hint =
    t === "two" ? "دوقلوها دو کلید سیاهِ کنار هم‌اند" : t === "three" ? "سه‌قلوها سه کلید سیاهِ کنار هم‌اند" : `«${noteName(t)}» را کنار کلیدهای سیاه پیدا کن`;
  return (
    <section className="activity find">
      <Rounds n={found.length} of={all.size} />
      <Bubble>{say}</Bubble>
      {found.length === all.size && (
        <button className="brick-button big" onClick={() => onDone(all.size / (all.size + wrong))}>
          همه را پیدا کردی! ادامه ▶
        </button>
      )}
      <Keys
        low={low}
        high={high}
        lit={found.flatMap(members)}
        input={input}
        bus={bus}
        bare={typeof t === "number"}
        onNote={(m) => {
          const g = group(m);
          if (g === null) {
            setWrong((w) => w + 1);
            setSay(`این نبود. ${hint} 🔍`);
          } else if (!found.includes(g)) {
            const next = [...found, g];
            setFound(next);
            setSay(next.length === all.size ? "🎉 همه را پیدا کردی!" : `${fa(next.length)} تا پیدا شد! بقیه کجا هستند؟`);
          } else setSay("این یکی را قبلاً پیدا کردی؛ یکی دیگر! 🙂");
        }}
      />
    </section>
  );
}

export function Echo({ activity, input, bus, onDone }: Props<"echo">) {
  const pats = activity.patterns,
    flat = pats.flat();
  const [r, setR] = useState(0),
    [phase, setPhase] = useState<"listen" | "play" | "good">("listen"),
    [at, setAt] = useState(0),
    [showing, setShowing] = useState<number | null>(null),
    [misses, setMisses] = useState(0),
    [say, setSay] = useState(activity.text ?? "گوش کن و ببین؛ بعد تو همان را بزن");
  const clean = useRef(0),
    alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  const demo = async (round = r) => {
    setPhase("listen");
    setAt(0);
    await wait(500);
    for (const m of pats[round]) {
      if (!alive.current) return;
      setShowing(m);
      void playNote(m, 0.45, 0.25).catch(() => {});
      await wait(560);
    }
    setShowing(null);
    if (!alive.current) return;
    setPhase("play");
    setSay("حالا نوبت توست! 🎹");
  };
  useEffect(() => void demo(r), [r]);
  const note = (m: number) => {
    if (phase !== "play") return;
    const want = pats[r][at];
    if (m === want) {
      const next = at + 1;
      setAt(next);
      if (next === pats[r].length) {
        if (!misses) clean.current++;
        setPhase("good");
        setSay(PRAISE[r % PRAISE.length]);
        setTimeout(() => {
          if (!alive.current) return;
          if (r + 1 >= pats.length) onDone(clean.current / pats.length);
          else {
            setMisses(0);
            setSay("گوش کن…");
            setR(r + 1);
          }
        }, 900);
      }
    } else {
      setMisses((x) => x + 1);
      setSay(misses >= 1 ? "کلیدی که می‌درخشد را بزن ✨" : `${noteName(m)} زدی؛ یک بار دیگر گوش کن 👂`);
      if (misses < 1) void demo();
      else setAt(0);
    }
  };
  const lit =
    showing !== null ? [showing] : phase === "play" && misses >= 1 ? [pats[r][at]] : [];
  return (
    <section className={"activity echo " + (phase === "good" ? "good" : "")}>
      <Rounds n={r + (phase === "good" ? 1 : 0)} of={pats.length} />
      <Bubble>{say}</Bubble>
      <div className="echo-dots" dir="ltr">
        {pats[r].map((m, i) => (
          <i
            key={i}
            className={phase !== "listen" && i < at ? "on" : ""}
            style={{ "--c": noteColor(m) } as React.CSSProperties}
          />
        ))}
      </div>
      <button className="brick-button outline" disabled={phase === "listen"} onClick={() => void demo()}>
        <Volume2 /> دوباره نشانم بده
      </button>
      <Keys
        low={Math.min(60, ...flat)}
        high={Math.max(72, ...flat)}
        lit={lit}
        input={input}
        bus={bus}
        onNote={note}
      />
    </section>
  );
}

const WORD: Record<string, [string, string]> = {
  q: ["👣", "راه"],
  e: ["👟👟", "دو-دو"],
  h: ["🦶〰️", "وایسا"],
  r: ["🤫", "هیس"],
};
export function Rhythm({ activity, input, bus, onDone }: Props<"rhythm">) {
  const beat = 60 / activity.bpm;
  const [r, setR] = useState(0),
    [phase, setPhase] = useState<"ready" | "listen" | "count" | "tap" | "judged">("ready"),
    [now, setNow] = useState(-1),
    [hits, setHits] = useState<boolean[] | null>(null),
    [tries, setTries] = useState(0),
    [say, setSay] = useState("اول گوش کن، بعد با من دست بزن");
  const { cards, onsets, beats } = parseRhythm(activity.patterns[r]);
  const taps = useRef<number[]>([]),
    t0 = useRef(0),
    clean = useRef(0),
    alive = useRef(true),
    tapping = useRef(false);
  useEffect(() => () => void (alive.current = false), []);
  const drum = () => void playNote(45, 0.18, 0.35).catch(() => {});
  /** Count four, then either drum the pattern or open the window for the child's taps. */
  const run = async (demo: boolean) => {
    setHits(null);
    setPhase(demo ? "listen" : "count");
    setSay(demo ? "گوش کن…" : "یک، دو، سه، حالا!");
    for (let k = 0; k < 4; k++) {
      void tick(k === 0).catch(() => {});
      await wait(beat * 1000);
      if (!alive.current) return;
    }
    t0.current = performance.now();
    taps.current = [];
    if (!demo) {
      tapping.current = true;
      setPhase("tap");
      setSay("بزن! 🥁");
    }
    const started = performance.now();
    let i = 0;
    while (performance.now() - started < (beats + 0.6) * beat * 1000) {
      const b = (performance.now() - started) / 1000 / beat;
      setNow(b);
      if (demo && i < onsets.length && b >= onsets[i] - 0.02) {
        drum();
        i++;
      }
      await wait(15);
      if (!alive.current) return;
    }
    setNow(-1);
    tapping.current = false;
    if (demo) return void run(false);
    const tol = Math.max(0.2, 0.35 * beat) / beat;
    const j = judgeTaps(onsets, taps.current, tol);
    setHits(j.hits);
    setPhase("judged");
    if (j.ok) {
      if (!tries) clean.current++;
      setSay(tries ? "حالا درست شد! ضرب را نگه داشتی 🎉" : "دقیق روی ضرب! 🎉");
      setTimeout(() => {
        if (!alive.current) return;
        if (r + 1 >= activity.patterns.length) onDone(clean.current / activity.patterns.length);
        else {
          setTries(0);
          setPhase("ready");
          setSay("ریتم بعدی!");
          setR(r + 1);
        }
      }, 1100);
    } else {
      setTries((t) => t + 1);
      setSay(tries >= 2 ? "مهم نیست، بعدی را امتحان کنیم 💪" : "نزدیک بود! کارت‌های قرمز را دوباره گوش کن");
      if (tries >= 2)
        setTimeout(() => {
          if (!alive.current) return;
          if (r + 1 >= activity.patterns.length) onDone(clean.current / activity.patterns.length);
          else {
            setTries(0);
            setPhase("ready");
            setR(r + 1);
          }
        }, 1400);
    }
  };
  const tap = () => {
    drum();
    if (tapping.current) taps.current.push((performance.now() - t0.current) / 1000 / beat);
  };
  return (
    <section className="activity rhythm-activity">
      <Rounds n={r} of={activity.patterns.length} />
      <Bubble>{say}</Bubble>
      <div className="rhythm-cards">
        {cards.map((c, i) => {
          const playing = now >= c.at && now < c.at + c.beats;
          const ons = onsets.filter((o) => o >= c.at && o < c.at + c.beats);
          const result = hits && ons.length ? ons.every((o) => hits[onsets.indexOf(o)]) : null;
          return (
            <div
              key={i}
              className={`rhythm-card ${c.kind} ${playing ? "now" : ""} ${result === true ? "hit" : result === false ? "miss" : ""}`}
              style={{ flexGrow: c.beats }}
            >
              <span>{WORD[c.kind][0]}</span>
              <b>{WORD[c.kind][1]}</b>
            </div>
          );
        })}
      </div>
      {(phase === "ready" || (phase === "judged" && hits && !hits.every(Boolean) && tries < 3)) && (
        <button className="brick-button big" onClick={() => void run(true)}>
          ▶ {phase === "ready" ? "شروع" : "دوباره"}
        </button>
      )}
      <button
        className={"drum-pad " + (phase === "tap" ? "live" : "")}
        onPointerDown={(e) => {
          e.preventDefault();
          tap();
        }}
        aria-label="طبل"
      >
        🥁
      </button>
      {input === "mic" && <Keys low={60} high={72} input={input} bus={bus} onNote={tap} />}
    </section>
  );
}

export function Read({ activity, input, bus, onDone }: Props<"read">) {
  const notes = activity.notes;
  const [i, setI] = useState(0),
    [miss, setMiss] = useState(0),
    [say, setSay] = useState(activity.text),
    [good, setGood] = useState(false);
  const clean = useRef(0);
  const m = notes[Math.min(i, notes.length - 1)];
  const low = Math.min(60, ...notes),
    high = Math.max(72, ...notes);
  return (
    <section className={"activity read " + (good ? "good" : "")}>
      <Rounds n={i} of={notes.length} />
      <Bubble>{say}</Bubble>
      <div className="read-card">
        {activity.staff ? (
          <Staff steps={[{ midi: m, beats: 1 }]} current={0} />
        ) : (
          <b className="note-name">{noteName(m)}</b>
        )}
      </div>
      <Keys
        low={low}
        high={high}
        bare
        lit={miss >= 2 ? [m] : []}
        input={input}
        bus={bus}
        onNote={(played) => {
          if (good) return;
          if (played % 12 === m % 12 && (activity.staff ? played === m : true)) {
            if (!miss) clean.current++;
            setGood(true);
            setSay(PRAISE[i % PRAISE.length]);
            setTimeout(() => {
              setGood(false);
              setMiss(0);
              setSay(activity.text);
              if (i + 1 >= notes.length) onDone(clean.current / notes.length);
              else setI(i + 1);
            }, 700);
          } else {
            setMiss((x) => x + 1);
            setSay(miss >= 1 ? "کلیدی که می‌درخشد را بزن ✨" : `این «${noteName(played)}» بود؛ «${noteName(m)}» را پیدا کن`);
          }
        }}
      />
    </section>
  );
}

/** A song step: the child picks from the choices, then the game plays it in the given mode. */
export function SongPick({
  activity,
  choices,
  onSong,
}: {
  activity: Extract<Activity, { kind: "song" }>;
  choices: string[];
  onSong: (id: string, mode: Mode) => void;
}) {
  const label: Record<Mode, string> = {
    listen: "👂 اول گوش بده و ببین",
    learn: "🐢 آروم با من — آجرها منتظرت می‌مانند",
    rhythm: "⚡ با ریتم و با گروه",
  };
  return (
    <section className="activity song-pick">
      <Bubble>
        {choices.length > 1 ? "کدام آهنگ را می‌خواهی بزنی؟ خودت انتخاب کن!" : label[activity.mode]}
      </Bubble>
      <div className="song-choices">
        {choices.map((id, n) => {
          const s = songs.find((x) => x.id === id)!;
          return (
            <button
              key={id}
              className="song-choice"
              style={{ "--c": ["#e3000b", "#0a6cd6", "#00a650", "#ff7a00", "#8e44ad"][n % 5] } as React.CSSProperties}
              onClick={() => onSong(id, activity.mode)}
            >
              <span>🎵</span>
              <b>{s.title}</b>
              <small>{s.subtitle}</small>
            </button>
          );
        })}
      </div>
      {choices.length > 1 && <p className="mode-line">{label[activity.mode]}</p>}
    </section>
  );
}
