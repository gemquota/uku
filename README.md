# Uku

Uku is a fixed-screen acoustic intelligence workstation. Its primary job remains precision tuning; the expanded workspaces add musical analysis, a mathematically generated scale atlas, synthesis, and composition experiments without replacing the existing tuner, signal scopes, chord library, metronome, or sequencer.

## Workspaces

- **Tuner** — existing instrument-first ukulele tuner with selectable tunings, A4 reference, cents meter, and live pitch feedback.
- **Analysis** — existing waveform, FFT spectrum, spectrogram, resonance visualization, and signal metrics.
- **Theory** — existing chord/fretboard tools plus the expanded scale-universe workspace.
- **Universe** — 2,048 rooted pitch-class collections navigable by Gray code, binary order, cardinality, or symmetry; a generated 344-family modal atlas; circle-of-fifths portraits; interval fingerprints; scale mutation; modal rotation; structural comparison; and candidate matching.
- **Studio** — existing metronome and step sequencer, complemented by deterministic motif generation and MIDI export in the Universe workspace.
- **Library** — existing searchable chord-voicing catalog.

## Musical domain engine

`src/music-theory.js` is a dependency-free twelve-tone pitch-class engine. It provides:

- All 2,048 rooted pitch-class collections (the root pitch class is fixed at C).
- Modal normalization and distinct mode rotations.
- Canonical modal-family identity.
- Interval sequences and six-dimensional interval-class vectors.
- Rotational symmetry and unique chromatic transposition counts.
- Prime-form-style Tn/I normalization.
- Hamming and Jaccard comparison, common-tone sets, mutations, and interval-vector distance.
- Candidate scale matching from observed pitch classes.
- Frequency/MIDI conversion helpers.

The periodic atlas contains **344 families** under the implemented convention: non-empty rooted collections with cardinality of at least three, grouped by distinct modal rotations. The full 2,048-collection rooted universe remains available to the matching engine. This convention is explicit because counts change when trivial one- and two-note collections are included or excluded.

## Synthesis and analysis

- `src/synthesis-engine.js` provides a persistent Web Audio synthesiser with piano-, guitar-, ukulele-, and synth-oriented oscillator voicings, envelope controls, chords, strums, and a shared analyser output.
- The synthesiser dock can be placed at the bottom, top, left, right, or in a floating position; it can be collapsed, resized, and locked. Its layout preference persists across workspaces and sessions.
- The dock's keyboard feeds the synthesis engine directly. The same analyser path inspects synthesiser output.
- Optional microphone analysis uses a separate capture path. Microphone permission requires HTTPS or localhost.
- `src/analysis-worker.js` performs spectral peak and chroma extraction in a Web Worker. These are candidate pitch-class observations, not a validated polyphonic transcription model.

## Composition and relationships

- `src/composition-engine.js` provides seeded motif generation, transposition, retrograde, inversion, augmentation, diminution, project snapshots, and Standard MIDI File export.
- `src/knowledge-graph.js` models typed musical nodes and weighted relationships, with neighbourhood and path queries; the workspace builds a mutation-neighbour graph for the 344 atlas families.\n- `src/harmony-engine.js` provides chord templates, chord identification, scale-contained chord discovery, and voice-leading cost estimates.\n- `src/acoustic-engine.js` compares equal temperament, just-major ratios, and Pythagorean ratios; it also exposes beat-frequency, harmonic-partial, and roughness estimators.\n- `src/acoustic-engine.js` compares equal temperament, just-major ratios, and Pythagorean ratios; it also exposes beat-frequency, harmonic-partial, and roughness estimators.
- `src/visualization-engine.js` renders scale geometry, interval fingerprints, and harmonic partials from the underlying data.
- `src/music-lab.js` integrates these capabilities into the existing application shell and mounts the persistent dock.

## Architecture

The application remains dependency-free browser ES modules:

- `src/main.js` coordinates the original tuner, theory, metronome, sequencer, and the new music lab.
- `src/music-theory.js` is the canonical pitch-class and scale mathematics layer.
- `src/synthesis-engine.js` owns generated audio.
- `src/analysis-worker.js` performs off-main-thread spectral feature extraction.
- `src/composition-engine.js` owns motif and MIDI operations.
- `src/knowledge-graph.js` owns relationship queries.
- `src/visualization-engine.js` owns reusable canvas visualizations.
- `src/music-lab.js` mounts the workspace and persistent synthesiser UI.
- `styles/music-lab.css` styles the fixed-screen workspace and dock.

## Verification

Run the mathematical unit tests with Node.js:

```sh
npm test
```

Run the static application:

```sh
npm run serve
```

Open <http://localhost:8000>. Use HTTPS or localhost for microphone access. Audio playback starts only after a user gesture.

## Current boundaries

This sprint adds working foundations and integrated workflows, not a claim of instrument-grade completion for every research feature. In particular:

- The current oscillator instruments are useful for note and interval experiments, not realistic sampled piano/guitar/ukulele emulations.
- Polyphonic analysis is spectral peak/chroma based. It does not yet provide source separation, robust chord transcription, calibrated timbre analysis, or confidence-calibrated scale recognition.
- The harmonic spectrum display is an idealized partial series; it is not a measured spectrum of the currently selected synthesized timbre. Acoustic roughness and harmonicity values are simplified models, not perceptual ground truth. Acoustic roughness and harmonicity values are simplified models, not perceptual ground truth.
- Composition currently supports generated note events and MIDI export, not a full multitrack DAW, notation engraving, audio recording, or audio-file export.
- The relationship graph exposes the graph model and scale-neighbour queries; a full navigable force-directed graph is still a separate visualization milestone.
- The atlas is generated from canonical pitch-class data; scale names and culturally situated emotional associations are not inferred as objective facts.

These boundaries are deliberately documented rather than hidden behind impressive labels. The existing tuner remains the product's primary instrument.
