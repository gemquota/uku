import { chords, chordQualities, chordRoots } from './chords.js';

const stringNames = ['G', 'C', 'E', 'A'];

export class ChordsView {
  constructor() {
    this.root = document.querySelector('#chords-panel');
    this.search = document.querySelector('#chord-search');
    this.rootFilter = document.querySelector('#chord-root-filter');
    this.qualityFilter = document.querySelector('#chord-quality-filter');
    this.list = document.querySelector('#chord-list');
    this.detail = document.querySelector('#chord-detail');
    this.selectedId = null;
    this.onFilter = () => this.render();
    this.search.addEventListener('input', this.onFilter);
    this.rootFilter.addEventListener('change', this.onFilter);
    this.qualityFilter.addEventListener('change', this.onFilter);
    this.populateFilters();
    this.render();
  }

  populateFilters() {
    this.rootFilter.replaceChildren(new Option('All roots', 'all'), ...chordRoots.map((root) => new Option(root, root)));
    this.qualityFilter.replaceChildren(new Option('All types', 'all'), ...chordQualities.map(({ key, label }) => new Option(label, key)));
  }

  filteredChords() {
    const query = this.search.value.trim().toLowerCase();
    return chords.filter((chord) => {
      const matchesQuery = !query || `${chord.name} ${chord.root} ${chord.qualityLabel} ${chord.notes.join(' ')}`.toLowerCase().includes(query);
      return matchesQuery && (this.rootFilter.value === 'all' || chord.root === this.rootFilter.value)
        && (this.qualityFilter.value === 'all' || chord.quality === this.qualityFilter.value);
    });
  }

  render() {
    const matches = this.filteredChords();
    if (!matches.some((chord) => chord.id === this.selectedId)) this.selectedId = matches[0]?.id ?? null;
    this.list.replaceChildren(...matches.map((chord) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chord-result${chord.id === this.selectedId ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', String(chord.id === this.selectedId));
      button.innerHTML = `<span class="chord-result-name"></span><span class="chord-result-type"></span>`;
      button.querySelector('.chord-result-name').textContent = chord.name;
      button.querySelector('.chord-result-type').textContent = chord.qualityLabel;
      button.addEventListener('click', () => {
        this.selectedId = chord.id;
        this.render();
      });
      return button;
    }));
    this.list.setAttribute('aria-label', `${matches.length} matching chords`);
    if (!matches.length) {
      this.detail.innerHTML = '<p class="empty-chords">No chords match those filters. Try another search.</p>';
      return;
    }
    this.renderDetail(matches.find((chord) => chord.id === this.selectedId));
  }

  renderDetail(chord) {
    const fretted = chord.frets.filter((fret) => fret > 0);
    const lowestFret = Math.min(...fretted);
    const highestFret = Math.max(...fretted);
    const startFret = highestFret <= 4 ? 1 : lowestFret;
    const dots = chord.frets.map((fret, stringIndex) => {
      if (fret === 0) return `<span class="open-marker" style="--string:${stringIndex}" aria-label="${stringNames[stringIndex]} string open">○</span>`;
      const row = fret - startFret;
      return `<span class="fret-dot" style="--string:${stringIndex};--fret:${row}" aria-label="${stringNames[stringIndex]} string, fret ${fret}, finger ${chord.fingers[stringIndex]}"><span>${chord.fingers[stringIndex]}</span></span>`;
    }).join('');
    this.detail.innerHTML = `
      <div class="chord-detail-head"><div><p class="eyebrow">UKULELE CHORD</p><h3 class="chord-title"></h3><p class="chord-subtitle"></p></div><span class="chord-badge">${chord.frets.filter((fret) => fret > 0).length} fingers</span></div>
      <div class="diagram-wrap" role="img" aria-label="${chord.name} chord, strings G C E A. Finger positions: ${chord.frets.map((fret, index) => `${stringNames[index]} ${fret ? `fret ${fret}, finger ${chord.fingers[index]}` : 'open'}`).join('; ')}">
        <div class="diagram-labels">${stringNames.map((name) => `<span>${name}</span>`).join('')}</div>
        <div class="fretboard" style="--start-fret:${startFret}"><span class="fret-number">${startFret}</span><span class="fret-number second">${startFret + 1}</span><span class="fret-number third">${startFret + 2}</span><span class="fret-number fourth">${startFret + 3}</span>${dots}</div>
        <div class="finger-legend">${chord.frets.map((fret, index) => `<span><b>${stringNames[index]}</b> ${fret === 0 ? 'open' : `fret ${fret} · finger ${chord.fingers[index]}`}</span>`).join('')}</div>
      </div>
      <div class="chord-notes"><span>NOTES</span><div class="note-chips">${chord.notes.map((note) => `<b>${note}</b>`).join('')}</div></div>`;
    this.detail.querySelector('.chord-title').textContent = chord.name;
    this.detail.querySelector('.chord-subtitle').textContent = chord.qualityLabel;
  }
}
