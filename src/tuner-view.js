import { tunings } from './tunings.js';

export class TunerView {
  constructor() {
    this.elements = {
      tuningSelect: document.querySelector('#tuning-select'),
      listeningState: document.querySelector('#listening-state'),
      stateText: document.querySelector('#state-text'),
      noteReadout: document.querySelector('#note-readout'),
      frequencyReadout: document.querySelector('#frequency-readout'),
      detectedNote: document.querySelector('#detected-note'),
      centsReadout: document.querySelector('#cents-readout'),
      meter: document.querySelector('#pitch-meter'),
      needle: document.querySelector('#meter-needle'),
      stringPicker: document.querySelector('#string-picker'),
      micButton: document.querySelector('#mic-button'),
      micButtonText: document.querySelector('#mic-button-text'),
      micHint: document.querySelector('#mic-hint'),
      soundToggle: document.querySelector('#sound-toggle'),
    };
  }

  renderStrings(strings, selectedIndex = null, tunedIndex = null) {
    this.elements.stringPicker.replaceChildren(...strings.map((string, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `string-button${index === tunedIndex ? ' in-tune' : ''}`;
      button.setAttribute('aria-pressed', String(index === selectedIndex));
      button.setAttribute('aria-label', `Select string ${index + 1}, ${string.note}${index === selectedIndex ? ', selected' : ''}`);
      const name = document.createElement('span');
      name.className = 'string-name';
      const note = document.createElement('strong');
      note.textContent = string.name;
      const octave = document.createElement('small');
      octave.textContent = `${string.octave} OCT`;
      name.append(note, octave);
      const number = document.createElement('span');
      number.className = 'string-index';
      number.textContent = String(index + 1);
      button.append(name, number);
      button.addEventListener('click', () => this.onStringSelected?.(index));
      return button;
    }));
  }

  setTuningOptions(value) {
    this.elements.tuningSelect.value = value;
  }

  onTuningChange(callback) {
    this.elements.tuningSelect.addEventListener('change', (event) => callback(event.target.value));
  }

  onStartStop(callback) {
    this.elements.micButton.addEventListener('click', callback);
  }

  onSoundToggle(callback) {
    this.elements.soundToggle.addEventListener('click', callback);
  }

  onStringSelect(callback) {
    this.onStringSelected = callback;
  }

  setListening(isListening) {
    this.isListening = isListening;
    this.elements.micButton.classList.toggle('listening', isListening);
    this.elements.micButtonText.textContent = isListening ? 'Stop tuning' : 'Start tuning';
    this.elements.micButton.setAttribute('aria-label', isListening ? 'Stop tuning' : 'Start tuning');
    this.setStatus(isListening ? 'listening' : 'ready', isListening ? 'LISTENING FOR A STRING' : 'READY WHEN YOU ARE');
    this.elements.micHint.textContent = isListening ? 'Pluck one string, then let it ring.' : 'Headphones off, ukulele close by.';
  }

  setStatus(state, text) {
    this.elements.listeningState.classList.remove('listening', 'tuned', 'error');
    if (state !== 'ready') this.elements.listeningState.classList.add(state);
    this.elements.stateText.textContent = text;
  }

  setPitch({ frequency, noteName, octave, cents, targetString, tuned, targetIndex, selectedIndex, stringLabel, chromatic = false }) {
    this.elements.noteReadout.textContent = `${noteName}${octave}`;
    this.elements.noteReadout.classList.toggle('in-tune', tuned);
    this.elements.frequencyReadout.textContent = `${frequency.toFixed(1)} Hz`;
    this.elements.detectedNote.textContent = chromatic
      ? `CHROMATIC · ${tuned ? 'IN TUNE' : cents > 0 ? 'SHARP' : cents < 0 ? 'FLAT' : 'IN TUNE'}`
      : tuned ? `${stringLabel} STRING · IN TUNE` : `${stringLabel} STRING · ${cents > 0 ? 'SHARP' : cents < 0 ? 'FLAT' : 'IN TUNE'}`;
    const clampedCents = Math.max(-50, Math.min(50, cents));
    this.elements.needle.style.left = `${50 + clampedCents}%`;
    this.elements.needle.classList.toggle('in-tune', tuned);
    this.elements.meter.setAttribute('aria-valuenow', String(clampedCents));
    this.elements.meter.setAttribute('aria-valuetext', `${Math.abs(cents)} cents ${cents > 0 ? 'sharp' : cents < 0 ? 'flat' : 'in tune'}`);
    this.elements.centsReadout.textContent = tuned ? 'IN TUNE' : `${Math.abs(cents)} CENTS ${cents > 0 ? 'SHARP' : 'FLAT'}`;
    this.elements.listeningState.classList.toggle('tuned', tuned);
    this.elements.stateText.textContent = tuned ? 'THAT’S THE ONE' : 'LISTENING FOR A STRING';
    const activeIndex = chromatic ? null : (selectedIndex ?? targetIndex);
    if (!chromatic && selectedIndex === null && targetString) {
      this.elements.stringPicker.querySelectorAll('.string-button').forEach((button, index) => {
        if (index !== targetIndex) button.setAttribute('aria-pressed', 'false');
      });
      this.elements.stringPicker.querySelector(`.string-button:nth-child(${targetIndex + 1})`)?.setAttribute('aria-pressed', 'true');
    }
    this.updateStringState(activeIndex, tuned && !chromatic ? targetIndex : null);
  }

  setCurrentStrings(strings) {
    this.currentStrings = strings;
  }

  resetPitch() {
    this.elements.noteReadout.textContent = '—';
    this.elements.noteReadout.classList.remove('in-tune');
    this.elements.frequencyReadout.textContent = '— Hz';
    this.elements.detectedNote.textContent = 'PLAY A STRING TO BEGIN';
    this.elements.needle.style.left = '50%';
    this.elements.needle.classList.remove('in-tune');
    this.elements.meter.setAttribute('aria-valuenow', '0');
    this.elements.meter.setAttribute('aria-valuetext', 'Waiting for a note');
    this.elements.centsReadout.textContent = '—';
    this.updateStringState(this.selectedIndex ?? null);
    this.elements.listeningState.classList.remove('tuned');
    if (this.isListening) this.setStatus('listening', 'LISTENING FOR A STRING');
  }

  setSelectedIndex(index) {
    this.selectedIndex = index;
  }

  updateStringState(selectedIndex = null, tunedIndex = null) {
    this.elements.stringPicker.querySelectorAll('.string-button').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === selectedIndex));
      button.classList.toggle('in-tune', index === tunedIndex);
      const string = this.currentStrings[index];
      button.setAttribute('aria-label', `Select string ${index + 1}, ${string.note}${index === selectedIndex ? ', selected' : ''}`);
    });
  }

  setSoundEnabled(enabled) {
    this.elements.soundToggle.setAttribute('aria-pressed', String(enabled));
    this.elements.soundToggle.setAttribute('aria-label', enabled ? 'Turn tuning sound off' : 'Turn tuning sound on');
    this.elements.soundToggle.querySelector('span').textContent = enabled ? 'Sound on' : 'Sound off';
  }

  setError(message) {
    this.setListening(false);
    this.setStatus('error', 'MICROPHONE NOT READY');
    this.elements.micHint.textContent = message;
  }

  setStarting(isStarting) {
    this.elements.micButton.disabled = isStarting;
    const label = isStarting ? 'Connecting…' : (this.isListening ? 'Stop tuning' : 'Start tuning');
    this.elements.micButtonText.textContent = label;
    this.elements.micButton.setAttribute('aria-label', label);
  }
}
