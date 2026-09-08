# Custom visual and voice assets

Three separate assets were generated with the built-in `image_gen` tool, visually inspected, copied into the repository and resized to 512×512 with preserved alpha. No application keys or credentials were used.

Files:
- `public/icons/coach.png` — friendly star coach, used in tablet mode and app icon.
- `public/icons/piano.png` — miniature teal piano, used for practice.
- `public/icons/trophy.png` — musical trophy, used for achievements.

## Exact image prompt set

Each prompt is this common paragraph followed by the corresponding subject below:

> Use case: stylized-concept. Asset type: fantasy children's piano app icon. Style: premium soft 3D clay, friendly rounded chunky forms, smooth matte clay with subtle warm highlights, cohesive emerald teal, pastel mint and golden yellow palette. Composition: one centered icon, square canvas, 18% generous clear padding all around, three-quarter front view, clean readable silhouette at small size. Lighting: soft studio light upper left, gentle ambient occlusion only on object. Background: genuinely transparent alpha, no backdrop, no ground plane, no checkerboard drawn in image. No text, no letters, no logo, no watermark, no border, no UI.

Coach:
> Subject: a smiling little golden five-point star character wearing chunky emerald teal over-ear headphones with mint cushions. Two tiny dark eyes, sweet curved smile, friendly and magical.

Piano:
> Subject: a playful miniature emerald teal toy upright piano with mint trim, short chunky legs, neat ivory and charcoal piano keys, and one floating golden musical eighth note above it.

Trophy:
> Subject: a golden musical achievement trophy, rounded cup with two curved handles and a raised five-point golden star emblem on the front, a small emerald teal and mint pedestal, and a tiny music-note relief below the star.

## Persian audio

12 synthesized MP3 prompts, generated at build/authoring time through `edge-tts`, voice `fa-IR-DilaraNeural`, rate `-12%`. Exact original Persian scripts are in `public/voice/transcripts.json`; reproducible authoring script: `scripts/generate_voice.py`. The tool is not a production app dependency. No learner audio or progress is sent to this service. Audio clips are served from the same app domain and are not recordings of a human narrator.

The app uses HTMLAudio playback rather than relying on a device-installed Persian SpeechSynthesis voice. Failure is shown as an inline message; number and text remain usable. Recognition is gated during spoken prompts, with a 300 ms settling delay, so the guide is not treated as learner input. Pedal resonance and very noisy rooms can still produce recognition errors.
