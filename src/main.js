import { findNearestStringByFrequency, frequencyForMidi, frequencyToNote, tunings } from './tunings.js';
import { PitchDetector } from './pitch-detector.js';
import { TunerView } from './tuner-view.js';
import { SignalVisualizer } from './signal-visualizer.js';
import { ChordsView } from './chords-view.js';
import { Metronome } from './metronome.js';
import { ChordIdentifier } from './chord-identifier.js';
import { StepSequencer } from './step-sequencer.js';
import { Synthesizer } from './synthesizer.js';
import { ScaleAtlas } from './scale-atlas.js';

const view = new TunerView();
const signalVisualizer = new SignalVisualizer(document.querySelector('.signal-scopes'));
const chordIdentifier = new ChordIdentifier();
const chordsView = new ChordsView(chordIdentifier);
const metronome = new Metronome();
const stepSequencer = new StepSequencer();
const synthesizer = new Synthesizer(document.querySelector('#synth-dock'));
const scaleAtlas = new ScaleAtlas(document.querySelector('#scale-atlas-section'), (notes) => synthesizer.playSequence(notes));
const analysisSource = document.querySelector('#analysis-source');
const moduleButtons = [...document.querySelectorAll('[data-module]')];
const modulePanels = [...document.querySelectorAll('[data-panel]')];
const state = {
  tuningKey: 'standard',
  referenceA4: 440,
  selectedIndex: null,
  isListening: false,
  soundEnabled: false,
  lastTuned: false,
  lastSoundAt: 0,
  audioContext: null,
  inputSource: 'microphone',
  startToken: 0,
};
let detector = null;

function selectModule(moduleName) {
  moduleButtons.forEach((button) => {
    const active = button.dataset.module === moduleName;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  modulePanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== moduleName;
  });
  const synthDock = document.querySelector('#synth-dock');
  synthDock?.classList.toggle('tab-hidden', synthDock.dataset.pinned !== 'true' && moduleName !== 'studio');
  if (!['tuner', 'analysis'].includes(moduleName) && state.isListening) void stopTuning();
}

moduleButtons.forEach((button) => button.addEventListener('click', () => selectModule(button.dataset.module)));

const themePalette = document.querySelector('#theme-palette');
const themeMode = document.querySelector('#theme-mode');
const referenceA4Input = document.querySelector('#reference-a4');
const fftSizeInput = document.querySelector('#fft-size');
const targetFrequency = document.querySelector('#target-frequency');
const globalMicToggle = document.querySelector('#global-mic-toggle');
const audioEngineStatus = document.querySelector('#audio-engine-status');
const analysisMetrics = {
  fundamental: document.querySelector('#metric-fundamental'),
  confidence: document.querySelector('#metric-confidence'),
  stability: document.querySelector('#metric-stability'),
  level: document.querySelector('#metric-level'),
  snr: document.querySelector('#metric-snr'),
  hnr: document.querySelector('#metric-hnr'),
  fft: document.querySelector('#metric-fft'),
  rate: document.querySelector('#metric-rate'),
  status: document.querySelector('#analysis-state'),
};
function loadPreference(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Keep the controls usable even when storage is unavailable.
  }
}

function applyTheme() {
  document.documentElement.dataset.palette = themePalette.value;
  document.documentElement.dataset.mode = themeMode.value;
  savePreference('uku-palette', themePalette.value);
  savePreference('uku-theme-mode', themeMode.value);
}

function renderAnalysis(metrics = {}) {
  analysisMetrics.fundamental.textContent = Number.isFinite(metrics.frequency) ? `${metrics.frequency.toFixed(2)} Hz` : '—';
  analysisMetrics.confidence.textContent = Number.isFinite(metrics.confidence) ? `${Math.round(metrics.confidence * 100)}%` : '—';
  analysisMetrics.stability.textContent = Number.isFinite(metrics.stabilityCents) ? `±${metrics.stabilityCents.toFixed(1)} cents` : '—';
  analysisMetrics.level.textContent = Number.isFinite(metrics.rms) && Number.isFinite(metrics.peak) ? `${metrics.rms.toFixed(4)} / ${metrics.peak.toFixed(3)}` : '—';
  analysisMetrics.snr.textContent = Number.isFinite(metrics.snrDb) ? `~${metrics.snrDb.toFixed(1)} dB*` : '—';
  analysisMetrics.hnr.textContent = Number.isFinite(metrics.hnrDb) ? `~${metrics.hnrDb.toFixed(1)} dB*` : '—';
  analysisMetrics.fft.textContent = metrics.fftSize ? `${metrics.fftSize} · ${metrics.resolutionHz.toFixed(2)} Hz/bin` : '—';
  analysisMetrics.rate.textContent = metrics.sampleRate ? `${(metrics.sampleRate / 1000).toFixed(1)} kHz · ${metrics.bufferSize} samples` : '—';
  analysisMetrics.status.textContent = metrics.frequency ? (state.inputSource === 'synth' ? 'LIVE · SYNTH' : 'LIVE · MICROPHONE') : state.isListening ? (state.inputSource === 'synth' ? 'SYNTH · NO PITCH' : 'LISTENING · NO PITCH') : 'WAITING FOR INPUT';
}

