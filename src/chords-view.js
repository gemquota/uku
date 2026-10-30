import { chords, chordQualities, chordRoots } from './chords.js';

const stringNames = ['G', 'C', 'E', 'A'];

export class ChordsView {
  constructor(identifier) {
    this.identifier = identifier;
    this.root = document.querySelector('#library-panel');
    this.catalogSection = document.querySelector('#catalog-section');
    this.pagePrevious = document.querySelector('#chord-page-prev');
    this.pageNext = document.querySelector('#chord-page-next');
    this.pageLabel = document.querySelector('#chord-page-label');
    this.pageSize = 12;
    this.page = 0;
    this.search = document.querySelector('#chord-search');
    this.rootFilter = document.querySelector('#chord-root-filter');
    this.qualityFilter = document.querySelector('#chord-quality-filter');
    this.list = document.querySelector('#chord-list');
    this.detail = document.querySelector('#chord-detail');
    this.clearButton = document.querySelector('#chord-filters-clear');
    this.selectedRoots = new Set();
    this.selectedQualities = new Set();
    this.selectedId = chords[0]?.id ?? null;
    this.identifier.onChordSelect = (chord) => {
      this.selectedId = chord.id;
      this.page = 0;
      this.selectedRoots.clear();
      this.selectedQualities.clear();
      this.search.value = '';
      this.rootFilter.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', 'false'));
      this.qualityFilter.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', 'false'));
      this.render();
    };
    this.onFilter = () => { this.page = 0; this.render(); };
    this.search.addEventListener('input', this.onFilter);
    this.pagePrevious.addEventListener('click', () => { this.page = Math.max(0, this.page - 1); this.render(); });
    this.pageNext.addEventListener('click', () => { this.page += 1; this.render(); });
    this.clearButton.addEventListener('click', () => {
      this.search.value = '';
      this.selectedRoots.clear();
      this.selectedQualities.clear();
      this.page = 0;
      this.rootFilter.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', 'false'));
      this.qualityFilter.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', 'false'));
      this.render();
    });
    this.populateFilters();
    this.render();
  }

  populateFilters() {
    const naturalRoots = chordRoots.filter((root) => !root.includes('♯'));
    this.rootFilter.replaceChildren(...naturalRoots.map((root) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'keyboard-key';
      button.dataset.root = root;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = root;
      button.setAttribute('aria-label', `Filter chords in ${root}`);
      button.addEventListener('click', () => this.toggleFilter(this.selectedRoots, root, button));
      return button;
    }));
    const sharpPositions = { 'C♯': 1, 'D♯': 2, 'F♯': 4, 'G♯': 5, 'A♯': 6 };
    for (const root of chordRoots.filter((note) => note.includes('♯'))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'keyboard-key keyboard-key-sharp';
      button.dataset.root = root;
      button.style.setProperty('--key-position', sharpPositions[root]);
      button.setAttribute('aria-pressed', 'false');
      button.textContent = root;
      button.setAttribute('aria-label', `Filter chords in ${root}`);
      button.addEventListener('click', () => this.toggleFilter(this.selectedRoots, root, button));
      this.rootFilter.append(button);
    }

    const groups = [
      { label: 'CORE', qualities: ['major', 'minor'] },
      { label: 'SEVENTHS', qualities: ['7', 'maj7', 'm7'] },
      { label: 'COLOR', qualities: ['6', 'sus4'] },
      { label: 'ALTERED', qualities: ['dim', 'aug'] },
    ];
    this.qualityFilter.replaceChildren(...groups.map((group) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = `quality-group quality-group-${group.label.toLowerCase()}`;
      const legend = document.createElement('legend');
      legend.textContent = group.label;
      fieldset.append(legend);
      const chips = document.createElement('div');
      chips.className = 'quality-chips';
      for (const quality of chordQualities.filter(({ key }) => group.qualities.includes(key))) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quality-chip';
        button.dataset.quality = quality.key;
        button.setAttribute('aria-pressed', 'false');
        button.textContent = quality.label;
        button.addEventListener('click', () => this.toggleFilter(this.selectedQualities, quality.key, button));
        chips.append(button);
      }
      fieldset.append(chips);
      return fieldset;
    }));
  }

  toggleFilter(selection, value, button) {
    if (selection.has(value)) selection.delete(value);
    else selection.add(value);
    button.setAttribute('aria-pressed', String(selection.has(value)));
    this.render();
  }

  filteredChords() {
    const query = this.search.value.trim().toLowerCase();
    return chords.filter((chord) => {
      const matchesQuery = !query || `${chord.name} ${chord.root} ${chord.qualityLabel} ${chord.notes.join(' ')}`.toLowerCase().includes(query);
      return matchesQuery && (!this.selectedRoots.size || this.selectedRoots.has(chord.root))
        && (!this.selectedQualities.size || this.selectedQualities.has(chord.quality));
    });
  }

  render() {
    this.clearButton.disabled = !this.search.value && !this.selectedRoots.size && !this.selectedQualities.size;
    const matches = this.filteredChords();
    const pageCount = Math.max(1, Math.ceil(matches.length / this.pageSize));
    this.page = Math.max(0, Math.min(this.page, pageCount - 1));
    const pageMatches = matches.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);
    if (!pageMatches.some((chord) => chord.id === this.selectedId)) this.selectedId = pageMatches[0]?.id ?? null;
    this.pageLabel.textContent = `${matches.length ? this.page + 1 : 0} / ${matches.length ? pageCount : 0} · ${matches.length} chords`;
    this.pagePrevious.disabled = this.page === 0;
    this.pageNext.disabled = this.page >= pageCount - 1;
    this.list.replaceChildren(...pageMatches.map((chord) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chord-result${chord.id === this.selectedId ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', String(chord.id === this.selectedId));
      button.innerHTML = `<span class="chord-result-name"></span><span class="chord-result-type"></span>`;
      button.querySelector('.chord-result-name').textContent = chord.name;
      button.querySelector('.chord-result-type').textContent = chord.qualityLabel;
      button.addEventListener('click', () => {
        this.selectedId = chord.id;
        this.page = Math.floor(matches.indexOf(chord) / this.pageSize);
        this.identifier.setChord(chord, true);
        document.querySelector('#theory-panel').dataset.mode = 'chord';
        document.querySelector('[data-module="theory"]').click();
        this.render();
      });
      return button;
    }));
    this.list.setAttribute('aria-label', `${matches.length} matching chords`);
    this.root.dataset.selectedChord = this.selectedId ?? '';
    if (!matches.length) {
      this.detail.innerHTML = '<p class="empty-chords">No chords match those filters. Try another search.</p>';
      this.identifier.setChord(null);
      return;
    }
    const selectedChord = matches.find((chord) => chord.id === this.selectedId);
    this.renderDetail(selectedChord);
    this.identifier.setChord(selectedChord);
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
