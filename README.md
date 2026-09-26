# Mahour — Piano Kid

**[Open the app](https://mahour-piano.vercel.app)** · [Research](docs/RESEARCH.md)

A Persian / RTL piano practice web app for a seven-year-old beginner, with a progressive path toward early intermediate skills. Built with React, TypeScript and Vite; deployed to Vercel. No account, backend, analytics, external runtime CDN, or audio upload.

## Learning journey (default entry)

Twelve units, 36 lessons, ordered the way the major beginner methods (Faber, Hal Leonard, Suzuki, Kodály, Music Moves for Piano) agree: **sound before symbol**. Black-key geography and high/low → steady beat → «راه / دو-دو / وایسا / هیس» word rhythms → دو-رِ-می → playing by ear → five-finger position → reading note names → left hand → the staff with its landmark notes → skips → 3/4 and dynamics → hands taking turns and a family concert. The research behind it is kept locally, outside this public repository.

A lesson is a ~10-minute session of short activities that always ends in a real song:

- 💬 **talk**: the brick buddy explains one idea and lights it up on the keys
- 👂 **ear**: bird or bear (high/low), lion or mouse (loud/soft), up/down/same
- 🔍 **find**: every two-black-key group, every «دو», across three octaves
- 🔁 **echo**: the buddy plays a short tune, the child plays it back; after a miss the next key glows
- 🥁 **rhythm**: the buddy drums a word rhythm after a count-in, the child taps it back on a drum pad
- 🔤 **read**: a note name or a note on the staff, played on unlabeled keys
- 🎸 **jam**: free improvisation on the black keys (or C pentatonic) over a band
- 🎵 **song**: listen → wait mode → rhythm, with a choice of songs on review steps

Every song gets an automatic **band** (bass, chords, hi-hat, count-in) from a harmonizer that picks chords from the melody's own key (`src/lessons/harmony.ts`); it can be switched off. In wait mode each correct note is answered by its chord. A failed rhythm run lowers the speed one step by itself. Stars mark skills, not time; the weekly goal is a forgiving 3 days of 7 with no streak to lose; the parent box says which songs the child can now play.

The Songs tab opens all 26 songs (9 of them black-key, left-hand and original pieces written for this app) in parts; «تمرین آزاد» keeps the earlier numbered drills.

## Falling-notes game

A toy-brick world ("ماهور و شهر آجری موسیقی"). Notes are coloured bricks (دو red, رِ orange, می yellow, فا green, سل blue, لا purple, سی pink; a black key wears its lower neighbour's colour) that slide down a 3D road onto a 3D piano whose keys carry the same coloured number stickers. Brick length is note length.

Every stage is learnt in three steps, picked on the stage card:

1. **👂 گوش بده** — the piano plays the stage by itself while the bricks fall and the keys light up. Nothing is scored.
2. **🐢 آروم با من** (wait mode) — each brick stops on the yellow line, and its key glows, until the right key is played. Nothing can be missed; a wrong key is just a hint. Finishing earns the first star, which unlocks the next stage.
3. **⚡ با ریتم** — timed play at 50/65/80/100% speed. 60/80/95% timed hits earn one/two/three stars.

The home screen has a continue button, the learning path grouped by world, and a Songs tab where every song opens directly as parts → halves → whole → concert tempo, whatever the path progress. Every star is one brick in the child's tower. Touch piano is the default input: no microphone, calibration or MIDI needed. A/S/D/F/G/H/J/K/L/; also play the white keys.

The optional “کیبورد واقعی · میکروفون” input retains physical-keyboard tuning and listening. It requests audio permission only when that mode is selected and started.

91 automated tests cover DSP, timing, progression, touch release, simultaneous notes, chord exercises, permission separation and stored input provenance. Chromium tablet layout and pointer interactions were checked; physical tablet audio and touch behavior still need device verification.

## Harmonica (C diatonic)

A second instrument in the same brick world, switched with the «پیانو / سازدهنی» tabs. A standard 10-hole C harmonica in Richter tuning (hole 1 blow = middle C). Bricks fall into ten lanes, one per hole; blue means **blow** (فوت), orange means **draw** (مک). The harmonica at the bottom is drawn the way the child sees it: numbers up, hole 1 on the left, held in the left hand with the right hand cupped behind; the brick robot demonstrates the same grip.

Five breathing drills in holes 4–7 (the octave with a full C major scale), then every library song that fits the harmonica an octave up (16 songs, tab generated from the melody in `src/harmonica/harp.ts`). The same listen / wait / rhythm modes and stars as the piano.

The microphone listens in a separate *pitched* mode: a harmonica holds one steady tone, so YIN ("which note is sounding?") reports each note once when it starts, and a breath dip between two equal notes counts as a new note. A pitch no single hole makes (usually two holes at once) gets the hint to pucker. Octaves count as wrong, since they are different holes. Touch mode offers blow/draw pads per hole.

## Parent panel

«بخش والدین» opens a panel in the same theme: practice days this week and the streak, minutes played, accuracy of the last ten runs, stars per instrument, progress bars (piano lessons, piano stages, harmonica stages), songs played in rhythm with two stars, stages whose latest try was under 70%, the last eight runs, and settings (JSON export, re-learn the piano, erase progress). «بازگشت به آموزش کودک» returns to the instrument the child was on.

## Features

- Game stages across eighteen worlds, from two-note drills to whole pieces at real tempo; each song is learned as short parts, then halves, then the whole. The falling-note keyboard starts at middle C and widens to whatever a stage needs, including black keys.
- Adding a melody is one entry in `src/curriculum.ts`: `song(id, level, title, subtitle, [midi...], [beats...], credit)`. Only public-domain or traditional music is included here; anything still in copyright is for you to add to your own copy.
- Temporary key numbers → solfège names → treble/bass notation. Key numbers and finger numbers are explicitly distinguished.
- Web Audio microphone input: onset (harmonic-rise) detection for piano, YIN for harmonica; adaptive noise floor and sensitivity.
- Local progress and JSON export from the parent panel.
- Locally bundled Vazirmatn fonts and local synthesized audio.

## Run

Node.js 22.22+ recommended.

```sh
npm ci
npm run dev
npm test
npm run test:ui
npm run build
```

`vercel --prod` deploys the static `dist` build. `vercel.json` contains deployment and privacy-related response headers. No environment variables are required.

## Important boundaries

This is a practice companion, not a qualified teacher or an ABRSM qualification. Stage six introduces early intermediate skills; it is not a complete intermediate conservatory syllabus. A parent/teacher should check posture, fingering, relaxation, articulation, dynamics, sustain, pedaling and musical expression.

Microphone recognition is **single note only**, susceptible to acoustic piano harmonics, octave errors, background sound and pedal resonance. Release repeated notes clearly. USB MIDI is preferable for reliable key identity and is required for simultaneous exercises. Browser support varies. Audio stays in memory on the device and is never recorded/uploaded by the app. A real acoustic piano and physical MIDI device have not been available during automated validation; synthetic signals and mocked browser inputs are tested.

Rhythm score measures note **onsets**, not note duration or release. The app waits for correct notes even in rhythm mode; late notes continue to count as late relative to the original count-in. Wrong notes increase the denominator of note accuracy; no skipped-note or automatic timing-out behavior is implied. Completed lessons use >=80% pitch accuracy, not an independently validated mastery metric. MIDI group detection checks note-on co-occurrence, not held/released-key correctness.

Progress is local to one browser, capped at the latest 1,000 attempts. Clearing site data deletes it. JSON export is readable archival data, not a cross-device sync/import feature. Do not commit exported progress to this public repository.

## Curriculum and research

See [research and design decisions](docs/RESEARCH.md), [implementation plan and validation](docs/PLAN.md) and the parent panel. All lesson instructions and arrangements are independently authored; proprietary method-book pages/audio are not included. The repertoire is traditional or based on old compositions; excerpt labels distinguish incomplete pieces. Generated sound is a simple additive synthesizer, not a sampled acoustic piano.

## Code map

- `src/curriculum.ts`: lesson and repertoire data, pitches, beat lengths.
- `src/pitch.ts`: isolated testable YIN estimator.
- `src/audio.ts`: synthesized demonstration and metronome.
- `src/Staff.tsx`: functional staff renderer for the supported notation subset.
- `src/main.tsx`: switches between piano game, harmonica game and parent panel.
- `src/game/`: piano falling-notes game; `src/lessons/`: the learning journey.
- `src/harmonica/`: harmonica layout, stages and game.
- `src/Parents.tsx`: parent panel.
- `src/storage.ts`: local report persistence.

MIT license for original application code and original instructional prose. The bundled font and dependencies retain their own licenses.