signalVisualizer.onMetrics = renderAnalysis;
referenceA4Input.value = String(loadPreference('uku-reference-a4', '440'));
state.referenceA4 = Math.max(400, Math.min(480, Number(referenceA4Input.value) || 440));
referenceA4Input.addEventListener('change', () => {
  state.referenceA4 = Math.max(400, Math.min(480, Number(referenceA4Input.value) || 440));
  referenceA4Input.value = String(state.referenceA4);
  savePreference('uku-reference-a4', referenceA4Input.value);
  renderStrings();
  targetFrequency.textContent = `TARGET — Hz · A4 = ${state.referenceA4.toFixed(1)} Hz`;
  detector?.resetPitchHistory();
  if (state.isListening) onSilence();
});
fftSizeInput.value = loadPreference('uku-fft-size', '4096');
fftSizeInput.addEventListener('change', async () => {
  const fftSize = Number(fftSizeInput.value);
  savePreference('uku-fft-size', String(fftSize));
  if (!detector) return;
  try {
    await detector.setFftSize(fftSize);
  } catch (error) {
    fftSizeInput.value = '4096';
    analysisMetrics.status.textContent = error.message;
  }
});

themePalette.value = loadPreference('uku-palette', 'vaporwave');
themeMode.value = loadPreference('uku-theme-mode', 'dark');
if (![...themePalette.options].some((option) => option.value === themePalette.value)) themePalette.value = 'vaporwave';
if (!['dark', 'light'].includes(themeMode.value)) themeMode.value = 'dark';
applyTheme();
themePalette.addEventListener('change', applyTheme);
themeMode.addEventListener('change', applyTheme);
function getStrings() {
  return tunings[state.tuningKey].strings.map((string) => ({ ...string, frequency: frequencyForMidi(string.midi, state.referenceA4) }));
}

function renderStrings() {
  const chromatic = state.tuningKey === 'chromatic';
  view.elements.stringPicker.hidden = chromatic;
  const strings = getStrings();
  view.setCurrentStrings(strings);
  view.setSelectedIndex(state.selectedIndex);
  signalVisualizer.setStrings(strings, chromatic ? null : state.selectedIndex);
  view.renderStrings(strings, chromatic ? null : state.selectedIndex);
}

function playInTuneCue() {
  if (!state.soundEnabled || !state.audioContext || state.audioContext.state !== 'running') return;
  const now = performance.now();
  if (now - state.lastSoundAt < 1100) return;
  state.lastSoundAt = now;
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.035, state.audioContext.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, state.audioContext.currentTime + 0.16);
  oscillator.connect(gain);
  gain.connect(state.audioContext.destination);
  oscillator.start();
  oscillator.stop(state.audioContext.currentTime + 0.17);
}

function onPitch(frequency, quality = {}) {
  if (frequency < 40 || frequency > 1500) return;
  const detected = frequencyToNote(frequency, state.referenceA4);
  const strings = getStrings();
  const isChromatic = state.tuningKey === 'chromatic';
  const matchedString = isChromatic
    ? { midi: detected.midi, name: detected.name, octave: detected.octave, frequency: detected.targetFrequency }
    : (state.selectedIndex === null ? findNearestStringByFrequency(frequency, strings, state.referenceA4) : strings[state.selectedIndex]);
  if (!matchedString) return;
  const cents = Math.round(1200 * Math.log2(frequency / matchedString.frequency));
  const tuned = Math.abs(cents) <= 5;
  const targetIndex = isChromatic ? -1 : strings.indexOf(matchedString);
  const nextStringLabel = isChromatic ? detected.name : matchedString.name;
  if (tuned && !state.lastTuned) playInTuneCue();
  state.lastTuned = tuned;
  targetFrequency.textContent = `TARGET ${matchedString.frequency.toFixed(2)} Hz · A4 = ${state.referenceA4.toFixed(1)} Hz`;
  view.setPitch({
    frequency,
    noteName: detected.name,
    octave: detected.octave,
    cents,
    targetString: matchedString,
    tuned,
    targetIndex,
    selectedIndex: state.selectedIndex,
    stringLabel: nextStringLabel,
    chromatic: isChromatic,
  });
  signalVisualizer.setTuning({
    frequency,
    activeIndex: isChromatic ? null : targetIndex,
    cents,
    tuned,
    selectedIndex: isChromatic ? null : state.selectedIndex,
    confidence: quality.confidence ?? 0,
    stabilityCents: quality.stabilityCents ?? 0,
  });
}

function syncAudioControls() {
  globalMicToggle.setAttribute('aria-pressed', String(state.isListening));
  globalMicToggle.textContent = state.isListening ? 'Input on' : 'Input off';
  globalMicToggle.setAttribute('aria-label', state.isListening ? 'Stop audio analysis input' : 'Start audio analysis input');
  audioEngineStatus.textContent = state.isListening
    ? (state.inputSource === 'synth' ? 'SYNTH ANALYSIS LIVE' : 'MICROPHONE LIVE')
    : 'AUDIO ENGINE READY';
}

