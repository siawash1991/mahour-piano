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
