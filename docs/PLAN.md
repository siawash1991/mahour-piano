# Delivery plan and status

1. **Research — complete:** primary pedagogical and browser/DSP sources; distinguish numbering from fingers; document assumptions and limits.
2. **Learning design — complete:** six stages, 22 exercises, eight repertoire items; printable labels; fading to note names/notation; parent instructions.
3. **Working app — complete:** Persian responsive interface, synthesized demo, section/full practice, microphone and MIDI, feedback, timing, progress/export.
4. **Validation — complete within the documented test boundary:** TypeScript and production build; synthetic pitch tests; component-level exercise/storage/input-denial tests; deployed HTTP smoke checks.
5. **Publication — complete:** [public GitHub repository](https://github.com/siawash1991/mahour-piano), [Vercel production deployment](https://mahour-piano.vercel.app), connected GitHub integration. Unauthenticated production HTML, JS and CSS all returned HTTP 200.

Validation: 21 DSP/content tests and six component integration tests passed. TypeScript and local/remote Vercel production builds passed.

## Validation boundary

Automated DSP fixtures cover C3–G5 examples at 44.1 and 48 kHz with harmonics plus silence/quiet rejection. These are synthetic inputs, not recordings of the user's piano. Component tests use jsdom and mocked Audio/MIDI/browser services. They are not device/browser compatibility tests. Real microphone permission prompts, acoustic pitch behavior, hardware MIDI and visual rendering on physical mobile devices require real-device verification.

## First family session

1. Open the parent guide and locate C4 on the instrument; label only C4–C5.
2. Open the first lesson and listen to its example.
3. Try screen keys once to understand feedback.
4. Select microphone, allow it and play isolated C4 notes without sustain pedal.
5. If notes are misidentified, reduce background noise and try MIDI where available.
6. Finish one lesson, view its source-labeled report and export if needed.

## Tablet-on-keyboard update

Delivered a dedicated eight-key beginner experience: three separate C-note attacks calibrate C3/C4/C5; numbered exercises are transposed to the calibrated octave; three fantasy image assets; twelve same-origin Persian voice clips; large current/next key instructions; four-note chunks followed by separately scored full performances; pause/cancellation handling; microphone cleanup; uncertain-input filtering; optional fullscreen and Screen Wake Lock; eight-minute rest reminder. The general studio and its advanced lessons are preserved.

The tablet flow deliberately starts with seven suitable exercises/songs using only the numbered white-key octave. It is not an automatic replacement for the advanced curriculum. It does not infer fingering, keybed length, or posture. A parent verifies the eight physical labels after calibration. Calibration is checked again when entering tablet mode, even though the last base is retained.

Validation: 25 DSP/content/gating tests plus 10 component integration tests. New integration coverage includes C3 transposition, partial/full separation, pause safety and microphone permission denial. Physical keyboard and tablet hardware validation remains outstanding.

## Rhythm game / microphone correction

The default landing view is now a winding square-stage game map. Every stage selection calls getUserMedia; the start button is gated on microphone activation AND an actually detected C key. It displays the current signal meter and detected note. Existing browser grants may suppress a fresh permission dialog; the app does not claim it can force that dialog.

Fixed the legacy studio default from screen keys to microphone. Microphone permission now precedes potentially suspended AudioContext initialization, including in the shared tablet/game hook. Each game round requests input again, and visibility loss, manual stop, permission denial and microphone-track termination stop the round.

Falling notes use a 3.2-second lookahead aligned to a gold strike line. Pitch and timing are both required: ±180 ms scores 100; up to ±380 ms scores 60. Unplayed targets expire as misses. Early/late/wrong input produces red plus text, correct input green plus text. One event can score a target only once. Levels unlock at 60% timed hits; 80/95% earn two/three stars. Best per-stage score persists in localStorage. No backing audio is played during listening, to avoid self-triggering.

Validation includes generated PCM passing through the microphone hook/Analyser path, permission ordering and cleanup, timing/score boundaries, stage locks, game microphone gating and red/green feedback. These are synthetic and component tests, not validation on the family's physical keyboard/tablet.
