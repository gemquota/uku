const NOTES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const SETS=[
{id:'major',name:'Major / diatonic',family:'Diatonic',steps:[2,2,1,2,2,2,1],modes:['Ionian','Dorian','Phrygian','Lydian','Mixolydian','Aeolian','Locrian']},
{id:'melodic-minor',name:'Melodic minor',family:'Melodic minor',steps:[2,1,2,2,2,2,1],modes:['Melodic minor','Dorian ♭2','Lydian augmented','Lydian dominant','Mixolydian ♭6','Locrian ♮2','Altered']},
{id:'harmonic-minor',name:'Harmonic minor',family:'Harmonic minor',steps:[2,1,2,2,1,3,1],modes:['Harmonic minor','Locrian ♮6','Ionian ♯5','Dorian ♯4','Phrygian dominant','Lydian ♯2','Ultralocrian']},
{id:'harmonic-major',name:'Harmonic major',family:'Harmonic major',steps:[2,2,1,2,1,3,1],modes:['Harmonic major','Dorian ♭5','Phrygian ♭4','Lydian ♭3','Mixolydian ♭2','Lydian augmented ♯2','Locrian ♭♭7']},
{id:'double-harmonic',name:'Double harmonic',family:'Double harmonic',steps:[1,3,1,2,1,3,1],modes:['Double harmonic','Lydian ♯2 ♯6','Ultraphrygian','Hungarian minor','Oriental','Ionian augmented ♯2','Locrian ♭3 ♭7']},
{id:'major-pentatonic',name:'Major pentatonic',family:'Pentatonic',steps:[2,2,3,2,3],modes:['Major pentatonic','Suspended pentatonic','Man gong','Ritusen','Minor pentatonic']},
{id:'whole-tone',name:'Whole tone',family:'Symmetrical',steps:[2,2,2,2,2,2],modes:['Whole tone']},
{id:'octatonic',name:'Diminished',family:'Symmetrical',steps:[2,1,2,1,2,1,2,1],modes:['Diminished whole–half','Diminished half–whole']}
];
const rotate=(a,n)=>a.slice(n).concat(a.slice(0,n));
const toIntervals=steps=>{let n=0;return[0,...steps.slice(0,-1).map(v=>(n+=v))];};
export const SCALE_DATABASE=SETS.flatMap(set=>set.modes.map((name,i)=>{const steps=rotate(set.steps,i),intervals=toIntervals(steps);return{id:set.id+'-'+(i+1),collection:set.id,collectionName:set.name,family:set.family,degree:i+1,name,steps,intervals,cardinality:steps.length,signature:intervals.join('-')};}));
export function scaleNotes(scale,root=0){return scale.intervals.map(i=>NOTES[(root+i)%12]);}
export function scaleMidi(scale,root=0,octave=4){return scale.intervals.map(i=>12*(octave+1)+root+i);}
export class ScaleAtlas{
constructor(root,onPlay=()=>{}){this.root=root;this.onPlay=onPlay;this.selected=SCALE_DATABASE[0];this.tonic=0;this.search=root.querySelector('#scale-atlas-search');this.rootSelect=root.querySelector('#scale-atlas-root');this.family=root.querySelector('#scale-atlas-family');this.grid=root.querySelector('#scale-atlas-grid');this.detail=root.querySelector('#scale-atlas-detail');this.search.addEventListener('input',()=>this.render());this.rootSelect.addEventListener('change',()=>{this.tonic=NOTES.indexOf(this.rootSelect.value);this.renderDetail();});this.family.addEventListener('change',()=>this.render());this.render();}
render(){
const q=this.search.value.toLowerCase().trim(),family=this.family.value;
this.grid.replaceChildren();let row=0,serial=0;
SETS.forEach(set=>{
if(family!=='all'&&set.family!==family)return;
const items=SCALE_DATABASE.filter(scale=>scale.collection===set.id&&(!q||[scale.name,scale.collectionName,scale.family,scale.signature,scale.steps.join(' ')].join(' ').toLowerCase().includes(q)));
if(!items.length)return;row++;
const label=document.createElement('div');label.className='scale-family-label';label.style.gridColumn='1';label.style.gridRow=String(row);label.textContent=set.name;this.grid.append(label);
items.forEach(scale=>{
serial++;const tile=document.createElement('button');tile.type='button';tile.className='scale-element'+(scale.id===this.selected.id?' selected':'');tile.title=scale.name+' · '+scale.collectionName;tile.style.gridColumn=String(scale.degree+1);tile.style.gridRow=String(row);
const number=document.createElement('small');number.textContent=String(SCALE_DATABASE.indexOf(scale)+1).padStart(2,'0');
const symbol=document.createElement('strong');symbol.textContent=scale.name.split(/[\\s–-]/).map(x=>x[0]||'').join('').slice(0,3).toUpperCase();
const name=document.createElement('span');name.textContent=scale.name;
const count=document.createElement('em');count.textContent=scale.cardinality+' tones';
tile.append(number,symbol,name,count);tile.addEventListener('click',()=>{this.selected=scale;this.render();});this.grid.append(tile);
});
});
this.renderDetail();
}
renderDetail(){const s=this.selected,notes=scaleNotes(s,this.tonic),siblings=SCALE_DATABASE.filter(x=>x.collection===s.collection);this.detail.replaceChildren();const h=document.createElement('h3');h.textContent=NOTES[this.tonic]+' '+s.name;const meta=document.createElement('p');meta.textContent=s.family+' · '+s.cardinality+' notes · degree '+s.degree+' of '+siblings.length;const note=document.createElement('p');note.className='scale-detail-notes';note.textContent=notes.join(' · ');const formula=document.createElement('p');formula.className='scale-detail-formula';formula.textContent='Intervals: '+s.intervals.join(' · ')+' semitones | Steps: '+s.steps.join(' · ');const parent=document.createElement('p');parent.className='scale-detail-parent';parent.textContent='Parent: '+s.collectionName+' | Related modes: '+siblings.map(x=>x.name).join(' · ');const play=document.createElement('button');play.type='button';play.className='mic-button scale-play';play.textContent='▶ Hear scale';play.addEventListener('click',()=>this.onPlay(scaleMidi(s,this.tonic)));this.detail.append(h,meta,note,formula,parent,play);}
}
