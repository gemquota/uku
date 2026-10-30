const KIT_BANKS = [
  { name: '808-inspired', kick: 0.48, snare: 0.19, hat: 0.12, tone: 0.76, decay: 0.18 },
  { name: '909-inspired', kick: 0.68, snare: 0.29, hat: 0.22, tone: 0.9, decay: 0.12 },
  { name: 'Linn-style', kick: 0.56, snare: 0.26, hat: 0.11, tone: 0.68, decay: 0.2 },
  { name: 'Acoustic', kick: 0.42, snare: 0.16, hat: 0.08, tone: 0.54, decay: 0.23 },
  { name: 'Rock kit', kick: 0.61, snare: 0.32, hat: 0.13, tone: 0.58, decay: 0.15 },
  { name: 'Club', kick: 0.72, snare: 0.24, hat: 0.2, tone: 0.92, decay: 0.1 },
  { name: 'Hardstyle', kick: 0.82, snare: 0.34, hat: 0.2, tone: 1, decay: 0.09 },
  { name: 'Techno', kick: 0.7, snare: 0.2, hat: 0.17, tone: 0.82, decay: 0.13 },
  { name: 'Reggae', kick: 0.34, snare: 0.17, hat: 0.09, tone: 0.62, decay: 0.24 },
  { name: 'Lo-fi', kick: 0.39, snare: 0.15, hat: 0.07, tone: 0.48, decay: 0.28 },
  { name: 'Sound FX', kick: 0.63, snare: 0.28, hat: 0.18, tone: 1.15, decay: 0.32 },
];
const DRUM_ROWS = [
  { key: 'kick', label: 'KICK', note: 36 },
  { key: 'snare', label: 'SNARE', note: 38 },
  { key: 'closedHat', label: 'CLOSED HAT', note: 42 },
  { key: 'openHat', label: 'OPEN HAT', note: 46 },
];
const PITCHES = Array.from({ length: 13 }, (_, index) => ({
  midi: 72 - index,
  label: ['C', 'B', 'A♯', 'A', 'G♯', 'G', 'F♯', 'F', 'E', 'D♯', 'D', 'C♯', 'C'][index],
}));
const INSTRUMENTS = {
  Bass: { type: 'bass', waveform: 'triangle', color: '#83e8e2' },
  Guitar: { type: 'guitar', waveform: 'sawtooth', color: '#f1a4d8' },
  Piano: { type: 'piano', waveform: 'sine', color: '#bca8ff' },
};
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export class StepSequencer {
  constructor(transport = null) {
    this.transport = transport;
    this.unsubscribeTransport = this.transport?.subscribe({ onStop: () => this.stop(false), onTempo: (bpm) => this.setTempo(bpm, false) });
    this.root = document.querySelector('#sequencer-panel');
    this.tracksRoot = document.querySelector('#sequencer-tracks');
    this.trackPrevious = document.querySelector('#sequencer-track-prev');
    this.trackNext = document.querySelector('#sequencer-track-next');
    this.trackPageLabel = document.querySelector('#sequencer-track-page');
    this.trackPage = 0;
    this.bpmInput = document.querySelector('#sequencer-bpm');
    this.meterTop = document.querySelector('#sequencer-meter-top');
    this.meterBottom = document.querySelector('#sequencer-meter-bottom');
    this.snapInput = document.querySelector('#sequencer-snap');
    this.lengthInput = document.querySelector('#sequencer-length');
    this.kitInput = document.querySelector('#sequencer-kit');
    this.playButton = document.querySelector('#sequencer-play');
    this.addDrumsButton = document.querySelector('#add-drum-track');
    this.addMelodicButton = document.querySelector('#add-melodic-track');
    this.instrumentInput = document.querySelector('#sequencer-instrument');
    this.status = document.querySelector('#sequencer-status');
    this.tracks = [];
    this.nextTrackId = 1;
    this.audioContext = null;
    this.noiseBuffer = null;
    this.running = false;
    this.timer = null;
    this.visualFrame = null;
    this.nextStepTime = 0;
    this.currentStep = -1;
    this.lastScheduledStep = -1;
    this.beatOrigin = 0;
    this.drag = null;
    this.onPointerMove = (event) => this.moveNote(event);
    this.onPointerUp = (event) => this.finishNote(event);
    this.playButton.addEventListener('click', () => this.running ? this.stop() : void this.play());
    this.trackPrevious.addEventListener('click', () => { this.trackPage = Math.max(0, this.trackPage - 1); this.render(); });
    this.trackNext.addEventListener('click', () => { this.trackPage += 1; this.render(); });
    this.addDrumsButton.addEventListener('click', () => this.addTrack('drums'));
    this.addMelodicButton.addEventListener('click', () => this.addTrack(this.instrumentInput.value));
    this.tracksRoot.addEventListener('click', (event) => this.onGridClick(event));
    this.tracksRoot.addEventListener('pointerdown', (event) => this.startNoteDrag(event));
    this.bpmInput.addEventListener('input', () => this.setTempo(this.bpmInput.value));
    this.meterTop.addEventListener('change', () => this.render());
    this.meterBottom.addEventListener('change', () => this.render());
    this.snapInput.addEventListener('change', () => this.render());
    this.lengthInput.addEventListener('change', () => this.render());
    this.kitInput.addEventListener('change', () => this.render());
    this.addTrack('drums');
    this.addTrack('Bass');
    this.addTrack('Piano');
  }

  setTempo(value, propagate = true) {
    const bpm = clamp(Number(value) || 96, 40, 220);
    this.bpmInput.value = String(bpm);
    if (propagate) this.transport?.setTempo(bpm);
    this.updateStatus();
  }

  get stepsPerBar() {
    return Math.max(1, Math.round(Number(this.meterTop.value) * 16 / Number(this.meterBottom.value)));
  }

  get snapSteps() {
    return Number(this.snapInput.value);
  }

  addTrack(instrument) {
    const id = this.nextTrackId++;
    const isDrums = instrument === 'drums';
    this.tracks.push({ id, instrument: isDrums ? 'Drum machine' : instrument, type: isDrums ? 'drums' : INSTRUMENTS[instrument].type, events: [] });
    this.trackPage = this.tracks.length - 1;
    this.render();
  }

  render() {
    const steps = this.stepsPerBar;
    for (const track of this.tracks) {
      for (const event of track.events) {
        event.step = clamp(event.step, 0, steps - 1);
        event.length = clamp(event.length, 1, steps - event.step);
      }
    }
    this.trackPage = Math.max(0, Math.min(this.trackPage, this.tracks.length - 1));
    const visibleTrack = this.tracks[this.trackPage];
    this.trackPageLabel.textContent = `${this.tracks.length ? this.trackPage + 1 : 0} / ${this.tracks.length} · ${visibleTrack?.instrument ?? 'No tracks'}`;
    this.trackPrevious.disabled = this.trackPage === 0;
    this.trackNext.disabled = this.trackPage >= this.tracks.length - 1;
    this.tracksRoot.style.setProperty('--steps', steps);
    this.tracksRoot.replaceChildren(...(visibleTrack ? [this.renderTrack(visibleTrack, steps)] : []));
    this.updatePlayhead();
    this.updateStatus();
  }

  renderTrack(track, steps) {
    const section = document.createElement('section');
    section.className = 'sequence-track';
    section.dataset.track = track.id;
    const header = document.createElement('header');
    header.className = 'sequence-track-header';
    const title = document.createElement('strong');
    title.textContent = track.instrument;
    const actions = document.createElement('div');
    actions.className = 'sequence-track-actions';
    if (track.type === 'drums') {
      const kit = document.createElement('span');
      kit.textContent = this.kitInput.selectedOptions[0]?.textContent ?? '808-inspired';
      actions.append(kit);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'track-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${track.instrument} layer`);
    remove.addEventListener('click', () => {
      this.tracks = this.tracks.filter(({ id }) => id !== track.id);
      this.trackPage = Math.max(0, Math.min(this.trackPage, this.tracks.length - 1));
      this.render();
    });
    actions.append(remove);
    header.append(title, actions);
    section.append(header);
    const rows = track.type === 'drums' ? DRUM_ROWS : PITCHES;
    for (const [rowIndex, row] of rows.entries()) {
      const line = document.createElement('div');
      line.className = `sequence-row${track.type === 'drums' ? ' drum-row' : ' piano-row'}`;
      line.dataset.track = track.id;
      line.dataset.row = String(rowIndex);
      line.dataset.note = track.type === 'drums' ? row.note : row.midi;
      const label = document.createElement('span');
      label.className = 'sequence-row-label';
      label.textContent = row.label;
      line.append(label);
      const grid = document.createElement('div');
      grid.className = 'sequence-grid';
      grid.style.setProperty('--steps', steps);
      grid.dataset.track = track.id;
      grid.dataset.row = String(rowIndex);
      for (let step = 0; step < steps; step += 1) {
        const cell = document.createElement('span');
        cell.className = `sequence-cell${step % 4 === 0 ? ' beat-cell' : ''}${step % 16 === 0 ? ' bar-cell' : ''}`;
        cell.dataset.step = String(step);
        grid.append(cell);
      }
      for (const event of track.events.filter((note) => note.row === rowIndex)) {
        const note = document.createElement('button');
        note.type = 'button';
        note.className = 'sequence-note';
        note.dataset.event = event.id;
        note.dataset.track = track.id;
        note.style.gridColumn = `${event.step + 1} / span ${event.length}`;
        note.style.setProperty('--note-color', track.type === 'drums' ? '#f4c47d' : INSTRUMENTS[track.instrument].color);
        note.setAttribute('aria-label', `${track.instrument}: ${row.label}, step ${event.step + 1}, length ${event.length} steps. Drag to move; drag edge to resize.`);
        const move = document.createElement('span');
        move.className = 'sequence-note-move';
        move.setAttribute('aria-hidden', 'true');
        const body = document.createElement('span');
        body.className = 'sequence-note-body';
        body.textContent = track.type === 'drums' ? row.label.replace('CLOSED ', 'C').replace('OPEN ', 'O') : row.label;
        const resize = document.createElement('span');
        resize.className = 'sequence-note-resize';
        resize.setAttribute('aria-hidden', 'true');
        note.append(move, body, resize);
        grid.append(note);
      }
      line.append(grid);
      section.append(line);
    }
    return section;
  }

  onGridClick(event) {
    if (event.target.closest('.track-remove, .sequence-note, .sequence-note-resize')) return;
    const cell = event.target.closest('.sequence-cell');
    if (!cell) return;
    const grid = cell.closest('.sequence-grid');
    const track = this.tracks.find(({ id }) => id === Number(grid.dataset.track));
    if (!track) return;
    const step = this.snap(Number(cell.dataset.step));
    const row = Number(grid.dataset.row);
    const note = track.events.find((item) => item.row === row && item.step === step);
    if (note) track.events = track.events.filter((item) => item !== note);
    else track.events.push({ id: `${track.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, row, step, length: Math.min(Number(this.lengthInput.value), this.stepsPerBar - step) });
    this.render();
  }

  snap(step) {
    return clamp(Math.round(step / this.snapSteps) * this.snapSteps, 0, this.stepsPerBar - 1);
  }

  startNoteDrag(event) {
    const noteElement = event.target.closest('.sequence-note');
    if (!noteElement || event.button !== 0) return;
    event.preventDefault();
    const track = this.tracks.find(({ id }) => id === Number(noteElement.dataset.track));
    const note = track?.events.find(({ id }) => id === noteElement.dataset.event);
    if (!note) return;
    const resizing = Boolean(event.target.closest('.sequence-note-resize'));
    const grid = noteElement.closest('.sequence-grid');
    const columnWidth = grid.getBoundingClientRect().width / this.stepsPerBar;
    const stepAtPointer = Math.floor((event.clientX - grid.getBoundingClientRect().left) / columnWidth);
    this.drag = { track, note, element: noteElement, grid, resizing, grabOffset: stepAtPointer - note.step, moved: false };
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp, { once: true });
  }

  moveNote(event) {
    if (!this.drag) return;
    const { track, note, element, grid, resizing, grabOffset } = this.drag;
    const rect = grid.getBoundingClientRect();
    const stepAtPointer = clamp(Math.floor((event.clientX - rect.left) / (rect.width / this.stepsPerBar)), 0, this.stepsPerBar - 1);
    const snapStep = this.snap(stepAtPointer);
    if (resizing) {
      const endStep = clamp(Math.ceil((stepAtPointer + 1) / this.snapSteps) * this.snapSteps, note.step + Math.min(this.snapSteps, this.stepsPerBar - note.step), this.stepsPerBar);
      note.length = endStep - note.step;
      element.style.gridColumn = `${note.step + 1} / span ${note.length}`;
    } else {
      const nextStep = clamp(this.snap(snapStep - grabOffset), 0, this.stepsPerBar - note.length);
      note.step = nextStep;
      const rows = [...this.tracksRoot.querySelectorAll(`.sequence-row[data-track="${track.id}"]`)];
      const targetRow = rows.find((row) => {
        const rowRect = row.getBoundingClientRect();
        return event.clientY >= rowRect.top && event.clientY <= rowRect.bottom;
      });
      if (targetRow) note.row = Number(targetRow.dataset.row);
      const targetGrid = this.tracksRoot.querySelector(`.sequence-grid[data-track="${track.id}"][data-row="${note.row}"]`);
      if (targetGrid) targetGrid.append(element);
      element.style.gridColumn = `${note.step + 1} / span ${note.length}`;
    }
    this.drag.moved = true;
  }

  finishNote() {
    if (!this.drag) return;
    window.removeEventListener('pointermove', this.onPointerMove);
    this.drag = null;
    this.render();
  }

  async ensureAudio() {
    if (this.transport) {
      await this.transport.ensureAudio();
      this.audioContext = this.transport.context;
    }
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
      this.audioContext = new AudioContextClass();
      const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate, this.audioContext.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
  }

  async play() {
    try {
      await this.ensureAudio();
      this.running = true;
      const origin = this.transport ? await this.transport.start() : this.audioContext.currentTime + 0.08;
      const elapsedSteps = Math.max(0, Math.ceil((this.audioContext.currentTime - origin) / this.stepDuration - 1e-8));
      this.currentStep = elapsedSteps % this.stepsPerBar;
      this.nextStepTime = origin + elapsedSteps * this.stepDuration;
      this.beatOrigin = origin;
      this.lastScheduledStep = -1;
      this.playButton.textContent = 'Stop';
      this.playButton.setAttribute('aria-pressed', 'true');
      this.timer = window.setInterval(() => this.scheduleAhead(), 20);
      this.scheduleAhead();
      this.animatePlayhead();
    } catch (error) {
      this.status.textContent = error.message || 'Could not start audio.';
    }
  }

  get stepDuration() {
    return 60 / Number(this.bpmInput.value) / 4;
  }

  scheduleAhead() {
    if (!this.running) return;
    const horizon = this.audioContext.currentTime + 0.12;
    while (this.nextStepTime < horizon) {
      const step = this.currentStep;
      for (const track of this.tracks) {
        for (const event of track.events) {
          if (event.step === step) this.playEvent(track, event, this.nextStepTime);
        }
      }
      this.lastScheduledStep = step;
      this.currentStep = (this.currentStep + 1) % this.stepsPerBar;
      this.nextStepTime += this.stepDuration;
    }
  }

  playEvent(track, event, time) {
    if (track.type === 'drums') {
      const drum = DRUM_ROWS[event.row]?.key;
      if (drum) this.playDrum(drum, time);
    } else {
      this.playNote(track, event, time);
    }
  }

  playDrum(drum, time) {
    const context = this.audioContext;
    const kit = KIT_BANKS[Number(this.kitInput.value)];
    const gain = context.createGain();
    const openHat = drum === 'openHat';
    const length = drum === 'kick' ? kit.decay + 0.12 : drum.includes('Hat') ? (openHat ? 0.2 : 0.055) : kit.decay;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(drum === 'kick' ? kit.kick : drum === 'snare' ? kit.snare : kit.hat, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    if (drum === 'kick') {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(145 * kit.tone, time);
      oscillator.frequency.exponentialRampToValueAtTime(42 * kit.tone, time + length);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + length + 0.01);
      return;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    source.buffer = this.noiseBuffer;
    filter.type = drum === 'snare' ? 'bandpass' : 'highpass';
    filter.frequency.value = drum === 'snare' ? 1800 * kit.tone : drum === 'openHat' ? 6500 : 8500;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(time);
    source.stop(time + length + 0.01);
  }

  playNote(track, event, time) {
    const context = this.audioContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = INSTRUMENTS[track.instrument].waveform;
    oscillator.frequency.value = 440 * 2 ** ((Number(PITCHES[event.row].midi) - 69) / 12);
    const duration = Math.max(0.04, event.length * this.stepDuration * 0.88);
    const volume = track.type === 'bass' ? 0.16 : track.type === 'guitar' ? 0.08 : 0.1;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    gain.gain.setValueAtTime(volume, time + Math.max(0.02, duration - 0.035));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.01);
  }

  animatePlayhead() {
    if (!this.running) return;
    const elapsed = Math.max(0, this.audioContext.currentTime - this.beatOrigin);
    const step = Math.floor(elapsed / this.stepDuration) % this.stepsPerBar;
    this.tracksRoot.dataset.playingStep = String(step);
    for (const grid of this.tracksRoot.querySelectorAll('.sequence-grid')) {
      for (const cell of grid.querySelectorAll('.sequence-cell')) cell.classList.toggle('current-step', Number(cell.dataset.step) === step);
    }
    this.visualFrame = requestAnimationFrame(() => this.animatePlayhead());
  }

  updatePlayhead() {
    if (!this.running) {
      this.tracksRoot.removeAttribute('data-playing-step');
      return;
    }
    this.tracksRoot.dataset.playingStep = String(this.lastScheduledStep);
    for (const grid of this.tracksRoot.querySelectorAll('.sequence-grid')) {
      for (const cell of grid.querySelectorAll('.sequence-cell')) cell.classList.toggle('current-step', Number(cell.dataset.step) === this.lastScheduledStep);
    }
  }

  updateStatus() {
    if (this.running) this.status.textContent = `${this.bpmInput.value} BPM · ${this.meterTop.value}/${this.meterBottom.value} · ${KIT_BANKS[Number(this.kitInput.value)].name}`;
    else this.status.textContent = 'Synthesized drum kits · loop one bar · add layers as needed';
  }

  get bpmInputValue() { return Number(this.bpmInput.value); }

  stop(fromTransport = true) {
    if (fromTransport && this.transport) { this.transport.stop(); return; }
    this.running = false;
    window.clearInterval(this.timer);
    this.timer = null;
    if (this.visualFrame !== null) cancelAnimationFrame(this.visualFrame);
    this.visualFrame = null;
    this.playButton.textContent = 'Play';
    this.playButton.setAttribute('aria-pressed', 'false');
    this.tracksRoot.removeAttribute('data-playing-step');
    for (const cell of this.tracksRoot.querySelectorAll('.current-step')) cell.classList.remove('current-step');
    this.updateStatus();
  }
}
