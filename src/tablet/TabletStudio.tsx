import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Volume2,
  VolumeX,
  Maximize,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ChevronLeft,
} from "lucide-react";
import {
  fa,
  keyNumber,
  noteName,
  western,
  type Lesson,
  type Step,
} from "../curriculum";
import { playNote, audioContext } from "../audio";
import { type Attempt } from "../storage";
import {
  tabletLessons,
  keyFor,
  transpose,
  chunks,
  readBase,
  saveBase,
  validBase,
} from "./model";
import { useMicrophone } from "./useMicrophone";
import { speakClip, stopVoice } from "./voice";
import "./tablet.css";
type Phase =
  "setup" | "check" | "ready" | "demo" | "playing" | "paused" | "complete";
export function FantasyIcon({
  name,
  className = "",
}: {
  name: "coach" | "piano" | "trophy";
  className?: string;
}) {
  return (
    <img
      className={"fantasy-icon " + className}
      src={`/icons/${name}.png`}
      alt=""
      draggable={false}
    />
  );
}
export function TabletStudio({
  onExit,
  onSave,
}: {
  onExit: () => void;
  onSave: (a: Attempt) => void;
}) {
  const [phase, setPhase] = useState<Phase>("setup"),
    [base, setBase] = useState(readBase),
    [selected, setSelected] = useState(0),
    [part, setPart] = useState(0),
    [full, setFull] = useState(false),
    [index, setIndex] = useState(0),
    [mistakes, setMistakes] = useState(0),
    [feedback, setFeedback] = useState(
      "با کمک یک بزرگ‌تر، کیبورد را آماده کنیم.",
    ),
    [voice, setVoice] = useState(true),
    [speaking, setSpeaking] = useState(false),
    [voiceError, setVoiceError] = useState(false),
    [checks, setChecks] = useState(0),
    [detected, setDetected] = useState<number | null>(null),
    [elapsed, setElapsed] = useState(0),
    [awake, setAwake] = useState(false),
    [storageError, setStorageError] = useState(false);
  const phaseRef = useRef<Phase>("setup"),
    indexRef = useRef(0),
    wrongRef = useRef(0),
    epoch = useRef(0),
    busy = useRef(false),
    checkRef = useRef<{ midi: number; count: number }>({ midi: -1, count: 0 }),
    sessionStart = useRef(0),
    practiceStart = useRef(0),
    checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    wake = useRef<WakeLockSentinel | null>(null),
    handler = useRef<(n: number) => void>(() => {});
  const lesson = tabletLessons[selected],
    parts = chunks(lesson.steps),
    steps = full ? lesson.steps : parts[part],
    target = steps[index],
    total = steps.length;
  const changePhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const mic = useMicrophone(
    (m) => handler.current(m),
    () =>
      !busy.current &&
      (phaseRef.current === "playing" || phaseRef.current === "check"),
  );
  const invalidate = () => {
    epoch.current++;
    void wake.current?.release();
    wake.current=null;
    setAwake(false);
    stopVoice();
    busy.current = false;
    setSpeaking(false);
    if (checkTimer.current) clearTimeout(checkTimer.current);
  };
  const say = async (name: string, token = epoch.current) => {
    if (!voice) return true;
    busy.current = true;
    setSpeaking(true);
    const ok = await speakClip(name);
    if (token !== epoch.current) return false;
    if (!ok) setVoiceError(true);
    await new Promise((r) => setTimeout(r, 300));
    if (token !== epoch.current) return false;
    busy.current = false;
    setSpeaking(false);
    return true;
  };
  const microphoneError = (e: unknown) => {
    mic.stop();
    changePhase("setup");
    setFeedback(
      e instanceof DOMException && e.name === "NotAllowedError"
        ? "اجازهٔ میکروفون داده نشد. در تنظیمات مرورگر، میکروفون را برای این سایت روشن کن و دوباره امتحان کن."
        : "میکروفون در دسترس نیست. اتصال و اجازهٔ مرورگر را بررسی کن و دوباره امتحان کن.",
    );
  };
  const pause = () => {
    invalidate();
    mic.stop();
    changePhase("paused");
    setFeedback(
      "استراحت کنیم! هر وقت آماده بودی، همین بخش را دوباره شروع می‌کنیم.",
    );
  };
  const resetPart = () => {
    invalidate();
    mic.stop();
    indexRef.current = 0;
    wrongRef.current = 0;
    setIndex(0);
    setMistakes(0);
    changePhase("ready");
    setFeedback("اول گوش می‌کنیم؛ بعد نوبت توست.");
  };
  const exit = () => {
    invalidate();
    mic.stop();
    void wake.current?.release();
    onExit();
  };
  const startCheck = async () => {
    invalidate();
    checkRef.current = { midi: -1, count: 0 };
    setChecks(0);
    setDetected(null);
    changePhase("check");
    busy.current = true;
    setFeedback("کلید «دو» را سه بار جدا بزن؛ بین ضربه‌ها کامل رها کن.");
    const token = epoch.current;
    try {
      if (!(await mic.start())) return;
      if (token !== epoch.current) return;
      await say("setup", token);
      if (token !== epoch.current) return;
      busy.current = false;
      checkTimer.current = setTimeout(() => {
        if (phaseRef.current === "check") {
          invalidate();
          mic.stop();
          changePhase("setup");
          setFeedback(
            "هنوز سه صدای واضح نشنیدم. صدای کیبورد را کمی زیاد کن، پدال و افکت‌ها را خاموش کن و دوباره امتحان کن.",
          );
        }
      }, 30000);
    } catch (e) {
      if (token === epoch.current) microphoneError(e);
    }
  };
  const confirm = () => {
    if (detected === null) return;
    setBase(detected);
    if (!saveBase(detected)) setStorageError(true);
    resetPart();
  };
  const requestWake = async (token:number) => {
    try {
      if (navigator.wakeLock) {
        const lock = await navigator.wakeLock.request("screen");
        if(token!==epoch.current){await lock.release();return;}
        wake.current=lock;
        setAwake(true);
        wake.current.addEventListener("release", () => setAwake(false));
      }
    } catch {
      setAwake(false);
    }
  };
  const startPlay = async () => {
    invalidate();
    indexRef.current = 0;
    wrongRef.current = 0;
    setIndex(0);
    setMistakes(0);
    const token = epoch.current;
    changePhase("playing");
    busy.current = true;
    setFeedback(
      "حالا نوبت توست. کلید " + fa(keyFor(steps[0].midi)) + " را بزن.",
    );
    try {
      if (!(await mic.start())) return;
      if (token !== epoch.current) return;
      await requestWake(token);
      if(token!==epoch.current)return;
      if (!sessionStart.current) sessionStart.current = Date.now();
      await say("key-" + keyFor(steps[0].midi), token);
      if (token !== epoch.current) return;
      busy.current = false;
      practiceStart.current = performance.now();
    } catch (e) {
      if (token === epoch.current) microphoneError(e);
    }
  };
  const demonstrate = async () => {
    invalidate();
    mic.stop();
    indexRef.current = 0;
    setIndex(0);
    changePhase("demo");
    const token = epoch.current;
    setFeedback("گوش کن و شماره‌ها را دنبال کن.");
    try {
      await audioContext();
      await say("listen", token);
      for (let i = 0; i < steps.length; i++) {
        if (token !== epoch.current) return;
        setIndex(i);
        await playNote(
          transpose(steps[i].midi, base),
          ((steps[i].beats * 60) / lesson.bpm) * 0.85,
        );
        await new Promise((r) =>
          setTimeout(r, (steps[i].beats * 60000) / lesson.bpm),
        );
      }
      if (token !== epoch.current) return;
      setIndex(0);
      changePhase("ready");
      setFeedback("شنیدی؟ حالا نوبت توست.");
      await say("your-turn", token);
    } catch {
      if (token === epoch.current) {
        changePhase("ready");
        setFeedback(
          "صدا پخش نشد. صدای تبلت را روشن کن و «بشنو» را دوباره بزن.",
        );
      }
    }
  };
  handler.current = (m) => {
    if (phaseRef.current === "check") {
      if (!validBase(m)) {
        setFeedback(
          "این صدا " +
            noteName(m) +
            " است. کلید سفیدِ چسبیده به سمت چپِ دو کلید سیاه را بزن.",
        );
        return;
      }
      if (checkRef.current.midi !== m) checkRef.current = { midi: m, count: 0 };
      checkRef.current.count++;
      setChecks(checkRef.current.count);
      setFeedback(
        "صدای واضح " +
          fa(checkRef.current.count) +
          " از ۳؛ کلید را کامل رها کن.",
      );
      if (checkRef.current.count === 3) {
        setDetected(m);
        if (checkTimer.current) clearTimeout(checkTimer.current);
        mic.stop();
        changePhase("setup");
        setFeedback(
          "پیدایش کردیم! کلید شمارهٔ ۱ شما " +
            western(m) +
            " است. حالا برچسب‌ها را بگذارید و تأیید کنید.",
        );
      }
      return;
    }
    if (phaseRef.current !== "playing" || busy.current) return;
    const expected = steps[indexRef.current];
    if (!expected) return;
    if (m === transpose(expected.midi, base)) {
      indexRef.current++;
      setIndex(indexRef.current);
      if (indexRef.current === steps.length) {
        mic.stop();
        void wake.current?.release();
        wake.current=null;
        setAwake(false);
        changePhase("complete");
        setFeedback(
          full ? "آفرین! یک اجرای کامل داشتی." : "این تکه را یاد گرفتی!",
        );
        const a: Attempt = {
          id: lesson.id,
          at: new Date().toISOString(),
          correct: steps.length,
          wrong: wrongRef.current,
          accuracy: Math.round(
            (steps.length / (steps.length + wrongRef.current)) * 100,
          ),
          seconds: Math.max(
            1,
            Math.round((performance.now() - practiceStart.current) / 1000),
          ),
          source: "mic",
          partial: !full,
          mode: "tablet",
          rhythm: null,
          baseMidi: base,
        };
        onSave(a);
        void say("complete");
      } else {
        setFeedback(
          "آفرین! حالا کلید " +
            fa(keyFor(steps[indexRef.current].midi)) +
            " را بزن.",
        );
        void say("key-" + keyFor(steps[indexRef.current].midi));
      }
    } else {
      wrongRef.current++;
      setMistakes(wrongRef.current);
      setFeedback(
        "این یکی نبود؛ کلید " +
          fa(keyFor(expected.midi)) +
          " را " +
          (m > transpose(expected.midi, base) ? "سمت چپ‌تر" : "سمت راست‌تر") +
          " پیدا کن.",
      );
      void say("key-" + keyFor(expected.midi));
    }
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        if (phaseRef.current === "check") {
          invalidate();
          mic.stop();
          changePhase("setup");
          setFeedback("بررسی صدا متوقف شد؛ وقتی آماده بودید دوباره شروع کنید.");
        } else if (
          phaseRef.current === "playing" ||
          phaseRef.current === "demo"
        )
          pause();
      }
    };
    document.addEventListener("visibilitychange", hide);
    const clock = setInterval(() => {
      if (sessionStart.current)
        setElapsed(Math.floor((Date.now() - sessionStart.current) / 60000));
    }, 1000);
    return () => {
      epoch.current++;
      stopVoice();
      if (checkTimer.current) clearTimeout(checkTimer.current);
      document.removeEventListener("visibilitychange", hide);
      clearInterval(clock);
      void wake.current?.release();
    };
  }, []);
  const switchLesson = (i: number) => {
    resetPart();
    setSelected(i);
    setPart(0);
    setFull(false);
  };
  return (
    <div className="tablet-studio">
      <div className="tablet-top">
        <button className="small-button" onClick={exit}>
          <ArrowRight size={18} /> استودیو
        </button>
        <div className="tablet-brand">
          <FantasyIcon name="coach" />
          <b>ماهور و ستارهٔ موسیقی</b>
        </div>
        <div className="tablet-tools">
          <button
            className="icon-button"
            disabled={
              phase === "playing" ||
              phase === "demo" ||
              phase === "check" ||
              speaking
            }
            aria-label={
              voice ? "خاموش کردن راهنمای صوتی" : "روشن کردن راهنمای صوتی"
            }
            onClick={() => {
              invalidate();
              setVoice(!voice);
            }}
          >
            {voice ? <Volume2 /> : <VolumeX />}
          </button>
          <button
            className="icon-button"
            aria-label="تمام صفحه"
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {});
              } else if (document.documentElement.requestFullscreen) {
                void document.documentElement.requestFullscreen().catch(() =>
                  setFeedback("برای فضای بیشتر، تبلت را افقی بگذار."));
              } else {
                setFeedback("این مرورگر تمام‌صفحه ندارد؛ تبلت را افقی بگذار یا سایت را به صفحهٔ اصلی اضافه کن.");
              }
            }}
          >
            <Maximize />
          </button>
        </div>
      </div>
      {phase === "setup" || phase === "check" ? (
        <div className="keyboard-setup">
          <div className="setup-title">
            <FantasyIcon name="piano" />
            <span className="eyebrow">یک تنظیم کوتاه، با کمک یک بزرگ‌تر</span>
            <h1>تبلت بالا، کیبورد پایین!</h1>
            <p>
              صدای Piano را انتخاب کنید. افکت، همراهی خودکار و پدال خاموش؛ صدای
              کیبورد متوسط و اتاق آرام.
            </p>
          </div>
          <div className="setup-grid">
            <section className="card">
              <span className="step-label">۱ · کلید شروع را پیدا کنید</span>
              <h2>سمت چپِ دو کلید سیاه</h2>
              <p>
                یک گروه دو کلید سیاه پیدا کنید که سمت راستش حداقل ۸ کلید سفید جا
                باشد. سفیدِ بلافاصله چپِ آن، «دو» است؛ این می‌شود شمارهٔ ۱.
              </p>
              <div className="setup-key-diagram" dir="ltr">
                {["۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸"].map((n, i) => (
                  <div className={i === 0 ? "start-key" : ""} key={n}>
                    <b>{n}</b>
                    {[0, 1, 3, 4, 5].includes(i) && <i />}
                  </div>
                ))}
              </div>
              <p>
                برچسب‌ها فقط روی کلیدهای سفید، از چپ به راست ۱ تا ۸. شمارهٔ کلید
                با شمارهٔ انگشت فرق دارد.
              </p>
            </section>
            <section className="card">
              <span className="step-label">۲ · صدایش را بشنویم</span>
              <h2>
                {detected === null ? "سه ضربهٔ جدا" : "کیبوردت را شناختیم!"}
              </h2>
              <p>
                برای شناسایی اکتاو، همان «دو» را سه بار بزنید. بین ضربه‌ها کلید
                را کامل رها کنید؛ لازم نیست خیلی محکم بزنید.
              </p>
              <div className="check-dots">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={checks >= n ? "checked" : ""}>
                    {checks >= n ? <Check /> : fa(n)}
                  </span>
                ))}
              </div>
              <div
                className="sound-meter"
                role="meter"
                aria-label="بلندی صدای دریافتی"
                aria-valuenow={Math.round(mic.level)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: mic.level + "%" }} />
              </div>
              <p role="status">{feedback}</p>
              {detected !== null ? (
                <>
                  <div className="mapped-keys" dir="ltr">
                    {[60, 62, 64, 65, 67, 69, 71, 72].map((m) => (
                      <span key={m}>
                        {keyNumber(m)}
                        <small>{western(transpose(m, detected))}</small>
                      </span>
                    ))}
                  </div>
                  <button className="button" onClick={confirm}>
                    برچسب‌ها آماده‌اند؛ بریم! <ChevronLeft />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void startCheck()}
                  >
                    دوباره بررسی کن
                  </button>
                </>
              ) : (
                <button
                  className="button"
                  onClick={() =>
                    phase === "check"
                      ? (invalidate(), mic.stop(), changePhase("setup"))
                      : void startCheck()
                  }
                >
                  <Mic size={19} />
                  {phase === "check" ? "توقف بررسی" : "میکروفون را بررسی کن"}
                </button>
              )}
            </section>
          </div>
          <p className="setup-privacy">
            صدای ساز فقط روی همین تبلت بررسی می‌شود و ذخیره یا ارسال نمی‌شود. از
            سه اکتاو C3، C4 و C5 پشتیبانی می‌کنیم.
          </p>
        </div>
      ) : (
        <>
          <div className="tablet-lesson-bar">
            <div>
              <span className="eyebrow">
                {lesson.title} ·{" "}
                {full
                  ? "اجرای کامل"
                  : "تکهٔ " + fa(part + 1) + " از " + fa(parts.length)}
              </span>
              <div className="tablet-dots">
                {parts.map((_, i) => (
                  <span
                    key={i}
                    className={i === part ? "current" : i < part ? "past" : ""}
                  />
                ))}
              </div>
            </div>
            <button
              className="text-button"
              onClick={() => {
                invalidate();
                mic.stop();
                setDetected(null);
                setChecks(0);
                changePhase("setup");
              }}
            >
              <Settings2 size={17} /> تنظیم ساز
            </button>
          </div>
          <div className="coach-stage">
            <aside className="coach-friend">
              <FantasyIcon name={phase === "complete" ? "trophy" : "coach"} />
              <span>
                {speaking
                  ? "ستاره دارد راهنمایی می‌کند"
                  : mic.active
                    ? "گوشم با توست"
                    : "با هم یاد می‌گیریم"}
              </span>
              <div className="sound-meter">
                <i style={{ width: mic.level + "%" }} />
              </div>
            </aside>
            <section className="giant-note">
              <div className="note-stage-label">
                {phase === "complete"
                  ? "یک قدم جلوتر!"
                  : phase === "demo"
                    ? "این نت را گوش کن"
                    : phase === "paused"
                      ? "یک نفس راحت"
                      : speaking
                        ? "اول گوش کن"
                        : "روی کیبورد خودت بزن"}
              </div>
              {phase === "complete" ? (
                <div className="big-star">★</div>
              ) : (
                <div className="giant-number">
                  {fa(keyFor((target || steps[0]).midi))}
                </div>
              )}
              <div className="giant-note-name">
                {phase === "complete"
                  ? `${fa(total)} نت با تلاش خودت`
                  : noteName((target || steps[0]).midi) +
                    " · کلید شمارهٔ " +
                    fa(keyFor((target || steps[0]).midi))}
              </div>
              <div className="tablet-feedback" role="status" aria-live="polite">
                {mic.quality === "unclear" && !speaking
                  ? "صدا واضح نیست؛ آرام و فقط یک کلید بزن."
                  : feedback}
              </div>
            </section>
            <aside className="up-next">
              <span>بعدش این‌ها</span>
              <div dir="ltr">
                {steps
                  .slice(Math.min(index + 1, total), index + 4)
                  .map((s, i) => (
                    <span key={i}>{fa(keyFor(s.midi))}</span>
                  ))}
              </div>
              <span>
                {fa(Math.min(index, total))} از {fa(total)} نت
              </span>
            </aside>
          </div>
          <div className="tablet-progress">
            <i
              style={{ width: (Math.min(index, total) / total) * 100 + "%" }}
            />
          </div>
          <div className="tablet-actions">
            {phase === "playing" || phase === "demo" ? (
              <button className="button outline" onClick={pause}>
                <Pause /> یک کم استراحت
              </button>
            ) : phase === "complete" ? (
              <>
                <button
                  className="button"
                  onClick={() => {
                    resetPart();
                    if (full) {
                      setSelected((selected + 1) % tabletLessons.length);
                      setPart(0);
                      setFull(false);
                    } else if (part + 1 < parts.length) setPart(part + 1);
                    else {
                      setFull(true);
                      setPart(0);
                    }
                  }}
                >
                  {full
                    ? "آهنگ یا درس بعدی"
                    : part + 1 < parts.length
                      ? "تکهٔ بعدی"
                      : "حالا از اول تا آخر"}{" "}
                  <ChevronLeft />
                </button>
                <button className="button outline" onClick={resetPart}>
                  <RotateCcw /> یک بار دیگر
                </button>
              </>
            ) : (
              <>
                <button className="button" onClick={() => void demonstrate()}>
                  <Volume2 /> اول بشنو
                </button>
                <button
                  className="button sunshine"
                  onClick={() => void startPlay()}
                >
                  <Play />{" "}
                  {phase === "paused"
                    ? "شروع دوبارهٔ این تکه"
                    : "حالا من می‌زنم"}
                </button>
              </>
            )}
            {phase === "playing" && (
              <button
                disabled={speaking}
                className="text-button"
                onClick={() =>
                  void say("key-" + keyFor(steps[indexRef.current].midi))
                }
              >
                دوباره راهنمایی کن
              </button>
            )}
          </div>
          <div className="tablet-footnote">
            <span>
              {awake
                ? "صفحه هنگام تمرین روشن می‌ماند"
                : "برای تمرین، تبلت را افقی بگذار"}
            </span>
            <span>
              ۱ = {western(base)} · {fa(mistakes)} بار دوباره امتحان کردیم
            </span>
          </div>
          {elapsed >= 8 && (
            <div className="notice">
              ۸ دقیقه همراه هم بودیم؛ وقت یک استراحت کوتاه و تکان‌دادن دست‌هاست.
            </div>
          )}
          {(phase === "ready" ||
            phase === "paused" ||
            phase === "complete") && (
            <div className="tablet-library">
              <h3>امروز چه چیزی بزنیم؟</h3>
              <div>
                {tabletLessons.map((l, i) => (
                  <button
                    key={l.id}
                    className={i === selected ? "selected" : ""}
                    onClick={() => switchLesson(i)}
                  >
                    <FantasyIcon name={l.kind === "song" ? "coach" : "piano"} />
                    {l.title}
                  </button>
                ))}
              </div>
              <p>
                اینجا مخصوص شروع با ۸ کلید است. برای نت‌خوانی و مراحل بعدی، به
                «مسیر یادگیری» در استودیو برو.
              </p>
            </div>
          )}
        </>
      )}
      {voiceError && (
        <div className="notice">
          راهنمای صوتی پخش نشد؛ صدای تبلت و اتصال را بررسی کن. شماره و دستور روی
          صفحه همچنان کار می‌کنند.
        </div>
      )}
      {storageError && (
        <div className="notice">
          تنظیم ساز در مرورگر ذخیره نشد؛ دفعهٔ بعد دوباره آن را بررسی می‌کنیم.
        </div>
      )}
    </div>
  );
}
