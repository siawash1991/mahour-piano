import React from "react";
import { ArrowRight, Download, RotateCcw, Trash2 } from "lucide-react";
import { fa } from "./curriculum";
import { stages } from "./game/engine";
import { clearTuning } from "./game/tuning";
import { allLessons as lessonList } from "./lessons/journey";
import { harpStages } from "./harmonica/harp";
import type { Attempt } from "./storage";
import "./game/game.css";
import "./parents.css";

type Records = Record<string, { stars: number }>;
function read<T>(key: string, empty: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? empty;
  } catch {
    return empty;
  }
}
const day = (d: Date) => d.toISOString().slice(0, 10);
const titles = new Map<string, [string, string]>([
  ...stages.map((s) => [s.id, ["🎹", s.title]] as [string, [string, string]]),
  ...harpStages.map((s) => [s.id, ["🎵", s.title]] as [string, [string, string]]),
]);
const MODE: Record<string, string> = { "wait-mode": "آرام", "falling-notes": "با ریتم" };

/** The grown-ups' page: how the week went, what is solid, what needs another go. */
export function Parents({ attempts, onBack }: { attempts: Attempt[]; onBack: () => void }) {
  const piano = read<Records>("mahour-game", {}),
    harp = read<Records>("mahour-harp", {}),
    passed = read<string[]>("mahour-journey", []),
    days = read<string[]>("mahour-days", []);
  const week = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + k);
    return d;
  });
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = attempts.filter((a) => Date.parse(a.at) >= weekAgo);
  const minutes = Math.round(thisWeek.reduce((n, a) => n + a.seconds, 0) / 60);
  const recent = attempts.slice(-10);
  const accuracy = recent.length
    ? Math.round(recent.reduce((n, a) => n + a.accuracy, 0) / recent.length)
    : null;
  let streak = 0;
  for (const d = new Date(); days.includes(day(d)); d.setDate(d.getDate() - 1)) streak++;
  const starsOf = (r: Records) => Object.values(r).reduce((n, x) => n + (x?.stars || 0), 0);
  const won = (r: Records, ids: string[]) => ids.filter((id) => r[id]?.stars).length;
  const mastered = [
    ...new Set(stages.filter((s) => s.song && (piano[s.id]?.stars ?? 0) >= 2).map((s) => "🎹 " + s.title.split(" · ")[0])),
    ...harpStages.filter((s) => s.song && (harp[s.id]?.stars ?? 0) >= 2).map((s) => "🎵 " + s.title),
  ];
  // The latest try at each stage, if it went under 70%: that is where a slower, patient run helps.
  const latest = new Map(attempts.map((a) => [a.id, a]));
  const weak = [...latest.values()].filter((a) => a.accuracy < 70 && titles.has(a.id)).slice(-3);
  const progress: [string, number, number][] = [
    ["🎹 درس‌های پیانو", passed.length, lessonList.length],
    ["🎹 مرحله‌های پیانو", won(piano, stages.map((s) => s.id)), stages.length],
    ["🎵 مرحله‌های سازدهنی", won(harp, harpStages.map((s) => s.id)), harpStages.length],
  ];
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), attempts, piano, harp, passed, days }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mahour-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const wipe = () => {
    if (!confirm("همهٔ پیشرفت و ستاره‌ها پاک شود؟ این کار برگشت ندارد.")) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("mahour-"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    location.reload();
  };
  return (
    <div className="rhythm-game parents">
      <header className="game-header">
        <b className="logo"><i />ماهور و شهر آجری موسیقی</b>
        <button className="brick-button small back" onClick={onBack}>
          <ArrowRight /> بازگشت به آموزش کودک
        </button>
      </header>
      <main className="parents-main">
        <h1>پنل والدین</h1>
        <div className="tiles">
          <div className="tile" style={{ "--c": "#00a650" } as React.CSSProperties}>
            <small>روزهای تمرین این هفته</small>
            <b>{fa(week.filter((d) => days.includes(day(d))).length)}<em> / ۷</em></b>
            <span>هدف: ۳ روز · {streak ? `${fa(streak)} روز پشت سر هم` : "امروز هنوز نه"}</span>
          </div>
          <div className="tile" style={{ "--c": "#0a6cd6" } as React.CSSProperties}>
            <small>زمان بازی این هفته</small>
            <b>{fa(minutes)}<em> دقیقه</em></b>
            <span>{fa(thisWeek.length)} اجرا</span>
          </div>
          <div className="tile" style={{ "--c": "#ff8a00" } as React.CSSProperties}>
            <small>دقت ۱۰ اجرای اخیر</small>
            <b>{accuracy === null ? "—" : fa(accuracy) + "٪"}</b>
            <span>{accuracy === null ? "هنوز اجرایی نیست" : accuracy >= 80 ? "عالی؛ سرعت را بالا ببرید" : accuracy >= 60 ? "خوب؛ ادامه بدهید" : "سرعت را کم کنید"}</span>
          </div>
          <div className="tile" style={{ "--c": "#e3000b" } as React.CSSProperties}>
            <small>ستاره‌ها</small>
            <b>⭐ {fa(starsOf(piano) + starsOf(harp))}</b>
            <span>پیانو {fa(starsOf(piano))} · سازدهنی {fa(starsOf(harp))}</span>
          </div>
        </div>
        <section className="panel">
          <h2>این هفته</h2>
          <div className="week-days">
            {week.map((d) => (
              <div key={day(d)} className={days.includes(day(d)) ? "on" : ""}>
                <i>{days.includes(day(d)) ? "✓" : ""}</i>
                <small>{d.toLocaleDateString("fa-IR", { weekday: "short" })}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>پیشرفت</h2>
          {progress.map(([label, got, total]) => (
            <div className="bar-row" key={label}>
              <span>{label}</span>
              <div className="bar"><i style={{ width: `${(100 * got) / (total || 1)}%` }} /></div>
              <b>{fa(got)} / {fa(total)}</b>
            </div>
          ))}
        </section>
        <div className="two">
          <section className="panel">
            <h2>آهنگ‌هایی که با ریتم می‌زند</h2>
            {mastered.length ? (
              <ul className="chips">{mastered.map((m) => <li key={m}>{m}</li>)}</ul>
            ) : (
              <p>هنوز هیچ آهنگی با دو ستاره نیست.</p>
            )}
          </section>
          <section className="panel">
            <h2>نیاز به تمرین دوباره</h2>
            {weak.length ? (
              <ul className="weak">
                {weak.map((a) => (
                  <li key={a.id}>
                    {titles.get(a.id)!.join(" ")} <b>{fa(a.accuracy)}٪</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p>چیزی عقب نمانده 👌</p>
            )}
            {weak.length > 0 && <small>پیشنهاد: «آروم با من» و سرعت ۵۰٪.</small>}
          </section>
        </div>
        <section className="panel">
          <h2>اجراهای اخیر</h2>
          {attempts.length ? (
            <table>
              <thead>
                <tr><th>تاریخ</th><th>تمرین</th><th>حالت</th><th>دقت</th><th>زمان</th></tr>
              </thead>
              <tbody>
                {attempts.slice(-8).reverse().map((a) => (
                  <tr key={a.at + a.id}>
                    <td>{new Date(a.at).toLocaleDateString("fa-IR", { month: "short", day: "numeric" })}</td>
                    <td>{(titles.get(a.id) ?? ["", a.id]).join(" ")}</td>
                    <td>{MODE[a.mode] ?? a.mode}</td>
                    <td><b className={a.accuracy >= 80 ? "good" : a.accuracy < 60 ? "low" : ""}>{fa(a.accuracy)}٪</b></td>
                    <td>{fa(Math.max(1, Math.round(a.seconds / 60)))} دقیقه</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>هنوز اجرایی ثبت نشده است.</p>
          )}
        </section>
        <section className="panel tips">
          <h2>راهنمای کوتاه</h2>
          <p>روزی ۱۰ دقیقه، ۳ تا ۵ روز در هفته کافی است. کنار کودک بنشینید و آخر هر مرحله تشویقش کنید. برای سازدهنی: ساز در دست چپ، سوراخ ۱ سمت چپ، و نفس آرام — محکم فوت کردن به زبانه‌ها آسیب می‌زند.</p>
        </section>
        <section className="panel settings">
          <h2>تنظیمات</h2>
          <button className="brick-button outline" onClick={exportData}><Download /> خروجی پیشرفت (JSON)</button>
          <button className="brick-button outline" onClick={() => { clearTuning(); alert("دفعهٔ بعد بازی دوباره با پیانو آشنا می‌شود."); }}>
            <RotateCcw /> آشنایی دوباره با پیانو
          </button>
          <button className="brick-button danger" onClick={wipe}><Trash2 /> پاک کردن همهٔ پیشرفت</button>
          <small>همه‌چیز فقط روی همین دستگاه ذخیره می‌شود؛ بدون حساب کاربری.</small>
        </section>
      </main>
    </div>
  );
}
