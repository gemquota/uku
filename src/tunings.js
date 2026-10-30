export const tunings = {
  standard: {
    label: 'Standard · High G',
    strings: [
      { note: 'G4', midi: 67, name: 'G', octave: 4, frequency: 392.0 },
      { note: 'C4', midi: 60, name: 'C', octave: 4, frequency: 261.63 },
      { note: 'E4', midi: 64, name: 'E', octave: 4, frequency: 329.63 },
      { note: 'A4', midi: 69, name: 'A', octave: 4, frequency: 440.0 },
    ],
  },
  'low-g': {
    label: 'Low G',
    strings: [
      { note: 'G3', midi: 55, name: 'G', octave: 3, frequency: 196.0 },
      { note: 'C4', midi: 60, name: 'C', octave: 4, frequency: 261.63 },
      { note: 'E4', midi: 64, name: 'E', octave: 4, frequency: 329.63 },
      { note: 'A4', midi: 69, name: 'A', octave: 4, frequency: 440.0 },
    ],
  },
  'd-tuning': {
    label: 'D tuning',
    strings: [
      { note: 'A4', midi: 69, name: 'A', octave: 4, frequency: 440.0 },
      { note: 'D4', midi: 62, name: 'D', octave: 4, frequency: 293.66 },
      { note: 'F#4', midi: 66, name: 'F♯', octave: 4, frequency: 369.99 },
      { note: 'B4', midi: 71, name: 'B', octave: 4, frequency: 493.88 },
    ],
  },
  baritone: {
    label: 'Baritone · D-G-B-E',
    strings: [
      { note: 'D3', midi: 50, name: 'D', octave: 3, frequency: 146.83 },
      { note: 'G3', midi: 55, name: 'G', octave: 3, frequency: 196.0 },
      { note: 'B3', midi: 59, name: 'B', octave: 3, frequency: 246.94 },
      { note: 'E4', midi: 64, name: 'E', octave: 4, frequency: 329.63 },
    ],
  },
  chromatic: {
    label: 'Chromatic',
    strings: [
      { note: 'G4', midi: 67, name: 'G', octave: 4, frequency: 392.0 },
      { note: 'C4', midi: 60, name: 'C', octave: 4, frequency: 261.63 },
      { note: 'E4', midi: 64, name: 'E', octave: 4, frequency: 329.63 },
      { note: 'A4', midi: 69, name: 'A', octave: 4, frequency: 440.0 },
    ],
  },
};

export const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function frequencyToNote(frequency, referenceA4 = 440) {
  const midi = 69 + 12 * Math.log2(frequency / referenceA4);
  const roundedMidi = Math.round(midi);
  const pitchClass = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const targetFrequency = referenceA4 * 2 ** ((roundedMidi - 69) / 12);
  const cents = Math.round(1200 * Math.log2(frequency / targetFrequency));
  return {
    name: noteNames[pitchClass],
    octave,
    midi: roundedMidi,
    targetFrequency,
    cents,
  };
}

export function findNearestString(midi, strings) {
  return strings.reduce((nearest, string) => {
    const distance = Math.abs(string.midi - midi);
    return !nearest || distance < nearest.distance ? { string, distance } : nearest;
  }, null)?.string ?? null;
}

export function frequencyForMidi(midi, referenceA4 = 440) {
  return referenceA4 * 2 ** ((midi - 69) / 12);
}

export function findNearestStringByFrequency(frequency, strings, referenceA4 = 440) {
  return strings.reduce((nearest, string) => {
    const targetFrequency = frequencyForMidi(string.midi, referenceA4);
    const cents = Math.abs(1200 * Math.log2(frequency / targetFrequency));
    return !nearest || cents < nearest.cents ? { string, cents } : nearest;
  }, null)?.string ?? null;
}
