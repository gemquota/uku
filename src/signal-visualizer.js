const TRACE_COLOR = '#83e8e2';
const GRID_COLOR = 'rgba(188,168,255,.12)';
const NOTE_FLOOR_DB = -100;
const NOTE_CEILING_DB = -25;

export class SignalVisualizer {
  constructor(root) {
    this.traces = [...root.querySelectorAll('canvas[data-scope]')].map((canvas) => ({
      canvas,
      context: canvas.getContext('2d'),
      type: canvas.dataset.scope,
      width: 0,
      height: 0,
      pixelRatio: 1,
    }));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.traces.forEach(({ canvas }) => this.resizeObserver.observe(canvas));
    this.strings = [];
    this.state = { activeIndex: null, selectedIndex: null, cents: 0, tuned: false, amplitude: 0, frequency: null, sampleRate: 0 };
    this.animationFrame = null;
    this.spectrogramHistory = [];
    this.lastSpectrogramPaintAt = 0;
    this.spectrogramDirty = true;
    this.metrics = {
      rms: 0, peak: 0, snrDb: 0, hnrDb: 0, resolutionHz: 0, sampleRate: 0, fftSize: 0, bufferSize: 0,
    };
    this.onMetrics = () => {};
    this.resize();
  }

  resize() {
    for (const trace of this.traces) {
      const rect = trace.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      trace.width = rect.width;
      trace.height = rect.height;
      trace.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      trace.canvas.width = Math.round(rect.width * trace.pixelRatio);
      trace.canvas.height = Math.round(rect.height * trace.pixelRatio);
      trace.context.setTransform(trace.pixelRatio, 0, 0, trace.pixelRatio, 0, 0);
    }
  }

  render(timeData, frequencyData, sampleRate, audioInfo = {}) {
    let energy = 0;
    let peak = 0;
    for (let index = 0; index < timeData.length; index += 1) {
      energy += timeData[index] * timeData[index];
      peak = Math.max(peak, Math.abs(timeData[index]));
    }
    const rms = Math.sqrt(energy / timeData.length);
    const snrDb = this.estimateSignalNoiseRatio(frequencyData);
    const hnrDb = this.estimateHarmonicNoiseRatio(frequencyData, sampleRate, this.state.frequency);
    this.state.amplitude = rms;
    this.state.sampleRate = sampleRate;
    this.state.waveform = timeData;
    this.metrics = {
      rms, peak,
      snrDb: rms > 0.0001 ? snrDb : null,
      hnrDb: hnrDb === null || rms <= 0.0001 ? null : hnrDb,
      resolutionHz: sampleRate / Math.max(1, frequencyData.length * 2),
      sampleRate,
      fftSize: audioInfo.fftSize ?? timeData.length,
      bufferSize: audioInfo.bufferSize ?? timeData.length,
    };
    if (frequencyData?.length) {
      this.spectrogramHistory.push(new Float32Array(frequencyData));
      if (this.spectrogramHistory.length > 180) this.spectrogramHistory.shift();
      this.spectrogramDirty = true;
    }
    this.onMetrics({ ...this.metrics, frequency: this.state.frequency, confidence: this.state.confidence, stabilityCents: this.state.stabilityCents });
    for (const trace of this.traces) {
      if (!trace.width || !trace.height) this.resize();
      const { context, width, height, type } = trace;
      if (!width || !height) continue;
      if (type === 'psychedelic') continue;
      if (type === 'spectrogram') {
        const now = performance.now();
        if (this.spectrogramDirty && now - this.lastSpectrogramPaintAt >= 50) {
          this.drawSpectrogram(context, width, height);
          this.lastSpectrogramPaintAt = now;
          this.spectrogramDirty = false;
        }
        continue;
      }
      this.drawGrid(context, width, height);
      if (type === 'waveform') this.drawWaveform(context, timeData, width, height, false);
      else if (type === 'derivative') this.drawWaveform(context, timeData, width, height, true);
      else if (type === 'zoomed-waveform') this.drawWaveform(context, timeData, width, height, false, true);
      else if (type === 'strings') this.drawStrings(context, width, height);
      else this.drawSpectrum(context, frequencyData, sampleRate, width, height);
    }
    if (this.state.frequency) this.scheduleResonance();
  }

