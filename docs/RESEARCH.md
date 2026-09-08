# Research and teaching design

Reviewed 2026-09-08. This is a practical literature-informed design, not a controlled clinical or educational efficacy claim.

## Primary sources

1. [Faber Piano Adventures: parent FAQs](https://pianoadventures.com/piano-books/basic-faqs/parents/) — parent participation and support in early learning. The app uses a supportive parent role, short demonstrations and small exercises. No proprietary lesson pages, compositions or recordings are copied.
2. [Faber: young beginner sample lesson plan](https://pianoadventures.com/wp-content/uploads/sites/2/2016/03/90010127-MFPALessonPlan.pdf) — auditory, visual and movement-oriented activities. This source concerns younger beginners; the present design adapts the multimodal principle for age seven rather than claiming the curriculum is validated for this child.
3. [ABRSM: Practical Grades](https://www.abrsm.org/en-us/about-practical-grades) — a balanced program includes repertoire, technical work, sight-reading and aural work. The six stages include these strands in an original simplified sequence, without claiming equivalence to an exam grade.
4. [de Cheveigné & Kawahara, YIN, JASA 2002](https://pubmed.ncbi.nlm.nih.gov/12002874/) — the cumulative mean normalized difference method provides a basis for fundamental-frequency estimation. The implementation uses a 0.13 threshold, parabolic interpolation, silence gating and stable frames. It is not polyphonic transcription.
5. [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — secure context and explicit device permission are required. Access starts from the practice button and stops on practice stop, completion, navigation and page hiding.
6. [MDN: Web MIDI](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) — limited browser support and permission requirements. Feature detection and fallback instructions are provided. No SysEx is requested.

## Original design decisions / assumptions

- Seven-year-old learner, an adult nearby, an acoustic or digital piano, no prior reading ability assumed beyond short Persian instructions with adult assistance.
- Suggested ten-minute routine is a flexible product choice, not a scientific threshold. Stop or shorten based on attention and comfort.
- Label only C4–C5 white keys temporarily. Numbers 1–8 indicate specific keys, never fingering. Speak names alongside numbers and fade labels in stage three. Permanent number dependency is deliberately discouraged.
- Progression: location and exploratory playing → patterns and pulse → names and octave → treble/bass reading and durations → left hand and simultaneous MIDI drills → scales, broken chords, triads and accompanied melody.
- Short chunking, demonstration, attempts without a countdown pressure, supportive correction, and a parallel rhythm mode are intended to encourage practice. No claim of guaranteed speed or educational efficacy.
- Reported scores are descriptive measurements of this exercise, not a judgment of the child's talent. 80% completion and timing tolerance are adjustable product heuristics.
- All stages remain accessible for a parent to select appropriate material. Progress is advisory; no rigid week-based unlock or fixed deadline.

## Path toward intermediate playing

The shipped six stages introduce early intermediate building blocks. Continue repeated practice across weeks/months as needed: hands separate before together, unnumbered reading, steady pulse, relaxed movement, C major / A minor, I–IV–V–I triads, and simple melody-plus-bass coordination. A teacher should extend repertoire, sight-reading, multiple keys, inversions, articulation, dynamics and pedaling before calling the learner solidly intermediate.

## Technical and environmental decisions

- Static Vite build deployed to Vercel because that host was explicitly requested; no Cloudflare/Sites runtime or extra hosting account needed.
- No AI API call is needed for detecting a single pitch. Local DSP reduces latency, network dependence and unnecessary disclosure of a child's audio.
- Fonts and application assets are hosted on the same domain. No Google Fonts, sound-sample CDN or remote audio endpoint is used. Iran-specific domain reachability still depends on network/VPN conditions; a custom reachable domain can be configured later.
- Synthesized piano-like examples are deterministic and lightweight. They are teaching pitch/rhythm references, not acoustic piano timbre models.
- Acoustic accuracy has not been validated on the user's piano. Real device calibration/testing remains necessary before trusting a microphone result.

## Notation subset

The renderer supports sharp pitch spelling, separate treble/bass staves as needed, ledger lines, stemmed noteheads, half/whole notes, dotted values, eighth/sixteenth flags, and simultaneous note groups. This is an instructional pitch/duration display, not engraved publication sheet music: barlines, time signatures, rests, beaming, key signatures, fingering annotations and sustain notation are not fully implemented. Instructions explain the duration shown. Familiar melodies are simplified or explicitly labeled as excerpts.
