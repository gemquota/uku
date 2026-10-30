export class Metronome {
  constructor(transport = null) {
    this.transport = transport;
    this.unsubscribeTransport = this.transport?.subscribe({ onStop: () => this.stop(false), onTempo: (bpm) => this.setTempo(bpm, false) });
    this.bpmInput = document.querySelector('#tempo-slider');
    this.bpmValue = document.querySelector('#tempo-value');
    this.startButton = document.querySelector('#metronome-toggle');
    this.tapButton = document.querySelector('#tap-tempo');
    this.beatDots = [...document.querySelectorAll('.beat-dot')];
    this.beatCount = document.querySelector('#beat-count');
    this.soundToggle = document.querySelector('#metronome-sound');
    this.hint = document.querySelector('#tempo-hint');
    this.bpm = 96;
    this.running = false;
    this.soundOn = true;
    this.nextBeatTime = 0;
    this.beatNumber = 0;
    this.tapTimes = [];
    this.timer = null;
    this.visualFrame = null;
    this.audioContext = null;
    this.scheduledBeat = null;
    this.bpmInput.addEventListener('input', () => this.setTempo(Number(this.bpmInput.value)));
    this.startButton.addEventListener('click', () => this.running ? this.stop() : void this.start());
    this.tapButton.addEventListener('click', () => this.tap());
    this.soundToggle.addEventListener('click', () => this.setSound(!this.soundOn));
    this.updateDisplay();
  }

  setTempo(bpm, propagate = true) {
    this.bpm = Math.max(40, Math.min(220, Math.round(bpm)));
    if (propagate) this.transport?.setTempo(this.bpm);
    this.updateDisplay();
  }

  updateDisplay() {
    this.bpmInput.value = String(this.bpm);
    this.bpmInput.setAttribute('aria-valuetext', `${this.bpm} beats per minute`);
    this.bpmValue.textContent = String(this.bpm);
    this.bpmValue.setAttribute('aria-label', `${this.bpm} beats per minute`);
  }

  async ensureAudio() {
    if (this.transport) {
      await this.transport.ensureAudio();
      this.audioContext = this.transport.context;
      return;
    }
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is not available in this browser.');
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
  }

  async start() {
    try {
      await this.ensureAudio();
      const origin = this.transport ? await this.transport.start() : this.audioContext.currentTime + 0.08;
      this.running = true;
      const beatDuration = 60 / this.bpm;
      const elapsedBeats = Math.max(0, Math.ceil((this.audioContext.currentTime - origin) / beatDuration - 1e-8));
      this.beatNumber = elapsedBeats % 4;
      this.nextBeatTime = origin + elapsedBeats * beatDuration;
      this.startButton.textContent = 'Stop metronome';
      this.startButton.setAttribute('aria-pressed', 'true');
      this.hint.textContent = 'Follow the pulse. Adjust the tempo anytime.';
      this.timer = window.setInterval(() => this.scheduleAhead(), 25);
      this.scheduleAhead();
      this.animateBeat();
    } catch (error) {
      this.hint.textContent = error.message || 'Could not start the metronome.';
    }
  }

  scheduleAhead() {
    if (!this.running || !this.audioContext) return;
    const horizon = this.audioContext.currentTime + 0.12;
    while (this.nextBeatTime < horizon) {
      const time = this.nextBeatTime;
      const beat = this.beatNumber;
      if (this.soundOn) this.scheduleClick(time, beat === 0);
      this.scheduledBeat = { time, beat };
      this.beatNumber = (this.beatNumber + 1) % 4;
      this.nextBeatTime += 60 / this.bpm;
    }
  }

  scheduleClick(time, accented) {
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(accented ? 1180 : 840, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accented ? 0.19 : 0.12, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.05);
  }

  animateBeat() {
    if (!this.running) return;
    const currentTime = this.audioContext.currentTime;
    if (this.scheduledBeat && currentTime >= this.scheduledBeat.time) {
      this.flashBeat(this.scheduledBeat.beat);
      this.scheduledBeat = null;
    }
    this.visualFrame = requestAnimationFrame(() => this.animateBeat());
  }

  flashBeat(beat) {
    this.beatDots.forEach((dot, index) => dot.classList.toggle('active', index === beat));
    this.beatCount.textContent = `BEAT ${beat + 1} OF 4`;
  }

  setSound(enabled) {
    this.soundOn = enabled;
    this.soundToggle.setAttribute('aria-pressed', String(enabled));
    this.soundToggle.textContent = enabled ? 'Sound on' : 'Sound off';
    this.hint.textContent = enabled ? 'Audio click is on. Follow the visual pulse.' : 'Audio click is off. Follow the visual pulse.';
  }

  tap() {
    const now = performance.now();
    this.tapTimes = this.tapTimes.filter((time) => now - time < 2500);
    if (this.tapTimes.length && now - this.tapTimes.at(-1) < 200) return;
    this.tapTimes.push(now);
    if (this.tapTimes.length > 6) this.tapTimes.shift();
    if (this.tapTimes.length >= 2) {
      const intervals = this.tapTimes.slice(1).map((time, index) => time - this.tapTimes[index]);
      const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      this.setTempo(Math.round(60000 / average));
      this.hint.textContent = `Tap tempo set to ${this.bpm} BPM.`;
    } else {
      this.hint.textContent = 'Tap a few more times to find your tempo.';
    }
  }

  stop(fromTransport = true) {
    if (fromTransport && this.transport) { this.transport.stop(); return; }
    this.running = false;
    window.clearInterval(this.timer);
    this.timer = null;
    if (this.visualFrame !== null) cancelAnimationFrame(this.visualFrame);
    this.visualFrame = null;
    this.scheduledBeat = null;
    this.startButton.textContent = 'Start metronome';
    this.startButton.setAttribute('aria-pressed', 'false');
    this.beatDots.forEach((dot) => dot.classList.remove('active'));
    this.beatCount.textContent = 'READY';
  }
}