  setStrings(strings, selectedIndex = null) {
    this.strings = strings;
    this.state.selectedIndex = selectedIndex;
    this.state.activeIndex = null;
    this.state.cents = 0;
    this.state.tuned = false;
    this.state.frequency = null;
    this.state.confidence = 0;
    this.state.stabilityCents = 0;
    this.onMetrics({ ...this.metrics, frequency: null, confidence: null, stabilityCents: null });
    this.redrawStrings();
    const resonance = this.traces.find(({ type }) => type === 'psychedelic');
    if (resonance?.width && resonance.height) resonance.context.clearRect(0, 0, resonance.width, resonance.height);
  }

  setTuning({ frequency, activeIndex, cents, tuned, selectedIndex, confidence = this.state.confidence, stabilityCents = this.state.stabilityCents }) {
    this.state.frequency = frequency;
    this.state.confidence = confidence;
    this.state.stabilityCents = stabilityCents;
    this.onMetrics({ ...this.metrics, frequency, confidence, stabilityCents });
    this.state.activeIndex = activeIndex;
    this.state.cents = cents;
    this.state.tuned = tuned;
    this.state.selectedIndex = selectedIndex;
    this.redrawStrings();
    if (frequency && this.state.waveform) this.scheduleResonance();
    if (frequency === null) {
      const trace = this.traces.find(({ type }) => type === 'psychedelic');
      if (trace?.width && trace.height) trace.context.clearRect(0, 0, trace.width, trace.height);
    }
  }

  redrawStrings() {
    const trace = this.traces.find(({ type }) => type === 'strings');
    if (!trace?.width || !trace.height) return;
    trace.context.clearRect(0, 0, trace.width, trace.height);
    this.drawStrings(trace.context, trace.width, trace.height);
  }

  drawStrings(context, width, height) {
    if (!this.strings.length) return;
    const gap = height / this.strings.length;
    const selectedIndex = this.state.selectedIndex;
    for (const [index, string] of this.strings.entries()) {
      const y = gap * (index + 0.5);
      const active = this.state.activeIndex === index;
      const selected = selectedIndex === index;
      const cents = active ? this.state.cents : 0;
      const travel = Math.max(-1, Math.min(1, cents / 50));
      const left = 35;
      const right = width - 56;
      const center = left + (right - left) * (0.5 + travel * 0.39);
      context.beginPath();
      context.moveTo(30, y);
      context.lineTo(width - 8, y);
      context.strokeStyle = active && this.state.tuned ? 'rgba(131,232,226,.9)' : active ? 'rgba(241,164,216,.9)' : selected ? 'rgba(188,168,255,.72)' : 'rgba(188,168,255,.3)';
      context.lineWidth = active ? 2.5 : index === 0 || index === this.strings.length - 1 ? 1.2 : 1.7;
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = active ? 8 : 0;
      context.stroke();
      context.shadowBlur = 0;
      context.beginPath();
      context.arc(center, y, active ? 4.5 : 3, 0, Math.PI * 2);
      context.fillStyle = active && this.state.tuned ? '#83e8e2' : active ? '#f1a4d8' : '#bca8ff';
      context.fill();
      context.fillStyle = '#d8d1e6';
      context.font = '10px monospace';
      context.textAlign = 'left';
      context.fillText(`${index + 1}`, 4, y + 3);
      context.textAlign = 'right';
      context.fillStyle = active ? '#f2eff8' : '#89849a';
      context.fillText(string.note, width - 2, y + 3);
      context.textAlign = 'left';
    }
    const activeY = this.state.activeIndex === null ? null : gap * (this.state.activeIndex + 0.5);
    if (activeY !== null) {
      context.beginPath();
      context.moveTo(35, activeY - gap * 0.39);
      context.lineTo(35, activeY + gap * 0.39);
      context.strokeStyle = 'rgba(241,164,216,.78)';
      context.lineWidth = 2;
      context.stroke();
    }
  }

  scheduleResonance() {
    if (this.animationFrame !== null) return;
    this.animationFrame = requestAnimationFrame((timestamp) => {
      this.animationFrame = null;
      const trace = this.traces.find(({ type }) => type === 'psychedelic');
      if (!trace?.width || !trace.height || !this.state.frequency) return;
      this.drawResonance(trace.context, trace.width, trace.height, timestamp);
    });
  }

