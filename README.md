# Uku

A mobile-first ukulele companion with a live tuner, searchable chord library, and tap-tempo metronome in a calm vaporwave/cyberpunk neon interface.

## Phase 1: tuner

- Live microphone pitch detection using the Web Audio API; microphone access requires HTTPS or localhost.
- Automatic nearest-string matching, or tap a string to lock onto it.
- Standard high-G, low-G, D, and baritone presets, plus a chromatic mode.
- Frequency, detected note, flat/sharp cents meter, and a clear in-tune state.
- Optional in-tune tone; sound is off until the player enables it.
- Responsive layout, keyboard-focus states, screen-reader labels, reduced-motion support, and helpful permission/error messages.

## Architecture

The app is dependency-free and uses browser ES modules:

- `src/main.js` coordinates app state, preset selection, and module events.
- `src/pitch-detector.js` owns the microphone/Web Audio lifecycle and pitch analysis.
- `src/tunings.js` contains presets, note conversion, and string matching.
- `src/tuner-view.js` renders and updates the tuner interface.
- `src/chords.js` generates chord voicings; `src/chords-view.js` provides catalog search, filters, and fingering diagrams.
- `src/metronome.js` handles tempo, tap-tempo, scheduled audio clicks, and visual beats.
- `index.html` is the app shell; `styles.css` owns the responsive visual system.

The tuner, chord library, and rhythm tools are independent browser modules connected through the app shell. The chord catalog is generated from twelve roots and nine qualities, with four-string fingerings and diagram labels; the metronome schedules clicks with Web Audio and syncs its visual beat display.

## Roadmap

- **Phase 1 — Core tuner:** responsive app shell, live tuner, alternate presets, chromatic mode, accessible tuning feedback. Complete.
- **Phase 2 — Chords and rhythm:** searchable 108-entry chord catalog with fingering diagrams and a tempo/tap-tempo metronome with optional audio and visual beat. Complete.
- **Later phases — To be defined:** refine the core roadmap based on player feedback before taking on additional practice tools.

## Run locally

Serve the project root over HTTP (microphone access is restricted on insecure origins other than localhost):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Allow microphone access to tune; the metronome audio starts after you press its start button.

## Deploy to GitHub Pages

This is a static site with no build step. Configure GitHub Pages to publish the repository root from `main`; commits to that branch will then update the site. Use HTTPS for microphone access.
