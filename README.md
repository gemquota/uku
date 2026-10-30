# Uku

Uku is an acoustic intelligence workstation: a precision ukulele tuner first, a live signal-analysis instrument second, and a compact music-theory and accompaniment workstation. Its five fixed-screen workspaces are Tuner, Analysis, Theory, Studio, and Library; the document does not scroll.

## Phase 1: tuner

- Live microphone pitch detection using the Web Audio API; microphone access requires HTTPS or localhost.
- Automatic nearest-string matching, or tap a string to lock onto it.
- Standard high-G, low-G, D, and baritone presets, plus a chromatic mode.
- Frequency, detected note, target frequency, adjustable A4 reference (400–480 Hz), cents meter, and clear in-tune state.
- Optional in-tune tone; sound is off until the player enables it.
- Responsive layout, keyboard-focus states, screen-reader labels, reduced-motion support, and helpful permission/error messages.

## Architecture

The app is dependency-free and uses browser ES modules:

- `src/main.js` coordinates app state, preset selection, and module events.
- `src/pitch-detector.js` owns the microphone/Web Audio lifecycle and YIN-style fundamental-frequency analysis, including normalized-difference pitch confidence and rolling pitch stability.
- `src/tunings.js` contains presets, note conversion, and frequency-based string matching.
- `src/tuner-view.js` renders the tuning interface; `src/signal-visualizer.js` draws live waveform, spectrum, spectrogram, derivative, and tuning-map scopes, and derives RMS/peak, FFT resolution, sample rate, and relative spectral estimates.
- `src/chords.js` generates chord voicings; `src/chords-view.js` provides catalog search, filters, and fingering diagrams; `src/chord-identifier.js` ranks fretboard selections by estimated chord-tone coverage.
- `src/metronome.js` handles tempo, tap-tempo, scheduled audio clicks, and visual beats; `src/step-sequencer.js` provides layered drum and pitched tracks with synthesized Web Audio kits.
- `index.html` is the app shell; `styles.css` owns the responsive visual system.

The five workspaces fit a fixed viewport and use compact responsive layouts rather than page scrolling. Tuner and Analysis share microphone capture. Theory provides chord-tone mapping, note-to-chord matching, and six scale formulas over a 13-fret map; chord-identification rankings are theory-fit estimates, not probabilities. Library contains a searchable, filterable 108-voicing catalog with explicit pagination; Studio combines the metronome with a layered step sequencer. The Analysis panel reports digital-full-scale-relative amplitude and relative SNR/HNR estimates only: browser microphone gain and device response are uncalibrated, so these values are not laboratory measurements. Seven palettes support light and dark appearances. The sequencer uses synthesized drum timbres (not sampled or affiliated Roland sound banks) and oscillator-based bass, guitar, and piano layers.

## Product direction

Uku prioritizes instrument-grade tuning, measurements derived from live microphone samples, expressive visualizations driven by the captured signal, and compact tools for experienced musicians. The current Theory workspace is a useful fretboard/chord/scale tool, not yet the larger relational music-theory knowledge graph; MIDI, recording/export, and a broader accompaniment engine remain future work.

## Run locally

Serve the project root over HTTP (microphone access is restricted on insecure origins other than localhost):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Allow microphone access to tune; the metronome audio starts after you press its start button.

## Deploy to GitHub Pages

This is a static site with no build step. Configure GitHub Pages to publish the repository root from `main`; commits to that branch will then update the site. Use HTTPS for microphone access.