  drawResonance(context, width, height, timestamp) {
    const { frequency, cents, tuned, amplitude, activeIndex, sampleRate } = this.state;
    const hue = tuned ? 170 : 278 + Math.max(-40, Math.min(40, cents)) * 0.8;
    const phase = timestamp * 0.00022 * (0.65 + Math.min(1, amplitude * 12));
    const normalizedCents = Math.max(-1, Math.min(1, cents / 50));
    context.fillStyle = 'rgba(9,10,19,.28)';
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);
    context.globalCompositeOperation = 'lighter';
    const radius = Math.min(width, height) * (0.22 + Math.min(amplitude * 1.4, 0.16));
    const lobes = 3 + Math.round((frequency / 55 + (activeIndex ?? 0)) % 6);
    const normalizedSamples = sampleRate > 0 ? sampleRate / frequency : 0;
    for (let layer = 0; layer < 5; layer += 1) {
      const layerPhase = phase * (layer % 2 ? -0.7 : 1) + layer * 0.37 + normalizedCents * 0.9;
      context.beginPath();
      for (let step = 0; step <= 240; step += 1) {
        const angle = (step / 240) * Math.PI * 2;
        const waveIndex = normalizedSamples > 1 ? Math.floor(((step / 240) * normalizedSamples) % normalizedSamples) : 0;
        const waveValue = this.state.waveform?.[waveIndex] ?? 0;
        const overtone = 1 + 0.17 * Math.sin(angle * lobes + layerPhase)
          + 0.075 * Math.sin(angle * (lobes * 2 + 1) - layerPhase * 1.6)
          + 0.045 * Math.sin(angle * (lobes + 2) + phase * 1.5 + amplitude * 20)
          + waveValue * 0.1;
        const radiusAtAngle = radius * (0.58 + layer * 0.13) * overtone * (1 + Math.abs(normalizedCents) * Math.cos(angle + phase) * 0.12);
        const x = Math.cos(angle + phase * (layer % 2 ? 1 : -1)) * radiusAtAngle;
        const y = Math.sin(angle + phase * (layer % 2 ? 1 : -1)) * radiusAtAngle * (0.56 + Math.min(amplitude * 3, 0.28));
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.strokeStyle = `hsla(${hue + layer * 13}, ${tuned ? 83 : 76}%, ${62 - layer * 4}%, ${0.68 - layer * 0.08})`;
      context.lineWidth = layer === 0 ? 1.7 : 1.15;
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = 12 + layer * 2;
      context.stroke();
    }
    context.restore();
    context.globalCompositeOperation = 'source-over';
    context.shadowBlur = 0;
  }

  estimateNoiseFloor(frequencyData) {
    if (!frequencyData?.length) return -100;
    const values = [...frequencyData].sort((a, b) => a - b);
    return values[Math.floor(values.length * 0.2)];
  }

  estimateSignalNoiseRatio(frequencyData) {
    if (!frequencyData?.length) return null;
    const floorDb = this.estimateNoiseFloor(frequencyData);
    const noisePerBin = 10 ** (floorDb / 10);
    const totalPower = frequencyData.reduce((sum, value) => sum + 10 ** (value / 10), 0);
    const estimatedNoisePower = noisePerBin * frequencyData.length;
    const estimatedSignalPower = totalPower - estimatedNoisePower;
    if (estimatedSignalPower <= 0 || estimatedNoisePower <= 0) return null;
    return 10 * Math.log10(estimatedSignalPower / estimatedNoisePower);
  }

  estimateHarmonicNoiseRatio(frequencyData, sampleRate, fundamental) {
    if (!frequencyData?.length || !fundamental || fundamental <= 0) return null;
    const binHz = sampleRate / (frequencyData.length * 2);
    const harmonicBins = new Set();
    for (let harmonic = 1; harmonic <= 8; harmonic += 1) {
      const center = Math.round(fundamental * harmonic / binHz);
      if (center >= frequencyData.length) break;
      for (let bin = Math.max(1, center - 1); bin <= Math.min(frequencyData.length - 1, center + 1); bin += 1) harmonicBins.add(bin);
    }
    if (!harmonicBins.size || harmonicBins.size >= frequencyData.length - 1) return null;
    let harmonicPower = 0;
    let residualPower = 0;
    for (let bin = 1; bin < frequencyData.length; bin += 1) {
      const power = 10 ** (frequencyData[bin] / 10);
      if (harmonicBins.has(bin)) harmonicPower += power;
      else residualPower += power;
    }
    if (harmonicPower <= 0 || residualPower <= 0) return null;
    return 10 * Math.log10(harmonicPower / residualPower);
  }

