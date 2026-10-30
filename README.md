# Uku

A mobile-first ukulele companion. Phase 1 is a browser-based tuner with a calm vaporwave/cyberpunk neon interface and a modular foundation for future practice tools.

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
- `index.html` is the app shell; `styles.css` owns the responsive visual system.

Add future tools as independent modules and connect them through the app shell, rather than coupling them to microphone analysis. The Chords and Rhythm navigation entries are reserved extension points, not implemented features.

## Roadmap

- **Phase 1 — Core tuner:** responsive app shell, live tuner, alternate presets, chromatic mode, accessible tuning feedback. Complete.
- **Phase 2 — Chords and rhythm:** add the user-prioritized chord library and metronome as separately selectable companion modules. Confirm chord content, rhythm controls, and visual details before implementation.
- **Later phases — To be defined:** refine the core roadmap based on player feedback before taking on additional practice tools.

## Run locally

Serve the project root over HTTP (microphone access is restricted on insecure origins other than localhost):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> and allow microphone access.

## Deploy to GitHub Pages

This is a static site with no build step. Configure GitHub Pages to publish the repository root from `main`; commits to that branch will then update the site. Use HTTPS for microphone access.
