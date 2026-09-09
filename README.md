# Mahour — Piano Kid

**[Open the app](https://mahour-piano.vercel.app)** · [Research](docs/RESEARCH.md)

A Persian / RTL piano practice web app for a seven-year-old beginner, with a progressive path toward early intermediate skills. Built with React, TypeScript and Vite; deployed to Vercel. No account, backend, analytics, external runtime CDN, or audio upload.

## Rhythm game (default entry)

Select the first square on the stage map. Every stage activates the microphone and displays its live level and detected pitch. Play the labeled C key once to verify input; only then does the game start button enable. Numbers fall toward the gold line: play the matching physical key when they arrive. Correct timed notes turn the surface green; wrong, early, late or missed notes turn it red. Earn at least 60% timed hits to unlock the next stage. Best scores and stars persist locally. Browser permission may already be granted; the app cannot force a new browser prompt.

42 automated tests cover DSP, permission ordering, input processing, timing, progression and UI. Physical keyboard and tablet behavior still need device verification.

## Tablet above a small keyboard

Choose the prominent tablet card on the home page. With an adult, locate a C key with eight white keys available to its right, play it three times with releases, and confirm the displayed octave before placing 1–8 labels. The app speaks bundled Persian prompts, highlights one large number, and listens to the physical keyboard. Seven beginner items fit the numbered range; use the general studio for the later curriculum.

The tablet supports a base of C3, C4 or C5 and transposes its examples and expected pitches accordingly. This setting does not transpose the separate advanced studio. A held note is not intentionally counted repeatedly. Ambiguous sound is unscored. Test with your actual keyboard before relying on its assessment.

See [custom generated assets and exact prompts](docs/GENERATED_ASSETS.md).

## Features

- Six stages, 22 guided exercises and eight independently entered educational melody arrangements.
- Temporary key numbers → solfège names → treble/bass notation. Key numbers and finger numbers are explicitly distinguished.
- Synthesized demonstrations, section practice, adjustable tempo, metronome and forgiving note-by-note progression.
- Web Audio microphone input with YIN monophonic pitch detection. Silence gating, confidence threshold, stable frames and repeat-note gating.
- Web MIDI note-on input; simultaneous groups supported within a 220 ms window. MIDI-only exercises cover two hands, triads and a simple accompanied Ode to Joy excerpt.
- Separate note accuracy and onset timing scores. Onset scoring uses a four-beat count-in and a tolerance of max(180 ms, 30% of a beat).
- Local progress, completed-versus-section distinction, input-source labeling, JSON report export, printable key labels and parent guide.
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

See [research and design decisions](docs/RESEARCH.md), [implementation plan and validation](docs/PLAN.md) and the in-app parent guide. All lesson instructions and arrangements are independently authored; proprietary method-book pages/audio are not included. The repertoire is traditional or based on old compositions; excerpt labels distinguish incomplete pieces. Generated sound is a simple additive synthesizer, not a sampled acoustic piano.

## Code map

- `src/curriculum.ts`: lesson and repertoire data, pitches, beat lengths.
- `src/pitch.ts`: isolated testable YIN estimator.
- `src/audio.ts`: synthesized demonstration and metronome.
- `src/Staff.tsx`: functional staff renderer for the supported notation subset.
- `src/main.tsx`: UI, practice lifecycle, microphone/MIDI input, timing and feedback.
- `src/storage.ts`: local report persistence.

MIT license for original application code and original instructional prose. The bundled font and dependencies retain their own licenses.
