/**
 * The learning journey: twelve units in the order the major beginner methods agree on — sound
 * before symbol. Black-key geography and high/low first, then steady beat and word rhythms,
 * white-key names, rote songs by ear, off-staff reading, Middle C position, the staff with its
 * landmark notes, and finally the hands taking turns. Every lesson is a ten-minute session of
 * short activities that always ends in a real song with the band playing along.
 * See reports/ for the research behind the order.
 */
import type { Mode } from "../game/engine.ts";
export type Activity =
  /** The buddy explains one new idea and shows it on the keys. */
  | { kind: "talk"; text: string; keys?: number[] }
  /** Free play over a groove; on the black keys nothing can sound wrong. */
  | { kind: "jam"; keys: "black" | "white-penta" | "all"; seconds: number; text: string }
  /** Listening: which is higher, louder, or where the tune goes. */
  | { kind: "ear"; game: "highlow" | "loudsoft" | "updown"; rounds: number }
  /** Find every key of a kind across three octaves. */
  | { kind: "find"; target: "two" | "three" | number; text: string }
  /** The buddy plays a short tune, the child plays it back. */
  | { kind: "echo"; patterns: number[][]; text?: string }
  /** The buddy drums a rhythm, the child taps it back. q=راه e=دو-دو (in pairs) h=وایسا r=هیس */
  | { kind: "rhythm"; patterns: string[]; bpm: number }
  /** Read a note — by name, or on the staff — and play it. */
  | { kind: "read"; notes: number[]; staff?: boolean; text: string }
  /** A real song, in one of the three game modes; several ids let the child choose. */
  | { kind: "song"; songs: string[]; mode: Mode; review?: boolean };
export type Lesson = {
  id: string;
  title: string;
  /** What the child can do after this lesson, said as a skill, not as a score. */
  skill: string;
  activities: Activity[];
};
export type Unit = { title: string; icon: string; lessons: Lesson[] };

// Black keys in the octave above middle C, the two-group and the three-group.
const TWO = [61, 63],
  THREE = [66, 68, 70];
const C = 60,
  D = 62,
  E = 64,
  F = 65,
  G = 67,
  A = 69,
  B = 71;