  drawSpectrogram(context, width, height) {
    context.clearRect(0, 0, width, height);
    const history = this.spectrogramHistory;
    if (!history.length) return;
    const lowHz = 55;
    const highHz = Math.min(5000, this.state.sampleRate / 2);
    const logLow = Math.log(lowHz);
    const logRange = Math.log(highHz) - logLow;
    const columnWidth = width / history.length;
    for (let frameIndex = 0; frameIndex < history.length; frameIndex += 1) {
      const frame = history[frameIndex];
      const x = frameIndex * columnWidth;
      if (!frame?.length) continue;
      for (let y = 0; y < height; y += 1) {
        const frequency = Math.exp(logLow + (1 - y / height) * logRange);
        const bin = Math.min(frame.length - 1, Math.max(0, Math.round(frequency / (this.state.sampleRate / (frame.length * 2)))));
        const magnitude = Math.max(0, Math.min(1, (frame[bin] - NOTE_FLOOR_DB) / (NOTE_CEILING_DB - NOTE_FLOOR_DB)));
        if (magnitude > 0.03) {
          context.fillStyle = `hsla(${190 + magnitude * 115}, 85%, ${18 + magnitude * 48}%, ${0.18 + magnitude * 0.82})`;
          context.fillRect(x, y, Math.ceil(columnWidth) + 1, Math.max(1, height / 90));
        }
      }
    }
  }

  drawGrid(context, width, height) {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = GRID_COLOR;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, height / 2 + 0.5);
    context.lineTo(width, height / 2 + 0.5);
    for (let division = 1; division < 8; division += 1) {
      const x = Math.round((width * division) / 8) + 0.5;
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    context.stroke();
  }

  drawWaveform(context, samples, width, height, derivative, zoomed = false) {
    const middle = height / 2;
    const scale = height * 0.43;
    let peak = 0;
    if (derivative) {
      for (let i = 1; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i] - samples[i - 1]));
      if (peak < 0.00001) peak = 1;
    }
    const periodSamples = zoomed && this.state.frequency
      ? this.state.sampleRate / this.state.frequency
      : samples.length;
    const windowSamples = Math.min(samples.length, Math.max(2, periodSamples * (zoomed ? 2 : 1)));
    const start = samples.length - windowSamples;
    context.beginPath();
    for (let x = 0; x < width; x += 1) {
      const index = Math.min(samples.length - 1, Math.floor(start + (x / Math.max(1, width - 1)) * (windowSamples - 1)));
      const value = derivative ? (samples[Math.min(index + 1, samples.length - 1)] - samples[Math.max(0, index - 1)]) / (2 * peak) : samples[index];
      const y = middle - value * scale * (derivative ? 1 : 1.7);
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = derivative ? '#f1a4d8' : TRACE_COLOR;
    context.lineWidth = zoomed ? 2 : 1.5;
    context.shadowColor = context.strokeStyle;
    context.shadowBlur = zoomed ? 10 : 6;
    context.stroke();
    context.shadowBlur = 0;
  }

  drawSpectrum(context, frequencyData, sampleRate, width, height) {
    const minFrequency = 55;
    const maxFrequency = Math.min(1400, sampleRate / 2);
    const binFrequency = sampleRate / (frequencyData.length * 2);
    const minLog = Math.log(minFrequency);
    const logRange = Math.log(maxFrequency) - minLog;
    context.beginPath();
    for (let x = 0; x < width; x += 1) {
      const frequency = Math.exp(minLog + (x / Math.max(1, width - 1)) * logRange);
      const bin = Math.min(frequencyData.length - 1, Math.max(0, Math.round(frequency / binFrequency)));
      const decibels = frequencyData[bin];
      const normalized = Math.max(0, Math.min(1, (decibels + 92) / 76));
      const y = height - 2 - normalized * (height - 5);
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = TRACE_COLOR;
    context.lineWidth = 1.5;
    context.shadowColor = TRACE_COLOR;
    context.shadowBlur = 6;
    context.stroke();
    context.shadowBlur = 0;
  }

  clear() {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.state.frequency = null;
    this.state.confidence = 0;
    this.state.stabilityCents = 0;
    this.spectrogramHistory = [];
    this.lastSpectrogramPaintAt = 0;
    this.state.activeIndex = null;
    this.state.selectedIndex = null;
    this.state.cents = 0;
    this.state.tuned = false;
    this.state.amplitude = 0;
    this.state.waveform = null;
    this.state.confidence = 0;
    this.state.stabilityCents = 0;
    this.metrics = { rms: 0, peak: 0, snrDb: null, hnrDb: null, resolutionHz: 0, sampleRate: 0, fftSize: 0, bufferSize: 0 };
    this.onMetrics({ ...this.metrics, frequency: null, confidence: null, stabilityCents: null });
    for (const { context, width, height } of this.traces) {
      if (width && height) context.clearRect(0, 0, width, height);
    }
  }
}
