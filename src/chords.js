const roots = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const openStringMidi = [67, 60, 64, 69];

export const chordQualities = [
  { key: 'major', label: 'Major', suffix: '', intervals: [0, 4, 7] },
  { key: 'minor', label: 'Minor', suffix: 'm', intervals: [0, 3, 7] },
  { key: '7', label: 'Dominant 7th', suffix: '7', intervals: [0, 4, 7, 10] },
  { key: 'maj7', label: 'Major 7th', suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { key: 'm7', label: 'Minor 7th', suffix: 'm7', intervals: [0, 3, 7, 10] },
  { key: '6', label: 'Sixth', suffix: '6', intervals: [0, 4, 7, 9] },
  { key: 'sus4', label: 'Suspended 4th', suffix: 'sus4', intervals: [0, 5, 7] },
  { key: 'dim', label: 'Diminished', suffix: 'dim', intervals: [0, 3, 6] },
  { key: 'aug', label: 'Augmented', suffix: 'aug', intervals: [0, 4, 8] },
];

function findVoicing(root, intervals) {
  const allowed = new Set(intervals.map((interval) => (root + interval) % 12));
  const required = intervals.length;
  let best = null;
  const frets = [];
  const pitches = [];

  function visit(stringIndex) {
    if (stringIndex === openStringMidi.length) {
      const covered = new Set(pitches);
      if (covered.size !== required || [...allowed].some((pitch) => !covered.has(pitch))) return;
      const maxFret = Math.max(...frets);
      const minFret = Math.min(...frets.filter((fret) => fret > 0), maxFret);
      const spread = maxFret - minFret;
      if (spread > 3) return;
      const score = maxFret * 4 + frets.reduce((sum, fret) => sum + fret, 0) * 0.3 + spread * 0.5;
      if (!best || score < best.score) best = { score, frets: [...frets] };
      return;
    }
    for (let fret = 0; fret <= 7; fret += 1) {
      const pitch = (openStringMidi[stringIndex] + fret) % 12;
      if (!allowed.has(pitch)) continue;
      frets.push(fret);
      pitches.push(pitch);
      visit(stringIndex + 1);
      pitches.pop();
      frets.pop();
    }
  }

  visit(0);
  return best?.frets ?? null;
}

function assignFingers(frets) {
  const fretted = [...new Set(frets.filter((fret) => fret > 0))].sort((a, b) => a - b);
  return frets.map((fret) => (fret === 0 ? 0 : fretted.indexOf(fret) + 1));
}

export const chords = roots.flatMap((rootName, rootIndex) => chordQualities.map((quality) => {
  const frets = findVoicing(rootIndex, quality.intervals);
  if (!frets) return null;
  const notes = [...new Set(quality.intervals.map((interval) => roots[(rootIndex + interval) % 12]))];
  return {
    id: `${rootName}-${quality.key}`,
    name: `${rootName}${quality.suffix}`,
    root: rootName,
    rootIndex,
    quality: quality.key,
    qualityLabel: quality.label,
    frets,
    fingers: assignFingers(frets),
    notes,
  };
})).filter(Boolean);

export const chordRoots = roots;