function onSilence() {
  if (!state.isListening) return;
  state.lastTuned = false;
  detector?.resetPitchHistory();
  signalVisualizer.setTuning({ frequency: null, activeIndex: null, cents: 0, tuned: false, selectedIndex: state.selectedIndex, confidence: 0, stabilityCents: 0 });
  view.resetPitch();
  targetFrequency.textContent = `TARGET — Hz · A4 = ${state.referenceA4.toFixed(1)} Hz`;
  view.setStatus('listening', state.inputSource === 'synth' ? 'LISTENING TO SYNTH OUTPUT' : 'LISTENING FOR A STRING');
}

async function stopTuning() {
  state.startToken += 1;
  const activeDetector = detector;
  detector = null;
  await activeDetector?.stop();
  state.isListening = false;
  state.lastTuned = false;
  view.setListening(false);
  syncAudioControls();
  view.resetPitch();
  signalVisualizer.clear();
  renderAnalysis();
  renderStrings();
}

async function startTuning() {
  const token = ++state.startToken;
  state.isListening = true;
  view.setStarting(true);
  view.setStatus('listening', state.inputSource === 'synth' ? 'CONNECTING SYNTH OUTPUT' : 'ASKING FOR MICROPHONE');
  view.elements.micHint.textContent = state.inputSource === 'synth'
    ? 'Play a key on the docked synthesiser.'
    : 'Allow microphone access when your browser asks.';
  const nextDetector = new PitchDetector(onPitch, onSilence, (timeData, frequencyData, sampleRate, audioInfo) => {
    signalVisualizer.render(timeData, frequencyData, sampleRate, audioInfo);
  });
  nextDetector.fftSize = Number(fftSizeInput.value) || 4096;
  detector = nextDetector;
  try {
    const stream = state.inputSource === 'synth' ? await synthesizer.getAnalysisStream() : null;
    if (token !== state.startToken) { await nextDetector.stop(); return; }
    await nextDetector.start(stream);
    if (token !== state.startToken) { await nextDetector.stop(); return; }
    state.lastTuned = false;
    view.setListening(true);
    syncAudioControls();
  } catch (error) {
    if (token !== state.startToken) return;
    detector = null;
    state.isListening = false;
    syncAudioControls();
    const message = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
      ? 'Microphone access is blocked. Allow it in browser settings, then try again.'
      : error.name === 'NotFoundError'
        ? 'No microphone found. Connect one and try again.'
        : error.message || 'Could not start audio input. Try again.';
    view.setError(message);
  } finally {
    if (token === state.startToken) view.setStarting(false);
  }
}

function toggleMicrophone() {
  if (state.isListening) {
    void stopTuning();
    return;
  }
  const activeModule = moduleButtons.find((button) => button.classList.contains('active'))?.dataset.module;
  if (!['tuner', 'analysis'].includes(activeModule)) selectModule('analysis');
  void startTuning();
}

view.onStartStop(toggleMicrophone);
globalMicToggle.addEventListener('click', toggleMicrophone);
analysisSource.value = loadPreference('uku-analysis-source', 'microphone');
state.inputSource = ['microphone', 'synth'].includes(analysisSource.value) ? analysisSource.value : 'microphone';
analysisSource.value = state.inputSource;
analysisSource.addEventListener('change', () => {
  state.inputSource = analysisSource.value;
  savePreference('uku-analysis-source', state.inputSource);
  if (state.isListening) void stopTuning().then(() => startTuning());
});
view.onTuningChange((key) => {
  state.tuningKey = key;
  state.selectedIndex = null;
  state.lastTuned = false;
  detector?.resetPitchHistory();
  renderStrings();
  view.resetPitch();
});

view.onStringSelect((index) => {
  if (state.tuningKey === 'chromatic') return;
  state.selectedIndex = state.selectedIndex === index ? null : index;
  state.lastTuned = false;
  detector?.resetPitchHistory();
  renderStrings();
  signalVisualizer.setTuning({ frequency: null, activeIndex: null, cents: 0, tuned: false, selectedIndex: state.selectedIndex });
});

view.onSoundToggle(async () => {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      view.elements.micHint.textContent = 'Tuning sound is not supported in this browser.';
      return;
    }
    state.audioContext = new AudioContextClass();
  }
  if (state.audioContext.state === 'suspended') await state.audioContext.resume();
  state.soundEnabled = !state.soundEnabled;
  view.setSoundEnabled(state.soundEnabled);
});

document.querySelectorAll('[data-board-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.boardMode;
    const panel = document.querySelector('#theory-panel');
    panel.dataset.mode = mode;
    document.querySelectorAll('[data-board-mode]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('#fretboard-section').hidden = mode === 'atlas';
    document.querySelector('#identify-section').hidden = mode !== 'identify';
    document.querySelector('#scale-section').hidden = mode !== 'scale';
    document.querySelector('#scale-atlas-section').hidden = mode !== 'atlas';
  });
});

view.setTuningOptions(state.tuningKey);
renderStrings();
renderAnalysis();
syncAudioControls();
