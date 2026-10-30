import { chords, chordRoots } from './chords.js';

const strings = [
  { name: 'G', midi: 67 },
  { name: 'C', midi: 60 },
  { name: 'E', midi: 64 },
  { name: 'A', midi: 69 },
];
const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const notePitch = new Map(noteNames.map((note, index) => [note, index]));
const positions = 13;
const scales = {
  major: { label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'Natural minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  'major-pentatonic': { label: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
  'minor-pentatonic': { label: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  blues: { label: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  dorian: { label: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
};

function pitchAt(midi) {
  return `${noteNames[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export class ChordIdentifier {
  constructor() {
    this.grid = document.querySelector('#fretboard-map');
    this.results = document.querySelector('#identifier-results');
    this.clearButton = document.querySelector('#identifier-clear');
    this.summary = document.querySelector('#identifier-summary');
    this.caption = document.querySelector('#fretboard-caption');
    this.status = document.querySelector('#fretboard-status');
    this.scaleRoot = document.querySelector('#scale-root');
    this.scaleType = document.querySelector('#scale-type');
    this.scaleNotes = document.querySelector('#scale-notes');
    this.pagePrevious = document.querySelector('#identifier-page-prev');
    this.pageNext = document.querySelector('#identifier-page-next');
    this.pageLabel = document.querySelector('#identifier-page-label');
    this.page = 0;
    this.pageSize = 3;
    this.modeButtons = [...document.querySelectorAll('[data-board-mode]')];
    this.selection = Array(strings.length).fill(null);
    this.onChordSelect = () => {};
    this.mode = 'chord';
    this.chord = null;
    this.scaleRoot.replaceChildren(...chordRoots.map((root) => {
      const option = document.createElement('option');
      option.value = root;
      option.textContent = root;
      option.selected = root === 'C';
      return option;
    }));
    this.scaleType.querySelector('option').selected = true;
    this.modeButtons.forEach((button) => button.addEventListener('click', () => {
      this.mode = button.dataset.boardMode;
      this.modeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      document.querySelector('#identify-section').hidden = this.mode !== 'identify';
      document.querySelector('#scale-section').hidden = this.mode !== 'scale';
      document.querySelector('#theory-panel').dataset.mode = this.mode;
      this.render();
    }));
    this.scaleRoot.addEventListener('change', () => this.render());
    this.scaleType.addEventListener('change', () => this.render());
    this.clearButton.addEventListener('click', () => {
      this.selection.fill(null);
      this.page = 0;
      this.render();
    });
    this.pagePrevious.addEventListener('click', () => { this.page = Math.max(0, this.page - 1); this.render(); });
    this.pageNext.addEventListener('click', () => { this.page += 1; this.render(); });
    this.renderGrid();
  }

  setChord(chord, activate = false) {
    this.chord = chord;
    if (activate) {
      this.mode = 'chord';
      this.modeButtons.forEach((button) => {
        const active = button.dataset.boardMode === 'chord';
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      document.querySelector('#fretboard-section').hidden = false;
      document.querySelector('#identify-section').hidden = true;
      document.querySelector('#scale-section').hidden = true;
      document.querySelector('#theory-panel').dataset.mode = 'chord';
    }
    this.render();
  }

  renderGrid() {
    this.grid.replaceChildren();
    this.grid.style.setProperty('--fret-count', positions);
    const corner = document.createElement('span');
    corner.className = 'identifier-corner';
    corner.textContent = 'STRING';
    this.grid.append(corner);
    for (let fret = 0; fret < positions; fret += 1) {
      const heading = document.createElement('span');
      heading.className = 'fret-heading';
      heading.textContent = fret === 0 ? 'OPEN' : String(fret);
      this.grid.append(heading);
    }
    for (const [stringIndex, string] of strings.entries()) {
      const label = document.createElement('span');
      label.className = 'identifier-string-label';
      label.textContent = string.name;
      this.grid.append(label);
      for (let fret = 0; fret < positions; fret += 1) {
        const midi = string.midi + fret;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `fretboard-note${fret === 0 ? ' open-note' : ''}`;
        button.dataset.string = stringIndex;
        button.dataset.fret = fret;
        button.dataset.midi = midi;
        button.setAttribute('aria-label', `${string.name} string, ${fret === 0 ? 'open' : `fret ${fret}`}: ${pitchAt(midi)}`);
        button.setAttribute('aria-pressed', 'false');
        button.textContent = noteNames[midi % 12];
        button.addEventListener('click', () => {
          if (this.mode !== 'identify') return;
          this.selection[stringIndex] = this.selection[stringIndex] === midi ? null : midi;
          this.render();
        });
        this.grid.append(button);
      }
    }
    this.render();
  }

  rankMatches() {
    const selected = this.selection.filter((midi) => midi !== null);
    const pitches = new Set(selected.map((midi) => midi % 12));
    if (!pitches.size) return [];
    return chords.map((chord) => {
      const chordPitches = new Set(chord.notes.map((note) => notePitch.get(note)));
      const common = [...pitches].filter((pitch) => chordPitches.has(pitch)).length;
      const precision = common / pitches.size;
      const completeness = common / chordPitches.size;
      const rootBonus = pitches.has(notePitch.get(chord.root)) ? 0.04 : 0;
      const fit = Math.round(Math.min(1, precision * 0.56 + completeness * 0.44 + rootBonus) * 100);
      return { chord, fit, common, precision, completeness };
    }).filter(({ common }) => common > 0)
      .sort((a, b) => b.fit - a.fit || b.completeness - a.completeness || a.chord.name.localeCompare(b.chord.name))
      .slice(0, 12);
  }

  render() {
    const chordPitches = new Set(this.chord?.notes.map((note) => notePitch.get(note)) ?? []);
    const chordFrets = this.chord?.frets ?? [];
    const scale = scales[this.scaleType.value];
    const rootPitch = notePitch.get(this.scaleRoot.value);
    const scalePitches = new Set(scale.intervals.map((interval) => (rootPitch + interval) % 12));
    for (const button of this.grid.querySelectorAll('.fretboard-note')) {
      const row = Number(button.dataset.string);
      const fret = Number(button.dataset.fret);
      const midi = Number(button.dataset.midi);
      const pitch = midi % 12;
      const selected = this.selection[row] === midi;
      const chordTone = chordPitches.has(pitch);
      const voicing = chordFrets[row] === fret;
      const scaleTone = scalePitches.has(pitch);
      button.classList.toggle('selected', this.mode === 'identify' && selected);
      button.classList.toggle('chord-tone', this.mode === 'chord' && chordTone);
      button.classList.toggle('chord-voicing', this.mode === 'chord' && voicing);
      button.classList.toggle('scale-tone', this.mode === 'scale' && scaleTone);
      button.classList.toggle('scale-root', this.mode === 'scale' && scaleTone && pitch === rootPitch);
      button.disabled = this.mode !== 'identify';
      button.setAttribute('aria-pressed', String(this.mode === 'identify' && selected));
    }
    const chordName = this.chord?.name ?? 'No chord selected';
    this.caption.textContent = this.mode === 'chord'
      ? `${this.chord ? `All positions in ${chordName}` : 'Choose a chord from the catalog'} · ring marks selected voicing`
      : this.mode === 'identify' ? 'Choose one note per string to identify a chord' : `${this.scaleRoot.value} ${scale.label} · root notes are ringed`;
    this.status.textContent = this.mode === 'chord'
      ? `${this.chord ? `${chordName} voicing: ${this.chord.frets.map((fret, index) => `${strings[index].name}${fret ? ` fret ${fret}` : ' open'}`).join(' · ')}` : 'Choose a chord from the catalog'}`
      : this.mode === 'identify' ? 'Select a note on each string; tap the note again to clear that string.' : `${this.scaleRoot.value} ${scale.label}: ${scale.intervals.map((interval) => noteNames[(rootPitch + interval) % 12]).join(' · ')}`;
    const scaleNotes = scale.intervals.map((interval) => noteNames[(rootPitch + interval) % 12]);
    this.scaleNotes.textContent = this.mode === 'scale' ? `Scale tones: ${scaleNotes.join(' · ')}` : '';
    const count = this.selection.filter((midi) => midi !== null).length;
    this.clearButton.disabled = count === 0;
    this.summary.textContent = count ? `${count} string${count === 1 ? '' : 's'} selected` : 'Choose notes on the fretboard.';
    if (this.mode !== 'identify' || !count) {
      this.results.replaceChildren();
      this.page = 0;
      this.pagePrevious.disabled = true;
      this.pageNext.disabled = true;
      this.pageLabel.textContent = '0 matches';
      if (this.mode === 'identify') this.results.innerHTML = '<p class="identifier-empty">Select notes on the fretboard to find matching chords.</p>';
      return;
    }
    const matches = this.rankMatches();
    const pageCount = Math.max(1, Math.ceil(matches.length / this.pageSize));
    this.page = Math.max(0, Math.min(this.page, pageCount - 1));
    const pageMatches = matches.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);
    this.pagePrevious.disabled = this.page === 0;
    this.pageNext.disabled = this.page >= pageCount - 1;
    this.pageLabel.textContent = `${matches.length ? this.page + 1 : 0} / ${matches.length ? pageCount : 0} · ${matches.length} matches`;
    this.results.replaceChildren();
    const noteSummary = document.createElement('p');
    noteSummary.className = 'identifier-summary';
    noteSummary.textContent = `Ranked by pitch-class coverage and root fit.`;
    this.results.append(noteSummary);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'identifier-empty';
      empty.textContent = 'No matching chord candidates.';
      this.results.append(empty);
    }
    for (const { chord, fit, common } of pageMatches) {
      const row = document.createElement('article');
      row.className = 'identifier-result';
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `Show ${chord.name} on the fretboard`);
      row.addEventListener('click', () => {
        this.mode = 'chord';
        this.modeButtons.forEach((button) => {
          const active = button.dataset.boardMode === 'chord';
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', String(active));
        });
        document.querySelector('#fretboard-section').hidden = false;
        document.querySelector('#identify-section').hidden = true;
        document.querySelector('#scale-section').hidden = true;
        document.querySelector('#theory-panel').dataset.mode = 'chord';
        this.onChordSelect(chord);
      });
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          row.click();
        }
      });
      const heading = document.createElement('div');
      heading.className = 'identifier-result-heading';
      const name = document.createElement('strong');
      name.textContent = chord.name;
      const score = document.createElement('span');
      score.textContent = `${fit}% theory fit`;
      heading.append(name, score);
      const detail = document.createElement('p');
      detail.textContent = `${chord.qualityLabel} · ${chord.notes.join(' · ')} · ${common}/${new Set(this.selection.filter((midi) => midi !== null).map((midi) => midi % 12)).size} selected pitch classes match`;
      row.append(heading, detail);
      this.results.append(row);
    }
    const note = document.createElement('p');
    note.className = 'identifier-disclaimer';
    note.textContent = 'Theory-fit percentages are estimates from pitch-class coverage and root presence, not measured probabilities.';
    this.results.append(note);
  }
}
