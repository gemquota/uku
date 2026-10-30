import { findNearestString, frequencyToNote, tunings } from './tunings.js';
import { PitchDetector } from './pitch-detector.js';
import { TunerView } from './tuner-view.js';

const view = new TunerView();
const state = {
  tuningKey: 'standard',
  selectedIndex: null,
  isListening: false,
  soundEnabled: false,
  lastTuned: false,
  lastSoundAt: 0,
  audioContext: null,
};
let detector = null;

function getStrings() {
  return tunings[state.tuningKey].strings;
}

function renderStrings() {
  const chromatic = state.tuningKey === 'chromatic';
  view.elements.stringPicker.hidden = chromatic;
  view.setCurrentStrings(getStrings());
  view.setSelectedIndex(state.selectedIndex);
  view.renderStrings(getStrings(), chromatic ? null : state.selectedIndex);
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

function onPitch(frequency) {
  if (frequency < 55 || frequency > 1200) return;
  const detected = frequencyToNote(frequency);
  const strings = getStrings();
  const isChromatic = state.tuningKey === 'chromatic';
  const matchedString = isChromatic
    ? { midi: detected.midi, name: detected.name, octave: detected.octave, frequency: detected.targetFrequency }
    : (state.selectedIndex === null ? findNearestString(detected.midi, strings) : strings[state.selectedIndex]);
  if (!matchedString) return;
  const cents = Math.round(1200 * Math.log2(frequency / matchedString.frequency));
  const tuned = Math.abs(cents) <= 5;
  const targetIndex = isChromatic ? -1 : strings.indexOf(matchedString);
  const nextStringLabel = isChromatic ? detected.name : matchedString.name;
  if (tuned && !state.lastTuned) playInTuneCue();
  state.lastTuned = tuned;
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
}

function onSilence() {
  if (!state.isListening) return;
  state.lastTuned = false;
  view.resetPitch();
  view.setStatus('listening', 'LISTENING FOR A STRING');
}

async function stopTuning() {
  await detector?.stop();
  detector = null;
  state.isListening = false;
  state.lastTuned = false;
  view.setListening(false);
  view.resetPitch();
  renderStrings();
}

async function startTuning() {
  state.isListening = true;
  view.setStarting(true);
  view.setStatus('listening', 'ASKING FOR MICROPHONE');
  view.elements.micHint.textContent = 'Allow microphone access when your browser asks.';
  detector = new PitchDetector(onPitch, onSilence);
  try {
    await detector.start();
    state.lastTuned = false;
    view.setListening(true);
    if (state.soundEnabled && state.audioContext?.state === 'suspended') await state.audioContext.resume();
  } catch (error) {
    detector = null;
    state.isListening = false;
    const message = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
      ? 'Microphone access is blocked. Allow it in browser settings, then try again.'
      : error.name === 'NotFoundError'
        ? 'No microphone found. Connect one and try again.'
        : error.message || 'Could not start microphone. Try again.';
    view.setError(message);
  } finally {
    view.setStarting(false);
  }
}

view.onStartStop(() => {
  if (state.isListening) {
    void stopTuning();
  } else {
    void startTuning();
  }
});

view.onTuningChange((key) => {
  state.tuningKey = key;
  state.selectedIndex = null;
  state.lastTuned = false;
  renderStrings();
  view.resetPitch();
});

view.onStringSelect((index) => {
  if (state.tuningKey === 'chromatic') return;
  state.selectedIndex = state.selectedIndex === index ? null : index;
  state.lastTuned = false;
  renderStrings();
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

view.setTuningOptions(state.tuningKey);
renderStrings();
