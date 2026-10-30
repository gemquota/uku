export class PitchDetector {
  constructor(onPitch, onSilence) {
    this.onPitch = onPitch;
    this.onSilence = onSilence;
    this.context = null;
    this.stream = null;
    this.frame = null;
    this.active = false;
    this.lastDetectedAt = 0;
    this.lastReportAt = 0;
    this.buffer = null;
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
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      this.buffer = new Float32Array(analyser.fftSize);
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
    const detectedFrequency = this.autoCorrelate(this.buffer, this.context.sampleRate);
    const now = performance.now();
    if (detectedFrequency > 0) {
      this.lastDetectedAt = now;
      if (now - this.lastReportAt > 65) {
        this.lastReportAt = now;
        this.onPitch(detectedFrequency);
      }
    } else if (now - this.lastDetectedAt > 850) {
      this.onSilence();
      this.lastDetectedAt = now;
    }
    this.frame = requestAnimationFrame(() => this.loop(analyser));
  }

  autoCorrelate(buffer, sampleRate) {
    const downsample = 4;
    const length = Math.floor(buffer.length / downsample);
    const signal = new Float32Array(length);
    let mean = 0;
    let rootMeanSquare = 0;
    for (let i = 0; i < length; i += 1) {
      signal[i] = buffer[i * downsample];
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
    const correlations = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let cross = 0;
      let energyA = 0;
      let energyB = 0;
      for (let i = 0; i < length - lag; i += 1) {
        const a = signal[i];
        const b = signal[i + lag];
        cross += a * b;
        energyA += a * a;
        energyB += b * b;
      }
      correlations[lag] = cross / Math.sqrt(energyA * energyB);
    }
    let bestLag = -1;
    for (let lag = minLag + 1; lag < maxLag; lag += 1) {
      if (correlations[lag] >= 0.9 && correlations[lag] >= correlations[lag - 1] && correlations[lag] > correlations[lag + 1]) {
        bestLag = lag;
        break;
      }
    }
    if (bestLag < 1) return -1;
    const left = correlations[Math.max(minLag, bestLag - 1)];
    const center = correlations[bestLag];
    const right = correlations[Math.min(maxLag, bestLag + 1)];
    const curvature = (left + right - 2 * center) / 2;
    const correction = curvature ? (left - right) / (4 * curvature) : 0;
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
  }
}