export const units: Unit[] = [
  {
    title: "پرنده و خرس",
    icon: "🐦",
    lessons: [
      {
        id: "u1-l1",
        title: "صدای زیر، صدای بم",
        skill: "صدای زیر و بم را از هم تشخیص می‌دهی",
        activities: [
          { kind: "talk", text: "سلام ماهور! پیانو یک طرفش پرنده دارد و یک طرفش خرس. سمت راست صداها زیرند، مثل جیک‌جیک پرنده. سمت چپ صداها بم‌اند، مثل خُرخُر خرس.", keys: [48, 84] },
          { kind: "ear", game: "highlow", rounds: 5 },
          { kind: "jam", keys: "black", seconds: 35, text: "هر کلید سیاهی دوست داری بزن. بالا مثل پرنده، پایین مثل خرس. هیچ صدایی اشتباه نیست!" },
          { kind: "song", songs: ["bk-bear"], mode: "listen" },
          { kind: "song", songs: ["bk-bear"], mode: "learn" },
        ],
      },
      {
        id: "u1-l2",
        title: "دوقلوهای سیاه",
        skill: "همهٔ گروه‌های دوتایی کلید سیاه را پیدا می‌کنی",
        activities: [
          { kind: "talk", text: "کلیدهای سیاه دوتا دوتا و سه‌تا سه‌تا کنار هم‌اند. دوتایی‌ها مثل دوقلوها هستند.", keys: TWO },
          { kind: "find", target: "two", text: "همهٔ دوقلوها را پیدا کن!" },
          { kind: "echo", patterns: [[63, 61], [61, 63], [63, 63, 61]], text: "من می‌زنم، تو همان را بزن" },
          { kind: "song", songs: ["bk-bear"], mode: "rhythm" },
        ],
      },
      {
        id: "u1-l3",
        title: "سه‌قلوها و کلاغ‌ها",
        skill: "یک آهنگ کامل روی سه کلید سیاه می‌زنی",
        activities: [
          { kind: "find", target: "three", text: "حالا همهٔ سه‌قلوها را پیدا کن!" },
          { kind: "echo", patterns: [[70, 68, 66], [66, 68, 70], [70, 68, 66, 66]] },
          { kind: "song", songs: ["bk-crows"], mode: "listen" },
          { kind: "song", songs: ["bk-crows"], mode: "learn" },
          { kind: "song", songs: ["bk-crows"], mode: "rhythm" },
        ],
      },
    ],
  },
  {
    title: "ضرب و قدم",
    icon: "🥁",
    lessons: [
      {
        id: "u2-l1",
        title: "قلب موسیقی",
        skill: "با ضرب ثابت همراهی می‌کنی",
        activities: [
          { kind: "talk", text: "هر آهنگی یک قلب دارد که تاپ‌تاپ می‌زند. به آن «ضرب» می‌گوییم. هر ضرب یک قدم است: «راه».", keys: [] },
          { kind: "rhythm", patterns: ["qqqq", "qqqq", "qqqq"], bpm: 80 },
          { kind: "ear", game: "loudsoft", rounds: 4 },
          { kind: "song", songs: ["bk-crows"], mode: "rhythm" },
        ],
      },
      {
        id: "u2-l2",
        title: "انگشت‌های شماره‌دار",
        skill: "شمارهٔ انگشت‌هایت را می‌دانی",
        activities: [
          { kind: "talk", text: "انگشت‌هایت هم شماره دارند: شست ۱، اشاره ۲، وسطی ۳، حلقه ۴، کوچک ۵. برای کلاغ‌ها انگشت ۲، ۳ و ۴ روی سه‌قلوها می‌نشینند.", keys: THREE },
          { kind: "echo", patterns: [[66, 68, 70], [70, 70, 68, 66], [68, 66, 68, 70]] },
          { kind: "song", songs: ["bk-mary"], mode: "listen" },
          { kind: "song", songs: ["bk-mary"], mode: "learn" },
        ],
      },
      {
        id: "u2-l3",
        title: "باران",
        skill: "با گروه آهنگ باران را می‌زنی",
        activities: [
          { kind: "jam", keys: "black", seconds: 30, text: "قطره‌های باران را بساز: آرام از بالا به پایین بیا." },
          { kind: "rhythm", patterns: ["qqqq", "qqh", "hh"], bpm: 80 },
          { kind: "song", songs: ["bk-mary", "bk-rain"], mode: "rhythm" },
        ],
      },
    ],
  },
  {
    title: "راه و دو-دو",
    icon: "👟",
    lessons: [
      {
        id: "u3-l1",
        title: "راه رفتن و دویدن",
        skill: "«راه» و «دو-دو» را می‌شنوی و می‌زنی",
        activities: [
          { kind: "talk", text: "«راه» یعنی یک قدم آرام. «دو-دو» یعنی دو قدم تند توی همان یک ضرب، مثل وقتی می‌دوی!" },
          { kind: "rhythm", patterns: ["qqqq", "eeq", "qeeq", "eeee"], bpm: 72 },
          { kind: "song", songs: ["bk-rain"], mode: "learn" },
          { kind: "song", songs: ["bk-rain"], mode: "rhythm" },
        ],
      },
      {
        id: "u3-l2",
        title: "اسم خودم",
        skill: "ریتم کلمه‌ها را می‌زنی",
        activities: [
          { kind: "talk", text: "کلمه‌ها هم ریتم دارند! «ما-هور» یک «دو-دو» است. «پی-یا-نو» یعنی دو-دو، راه." },
          { kind: "rhythm", patterns: ["eeqq", "eeeeq", "qqee", "eeqeeq"], bpm: 72 },
          { kind: "jam", keys: "black", seconds: 30, text: "با «دو-دو» و «راه» روی کلیدهای سیاه آهنگ بساز." },
          { kind: "song", songs: ["bk-crows", "bk-mary", "bk-rain"], mode: "rhythm", review: true },
        ],
      },
      {
        id: "u3-l3",
        title: "وایسا و هیس",
        skill: "صدای کشیده و سکوت را نگه می‌داری",
        activities: [
          { kind: "talk", text: "«وایسا» یعنی کلید را دو ضرب نگه دار. «هیس» یعنی یک ضرب سکوت — سکوت هم بخشی از موسیقی است!" },
          { kind: "rhythm", patterns: ["qqh", "hqq", "qrqr", "eeqh"], bpm: 72 },
          { kind: "song", songs: ["bk-bear", "bk-crows"], mode: "rhythm", review: true },
        ],
      },
    ],
  },
  {
    title: "دو، رِ، می",
    icon: "🔴",
    lessons: [
      {
        id: "u4-l1",
        title: "دو، خانهٔ پیانو",
        skill: "همهٔ «دو»ها را پیدا می‌کنی",
        activities: [
          { kind: "talk", text: "«دو» همیشه سمت چپ دوقلوهای سیاه است. قرمز است، مثل آجر اول!", keys: [C] },
          { kind: "find", target: 0, text: "همهٔ «دو»های پیانو را پیدا کن!" },
          { kind: "echo", patterns: [[C, C], [C, D, C], [D, C, D]] },
          { kind: "song", songs: ["march"], mode: "listen" },
          { kind: "song", songs: ["march"], mode: "learn" },
        ],
      },
      {
        id: "u4-l2",
        title: "رِ و می",
        skill: "دو، رِ و می را پیدا می‌کنی و می‌زنی",
        activities: [
          { kind: "talk", text: "«رِ» وسط دوقلوها است و «می» سمت راستشان. دو-رِ-می مثل سه پله است.", keys: [C, D, E] },
          { kind: "find", target: 4, text: "همهٔ «می»ها را پیدا کن!" },
          { kind: "echo", patterns: [[C, D, E], [E, D, C], [E, E, D, D, C]] },
          { kind: "song", songs: ["march"], mode: "rhythm" },
        ],
      },
      {
        id: "u4-l3",
        title: "نان‌های داغ",
        skill: "اولین آهنگ روی کلیدهای سفید را می‌زنی",
        activities: [
          { kind: "rhythm", patterns: ["qqh", "eeeeh"], bpm: 76 },
          { kind: "song", songs: ["hot-cross"], mode: "listen" },
          { kind: "song", songs: ["hot-cross"], mode: "learn" },
          { kind: "song", songs: ["hot-cross"], mode: "rhythm" },
        ],
      },
      {
        id: "u4-l4",
        title: "زنگ مدرسه",
        skill: "«دو-دو» را روی کلیدها می‌زنی",
        activities: [
          { kind: "echo", patterns: [[E, E, D, D, C], [C, D, E, E], [E, D, C, C]] },
          { kind: "song", songs: ["bell"], mode: "learn" },
          { kind: "song", songs: ["bell", "hot-cross"], mode: "rhythm" },
          { kind: "song", songs: ["bk-mary", "bk-rain", "march"], mode: "rhythm", review: true },
        ],
      },
    ],
  },
  {
    title: "با گوش بزن",
    icon: "👂",
    lessons: [
      {
        id: "u5-l1",
        title: "آهنگی که بلدی",
        skill: "یک آهنگ آشنا را با گوش پیدا می‌کنی",
        activities: [
          { kind: "ear", game: "updown", rounds: 5 },
          { kind: "echo", patterns: [[E, D, C, D, E, E, E], [D, D, D], [E, G, G]] },
          { kind: "song", songs: ["mary"], mode: "learn" },
          { kind: "song", songs: ["mary"], mode: "rhythm" },
        ],
      },
      {
        id: "u5-l2",
        title: "زیر نور ماه",
        skill: "زیر نور ماه را با گروه می‌زنی",
        activities: [
          { kind: "echo", patterns: [[C, C, C, D, E], [D, C, E, D, D, C]] },
          { kind: "song", songs: ["moon"], mode: "listen" },
          { kind: "song", songs: ["moon"], mode: "learn" },
          { kind: "song", songs: ["moon"], mode: "rhythm" },
        ],
      },
      {
        id: "u5-l3",
        title: "بداهه روی سفیدها",
        skill: "روی پنج کلید سفید آهنگ خودت را می‌سازی",
        activities: [
          { kind: "jam", keys: "white-penta", seconds: 40, text: "دو، رِ، می، سُل، لا — این پنج کلید با هم دوست‌اند. آهنگ خودت را بساز!" },
          { kind: "song", songs: ["mary", "moon", "hot-cross"], mode: "rhythm", review: true },
        ],
      },
    ],
  },
  {
    title: "پنج انگشت",
    icon: "✋",
    lessons: [
      {
        id: "u6-l1",
        title: "فا و سُل",
        skill: "پنج کلید دو تا سُل را می‌شناسی",
        activities: [
          { kind: "talk", text: "«فا» سمت چپ سه‌قلوها است و «سُل» کنارش. حالا پنج انگشتت روی دو، رِ، می، فا، سُل می‌نشینند.", keys: [C, D, E, F, G] },
          { kind: "find", target: 5, text: "همهٔ «فا»ها را پیدا کن!" },
          { kind: "echo", patterns: [[C, D, E, F, G], [G, F, E, D, C], [C, E, G]] },
          { kind: "song", songs: ["lightly"], mode: "listen" },
          { kind: "song", songs: ["lightly"], mode: "learn" },
        ],
      },
      {
        id: "u6-l2",
        title: "هانس کوچولو",
        skill: "با پنج انگشت یک آهنگ کامل می‌زنی",
        activities: [
          { kind: "rhythm", patterns: ["qqh", "qqqq", "qqqqh"], bpm: 80 },
          { kind: "song", songs: ["lightly"], mode: "rhythm" },
          { kind: "song", songs: ["march", "bell", "moon"], mode: "rhythm", review: true },
        ],
      },
      {
        id: "u6-l3",
        title: "سرود شادی",
        skill: "تم بتهوون را می‌زنی",
        activities: [
          { kind: "echo", patterns: [[E, E, F, G], [G, F, E, D], [C, C, D, E], [E, D, D]] },
          { kind: "song", songs: ["ode"], mode: "listen" },
          { kind: "song", songs: ["ode"], mode: "learn" },
          { kind: "song", songs: ["ode"], mode: "rhythm" },
        ],
      },
    ],
  },
  {
    title: "نت‌خوانی بدون خط",
    icon: "🔤",
    lessons: [
      {
        id: "u7-l1",
        title: "اسم نت را بخوان",
        skill: "نت را از روی اسمش پیدا می‌کنی",
        activities: [
          { kind: "read", notes: [C, D, E, C, E, D, C, E], text: "اسم نت را بخوان و کلیدش را بزن" },
          { kind: "ear", game: "updown", rounds: 5 },
          { kind: "song", songs: ["twinkle"], mode: "listen" },
          { kind: "song", songs: ["twinkle"], mode: "learn" },
        ],
      },
      {
        id: "u7-l2",
        title: "بالا، پایین، تکرار",
        skill: "جهت آهنگ را می‌بینی و می‌شنوی",
        activities: [
          { kind: "read", notes: [C, D, E, F, G, F, E, D, G, E, C], text: "اسم نت را بخوان و کلیدش را بزن" },
          { kind: "echo", patterns: [[C, C, G, G], [A, A, G], [F, F, E, E, D, D, C]] },
          { kind: "song", songs: ["twinkle"], mode: "rhythm" },
        ],
      },
      {
        id: "u7-l3",
        title: "پل لندن",
        skill: "یک آهنگ با پرش را می‌خوانی و می‌زنی",
        activities: [
          { kind: "read", notes: [G, A, G, F, E, F, G, D, E, F], text: "نت‌های پل لندن را بخوان" },
          { kind: "song", songs: ["london"], mode: "learn" },
          { kind: "song", songs: ["london", "lightly", "ode"], mode: "rhythm", review: true },
        ],
      },
    ],
  },
  {
    title: "دست چپ",
    icon: "🤚",
    lessons: [
      {
        id: "u8-l1",
        title: "دو شست روی دو",
        skill: "دست چپ را در موقعیت دوی وسط می‌گذاری",
        activities: [
          { kind: "talk", text: "هر دو شست روی «دوی وسط» می‌نشینند. دست چپ از دو پایین می‌رود: دو، سی، لا، سُل، فا.", keys: [53, 55, 57, 59, 60] },
          { kind: "echo", patterns: [[60, 59, 57], [57, 55, 53], [53, 55, 57, 59, 60]], text: "با دست چپ همان را بزن" },
          { kind: "song", songs: ["bear-walk"], mode: "listen" },
          { kind: "song", songs: ["bear-walk"], mode: "learn" },
        ],
      },
      {
        id: "u8-l2",
        title: "قدم‌های خرس",
        skill: "با دست چپ یک آهنگ کامل می‌زنی",
        activities: [
          { kind: "ear", game: "highlow", rounds: 4 },
          { kind: "song", songs: ["bear-walk"], mode: "rhythm" },
          { kind: "song", songs: ["twinkle", "london", "moon"], mode: "rhythm", review: true },
        ],
      },
      {
        id: "u8-l3",
        title: "برادر ژاک",
        skill: "آهنگی با نت‌های تند می‌زنی",
        activities: [
          { kind: "rhythm", patterns: ["qqqq", "qqh", "eeeeqq"], bpm: 80 },
          { kind: "song", songs: ["frere"], mode: "learn" },
          { kind: "song", songs: ["frere"], mode: "rhythm" },
        ],
      },
    ],
  },
  {
    title: "خطوط حامل",
    icon: "🎼",
    lessons: [
      {
        id: "u9-l1",
        title: "دوی وسط روی حامل",
        skill: "دو، رِ و می را روی حامل می‌خوانی",
        activities: [
          { kind: "talk", text: "نت‌ها روی پنج خط زندگی می‌کنند. «دوی وسط» یک خط کوچولوی مخصوص زیر حامل دارد.", keys: [C] },
          { kind: "read", notes: [C, D, E, D, C, E, C, D], staff: true, text: "نت روی حامل را بزن" },
          { kind: "song", songs: ["hot-cross", "march"], mode: "rhythm", review: true },
        ],
      },
      {
        id: "u9-l2",
        title: "نشانهٔ سُل",
        skill: "سُل را روی حامل پیدا می‌کنی",
        activities: [
          { kind: "talk", text: "کلید سُل (𝄞) دور خط دوم می‌پیچد؛ هر نتی روی آن خط «سُل» است.", keys: [G] },
          { kind: "read", notes: [G, E, G, C, F, G, D, G, A], staff: true, text: "نت روی حامل را بزن" },
          { kind: "song", songs: ["saints"], mode: "learn" },
          { kind: "song", songs: ["saints"], mode: "rhythm" },
        ],
      },
      {
        id: "u9-l3",
        title: "نشانهٔ فا",
        skill: "نت‌های دست چپ را روی حامل بم می‌خوانی",
        activities: [
          { kind: "talk", text: "کلید فا (𝄢) دو نقطه دارد که دور خط «فا» را می‌گیرند. این حامل دست چپ است.", keys: [53] },
          { kind: "read", notes: [53, 55, 57, 53, 59, 60, 55], staff: true, text: "نت روی حامل بم را بزن" },
          { kind: "song", songs: ["bear-walk", "row", "farm"], mode: "rhythm", review: true },
        ],
      },
    ],
  },
  {
    title: "پرش‌ها",
    icon: "🦘",
    lessons: [
      {
        id: "u10-l1",
        title: "پله و پرش",
        skill: "پله و پرش را می‌شنوی و می‌خوانی",
        activities: [
          { kind: "talk", text: "وقتی نت به کلید کناری می‌رود «پله» است. وقتی یک کلید را جا می‌اندازد «پرش» است: دو-می، می-سُل.", keys: [C, E, G] },
          { kind: "echo", patterns: [[C, E, G], [G, E, C], [C, E, D, F, E, G]] },
          { kind: "read", notes: [C, E, G, E, D, F, E, G, C], staff: true, text: "پرش‌ها را روی حامل بخوان" },
          { kind: "song", songs: ["row"], mode: "learn" },
        ],
      },
      {
        id: "u10-l2",
        title: "پارو بزن",
        skill: "آهنگی با پرش بلند می‌زنی",
        activities: [
          { kind: "song", songs: ["row"], mode: "rhythm" },
          { kind: "song", songs: ["farm"], mode: "learn" },
          { kind: "song", songs: ["farm", "saints", "frere"], mode: "rhythm", review: true },
        ],
      },
    ],
  },
  {
    title: "والس و تولد",
    icon: "🎂",
    lessons: [
      {
        id: "u11-l1",
        title: "یک-دو-سه",
        skill: "ضرب سه‌تایی والس را حس می‌کنی",
        activities: [
          { kind: "talk", text: "والس سه‌تا سه‌تا می‌رقصد: یک-دو-سه، یک-دو-سه. ضرب «یک» از همه محکم‌تر است." },
          { kind: "rhythm", patterns: ["hq", "qqq", "hq"], bpm: 88 },
          { kind: "song", songs: ["waltz"], mode: "listen" },
          { kind: "song", songs: ["waltz"], mode: "learn" },
          { kind: "song", songs: ["waltz"], mode: "rhythm" },
        ],
      },
      {
        id: "u11-l2",
        title: "تولدت مبارک",
        skill: "برای تولد خانواده آهنگ می‌زنی",
        activities: [
          { kind: "echo", patterns: [[G, G, A, G], [72, B], [G, G, A, G, 74, 72]] },
          { kind: "song", songs: ["birthday"], mode: "learn" },
          { kind: "song", songs: ["birthday"], mode: "rhythm" },
        ],
      },
      {
        id: "u11-l3",
        title: "زنگوله‌ها",
        skill: "یک آهنگ شاد کامل را با گروه اجرا می‌کنی",
        activities: [
          { kind: "song", songs: ["jingle"], mode: "learn" },
          { kind: "song", songs: ["jingle", "waltz", "birthday"], mode: "rhythm", review: true },
        ],
      },
    ],
  },
  {
    title: "دو دست و کنسرت",
    icon: "🎤",
    lessons: [
      {
        id: "u12-l1",
        title: "دست‌ها نوبتی",
        skill: "دو دستت را نوبتی می‌زنی",
        activities: [
          { kind: "talk", text: "حالا دست راست بالا می‌رود و دست چپ پایین — نوبتی، مثل گفت‌وگو.", keys: [53, 60, 67] },
          { kind: "echo", patterns: [[60, 62, 64, 65, 67], [60, 59, 57, 55, 53]] },
          { kind: "song", songs: ["stairs"], mode: "learn" },
          { kind: "song", songs: ["stairs"], mode: "rhythm" },
        ],
      },
      {
        id: "u12-l2",
        title: "سرنوشت و زنگ‌ها",
        skill: "اولین کلید سیاه را در آهنگ‌های کلاسیک می‌زنی",
        activities: [
          { kind: "song", songs: ["fate"], mode: "listen" },
          { kind: "song", songs: ["fate"], mode: "learn" },
          { kind: "song", songs: ["fate", "bells"], mode: "rhythm" },
        ],
      },
      {
        id: "u12-l3",
        title: "برای الیزه",
        skill: "آغاز «برای الیزه» را می‌زنی",
        activities: [
          { kind: "echo", patterns: [[76, 75, 76, 75, 76], [71, 74, 72, 69]] },
          { kind: "song", songs: ["fur-elise"], mode: "learn" },
          { kind: "song", songs: ["fur-elise"], mode: "rhythm" },
        ],
      },
      {
        id: "u12-l4",
        title: "کنسرت بزرگ",
        skill: "برای خانواده کنسرت می‌دهی!",
        activities: [
          { kind: "talk", text: "امروز روز کنسرت است! خانواده را صدا کن. سه آهنگ که از همه بیشتر دوست داری را انتخاب کن." },
          { kind: "song", songs: ["ode", "twinkle", "birthday", "jingle", "fur-elise"], mode: "rhythm", review: true },
          { kind: "song", songs: ["waltz", "saints", "london", "row"], mode: "rhythm", review: true },
          { kind: "song", songs: ["stairs", "frere", "farm", "moon"], mode: "rhythm", review: true },
        ],
      },
    ],
  },
];
export const allLessons = units.flatMap((u, ui) => u.lessons.map((l) => ({ ...l, unit: ui })));
