export class PitchDetector {
  constructor(onPitch, onSilence, onSignal = () => {}) {
    this.onPitch = onPitch;
    this.onSilence = onSilence;
    this.onSignal = onSignal;
    this.pitchHistory = [];
    this.lastConfidence = 0;
    this.fftSize = 4096;
    this.context = null;
    this.stream = null;
    this.frame = null;
    this.active = false;
    this.lastDetectedAt = 0;
    this.lastReportAt = 0;
    this.buffer = null;
    this.analyser = null;
    this.source = null;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access needs a supported browser and a secure connection (HTTPS).');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      throw new Error('This browser does not support live audio analysis.');
    }
    try {
      this.context = new AudioContextClass();
      await this.context.resume();
      const source = this.context.createMediaStreamSource(this.stream);
      this.source = source;
      const analyser = this.context.createAnalyser();
      this.analyser = analyser;
      analyser.fftSize = this.fftSize;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      this.buffer = new Float32Array(analyser.fftSize);
      this.frequencyBuffer = new Float32Array(analyser.frequencyBinCount);
      this.active = true;
      this.loop(analyser);
    } catch (error) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      await this.context?.close();
      this.context = null;
      throw error;
    }
  }

  loop(analyser) {
    if (!this.active) return;
    analyser.getFloatTimeDomainData(this.buffer);
    analyser.getFloatFrequencyData(this.frequencyBuffer);
    this.onSignal(this.buffer, this.frequencyBuffer, this.context.sampleRate, { fftSize: analyser.fftSize, bufferSize: this.buffer.length, binCount: analyser.frequencyBinCount });
    const detectedFrequency = this.autoCorrelate(this.buffer, this.context.sampleRate);
    const now = performance.now();
    if (detectedFrequency > 0) {
      this.lastDetectedAt = now;
      if (now - this.lastReportAt > 65) {
        this.lastReportAt = now;
        this.pitchHistory.push(detectedFrequency);
        if (this.pitchHistory.length > 40) this.pitchHistory.shift();
        const mean = this.pitchHistory.reduce((sum, value) => sum + value, 0) / this.pitchHistory.length;
        const variance = this.pitchHistory.reduce((sum, value) => sum + (value - mean) ** 2, 0) / this.pitchHistory.length;
        const stabilityCents = this.pitchHistory.length > 1
          ? 1200 * Math.log2(1 + Math.sqrt(variance) / mean)
          : 0;
        this.onPitch(detectedFrequency, {
          confidence: this.lastConfidence,
          stabilityCents,
        });
      }
    } else if (now - this.lastDetectedAt > 850) {
      this.onSilence();
      this.lastDetectedAt = now;
    }
    this.frame = requestAnimationFrame(() => this.loop(analyser));
  }

  setFftSize(fftSize) {
    const supported = [2048, 4096, 8192];
    if (!supported.includes(fftSize)) throw new RangeError('FFT size must be 2048, 4096, or 8192 samples.');
    this.fftSize = fftSize;
    if (!this.active || !this.analyser) return;
    this.analyser.fftSize = fftSize;
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.frequencyBuffer = new Float32Array(this.analyser.frequencyBinCount);
    this.resetPitchHistory();
  }

  resetPitchHistory() {
    this.pitchHistory = [];
    this.lastConfidence = 0;
    this.lastReportAt = 0;
  }

  autoCorrelate(buffer, sampleRate) {
    const downsample = 4;
    const length = Math.floor(buffer.length / downsample);
    const signal = new Float32Array(length);
    let mean = 0;
    let rootMeanSquare = 0;
    for (let i = 0; i < length; i += 1) {
      let sample = 0;
      for (let offset = 0; offset < downsample; offset += 1) sample += buffer[i * downsample + offset];
      signal[i] = sample / downsample;
      mean += signal[i];
      rootMeanSquare += signal[i] * signal[i];
    }
    rootMeanSquare = Math.sqrt(rootMeanSquare / length);
    if (rootMeanSquare < 0.008) return -1;
    mean /= length;
    for (let i = 0; i < length; i += 1) signal[i] -= mean;

    const effectiveRate = sampleRate / downsample;
    const minLag = Math.max(2, Math.floor(effectiveRate / 1200));
    const maxLag = Math.min(length - 2, Math.ceil(effectiveRate / 55));
    if (!this.difference || this.difference.length <= maxLag) {
      this.difference = new Float32Array(maxLag + 1);
      this.normalizedDifference = new Float32Array(maxLag + 1);
    }
    let cumulativeDifference = 0;
    const comparisonLength = length - maxLag;
    for (let lag = 1; lag <= maxLag; lag += 1) {
      let difference = 0;
      for (let i = 0; i < comparisonLength; i += 1) {
        const delta = signal[i] - signal[i + lag];
        difference += delta * delta;
      }
      this.difference[lag] = difference;
      cumulativeDifference += difference;
      this.normalizedDifference[lag] = lag * difference / cumulativeDifference;
    }

    const threshold = 0.16;
    let bestLag = -1;
    for (let lag = minLag; lag < maxLag; lag += 1) {
      if (this.normalizedDifference[lag] < threshold) {
        while (lag + 1 < maxLag && this.normalizedDifference[lag + 1] < this.normalizedDifference[lag]) lag += 1;
        bestLag = lag;
        break;
      }
    }
    if (bestLag < 0) {
      let bestDifference = Infinity;
      for (let lag = minLag; lag <= maxLag; lag += 1) {
        if (this.normalizedDifference[lag] < bestDifference) {
          bestDifference = this.normalizedDifference[lag];
          bestLag = lag;
        }
      }
      if (bestDifference > 0.3) return -1;
    }

    // Prefer the longer period when a strong overtone masks the fundamental.
    while (bestLag * 2 < maxLag && this.normalizedDifference[bestLag * 2] < threshold
      && this.normalizedDifference[bestLag * 2] < this.normalizedDifference[bestLag] * 0.8) {
      bestLag *= 2;
    }
    this.lastConfidence = Math.max(0, Math.min(1, 1 - this.normalizedDifference[bestLag]));
    const left = this.normalizedDifference[Math.max(minLag, bestLag - 1)];
    const center = this.normalizedDifference[bestLag];
    const right = this.normalizedDifference[Math.min(maxLag, bestLag + 1)];
    const curvature = left - 2 * center + right;
    const correction = curvature ? 0.5 * (left - right) / curvature : 0;
    return effectiveRate / (bestLag + correction);
  }

  async stop() {
    this.active = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
    this.buffer = null;
    this.frequencyBuffer = null;
    this.difference = null;
    this.normalizedDifference = null;
    this.analyser = null;
    this.source = null;
    this.resetPitchHistory();
  }
}
