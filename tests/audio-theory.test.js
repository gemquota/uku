import test from 'node:test';
import assert from 'node:assert/strict';
import { PitchDetector } from '../src/pitch-detector.js';
import { SCALE_DATABASE, scaleNotes, scaleMidi } from '../src/scale-atlas.js';

function tone(frequency, sampleRate = 48000, length = 4096) {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const time = i / sampleRate;
    samples[i] = 0.65 * Math.sin(2 * Math.PI * frequency * time)
      + 0.22 * Math.sin(4 * Math.PI * frequency * time)
      + 0.08 * Math.sin(6 * Math.PI * frequency * time);
  }
  return samples;
}

test('YIN detector tracks fundamentals across ukulele, guitar and piano ranges', () => {
  const detector = new PitchDetector(() => {}, () => {});
  for (const frequency of [55, 82.41, 110, 196, 261.63, 440, 659.25, 880]) {
    const result = detector.detectYin(tone(frequency), 48000);
    assert.ok(result.confidence >= 0.70, `confidence too low at ${frequency} Hz`);
    const cents = Math.abs(1200 * Math.log2(result.frequency / frequency));
    assert.ok(cents < 8, `${frequency} Hz was detected ${cents.toFixed(1)} cents away`);
  }
});

test('YIN detector rejects silence', () => {
  const detector = new PitchDetector(() => {}, () => {});
  const result = detector.detectYin(new Float32Array(4096), 48000);
  assert.equal(result.frequency, -1);
  assert.equal(result.confidence, 0);
});

test('scale atlas contains valid octave-bounded interval structures', () => {
  assert.ok(SCALE_DATABASE.length >= 40);
  for (const scale of SCALE_DATABASE) {
    assert.equal(scale.intervals[0], 0);
    assert.equal(scale.cardinality, scale.intervals.length);
    assert.equal(new Set(scale.intervals).size, scale.cardinality);
    assert.ok(scale.intervals.every((value) => Number.isInteger(value) && value >= 0 && value < 12));
    assert.ok(scale.steps.every((value) => Number.isInteger(value) && value > 0));
    assert.equal(scale.steps.reduce((sum, value) => sum + value, 0), 12);
  }
});

test('D Dorian resolves to the expected pitch collection', () => {
  const dorian = SCALE_DATABASE.find((scale) => scale.collection === 'major' && scale.name === 'Dorian');
  assert.deepEqual(scaleNotes(dorian, 2), ['D', 'E', 'F', 'G', 'A', 'B', 'C']);
});

test('scale MIDI output preserves intervals and spans the octave boundary', () => {
  const major = SCALE_DATABASE.find((scale) => scale.collection === 'major' && scale.name === 'Ionian');
  const midi = scaleMidi(major, 0, 4);
  assert.deepEqual(midi, [60, 62, 64, 65, 67, 69, 71]);
});
