export const PITCHES = Object.freeze(["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"]);
export const INTERVAL_NAMES = Object.freeze(["P1","m2","M2","m3","M3","P4","TT","P5","m6","M6","m7","M7"]);
export const SCALE_TEMPLATES = Object.freeze({
  "Major": [0,2,4,5,7,9,11], "Natural minor": [0,2,3,5,7,8,10],
  "Harmonic minor": [0,2,3,5,7,8,11], "Melodic minor": [0,2,3,5,7,9,11],
  "Major pentatonic": [0,2,4,7,9], "Minor pentatonic": [0,3,5,7,10],
  "Blues": [0,3,5,6,7,10], "Dorian": [0,2,3,5,7,9,10],
  "Phrygian": [0,1,3,5,7,8,10], "Lydian": [0,2,4,6,7,9,11],
  "Mixolydian": [0,2,4,5,7,9,10], "Locrian": [0,1,3,5,6,8,10],
  "Whole tone": [0,2,4,6,8,10], "Diminished (H-W)": [0,1,3,4,6,7,9,10],
  "Diminished (W-H)": [0,2,3,5,6,8,9,11], "Shostakovich": [0,2,3,4,5,6,8,9,10,11]
});
export const mod = (n, m=12) => ((n % m) + m) % m;
export const maskOf = (notes) => notes.reduce((mask,n)=>mask | (1 << mod(n)),0);
export const notesOf = (mask) => PITCHES.map((_,i)=>i).filter(i => mask & (1<<i));
export const rotateMask = (mask, steps=1) => maskOf(notesOf(mask).map(n=>n+steps));
export const invertMask = (mask) => maskOf(notesOf(mask).map(n=>-n));
export const intervalSequence = (notes) => {
  const sorted=[...new Set(notes.map(n=>mod(n)))].sort((a,b)=>a-b);
  return sorted.map((n,i)=>mod(sorted[(i+1)%sorted.length]-n));
};
export const intervalVector = (notesOrMask) => {
  const notes=Array.isArray(notesOrMask)?notesOrMask:notesOf(notesOrMask);
  const v=Array(6).fill(0);
  for(let i=0;i<notes.length;i++) for(let j=i+1;j<notes.length;j++){
    const d=mod(notes[j]-notes[i]); v[Math.min(d,12-d)-1]++;
  }
  return v;
};
export const canonicalRotation = (mask) => Math.min(...Array.from({length:12},(_,i)=>rotateMask(mask,i)));
export const canonicalTnI = (mask) => Math.min(canonicalRotation(mask),canonicalRotation(invertMask(mask)));
export const distinctModes = (mask) => { const notes=notesOf(mask); const modes=new Map(); for(const root of notes){const mode=maskOf(notes.map(n=>mod(n-root)));modes.set(mode,mode);} return [...modes.values()]; };
export const symmetryOrder = (mask) => Array.from({length:12},(_,i)=>i).filter(i=>rotateMask(mask,i)===mask).length;
export const transpositionCount = (mask) => new Set(Array.from({length:12},(_,i)=>rotateMask(mask,i))).size;
export const hammingDistance = (a,b) => {
  let x=a^b, count=0; while(x){count+=x&1;x>>>=1;} return count;
};
export const jaccard = (a,b) => {
  const intersection=popcount(a&b), union=popcount(a|b);
  return union ? intersection/union : 1;
};
export const popcount = (n) => { let c=0; while(n){n&=n-1;c++;} return c; };
export const scaleProfile = (mask) => {
  const notes=notesOf(mask), intervals=intervalSequence(notes), vector=intervalVector(notes);
  const modes=distinctModes(mask), transpositions=new Set(Array.from({length:12},(_,i)=>rotateMask(mask,i))).size, symmetry=symmetryOrder(mask);
  const consonant=vector[2]+vector[3]+vector[4]; // minor third, major third, fourth/fifth classes
  const dissonant=vector[0]+vector[1]+vector[5]; // semitone, whole tone, tritone
  const entropy=intervals.length ? -intervals.reduce((sum,x)=>sum+(x/12)*Math.log2(x/12),0) : 0;
  return {mask,notes,intervals,intervalVector:vector,cardinality:notes.length,modes,symmetry,transpositions:modes.length,consonantPairs:consonant,dissonantPairs:dissonant,intervalEntropy:entropy,canonical:canonicalRotation(mask),primeForm:canonicalTnI(mask)};
};
export const allRootedCollections = () => Array.from({length:2048},(_,i)=>((i<<1)|1));
export const allScaleFamilies = () => {
  const seen=new Set(), families=[];
  for(const mask of allRootedCollections()){
    const canonical=canonicalRotation(mask);
    if(seen.has(canonical)) continue;
    seen.add(canonical);
    const members=distinctModes(mask);
    families.push({id:canonical.toString(16).padStart(3,"0"),canonical,members,profile:scaleProfile(canonical)});
  }
  return families.sort((a,b)=>a.profile.cardinality-b.profile.cardinality || a.profile.transpositions-b.profile.transpositions || a.canonical-b.canonical);
};
export const transposeNotes = (notes,steps) => notes.map(n=>mod(n+steps));
export const compareScales = (a,b) => {
  const A=Array.isArray(a)?maskOf(a):a, B=Array.isArray(b)?maskOf(b):b;
  const pa=scaleProfile(A),pb=scaleProfile(B);
  return {hamming:hammingDistance(A,B),jaccard:jaccard(A,B),common:notesOf(A&B),added:notesOf(B&~A),removed:notesOf(A&~B),intervalVectorDistance:Math.sqrt(pa.intervalVector.reduce((s,x,i)=>s+(x-pb.intervalVector[i])**2,0))};
};
export const identifyScales = (observedNotes, limit=12) => {
  const observed=maskOf(observedNotes), candidates=allRootedCollections().map(mask=>{
    const p=scaleProfile(mask), common=popcount(mask&observed), missing=popcount(mask&~observed), extra=popcount(observed&~mask);
    const score=(common/(Math.max(1,p.cardinality))) - extra*0.16 - missing*0.035;
    return {...p,score,missing,extra};
  });
  return candidates.sort((a,b)=>b.score-a.score || a.missing-b.missing || a.mask-b.mask).slice(0,limit);
};
export const midiFrequency = (midi,a4=440) => a4*2**((midi-69)/12);
export const noteName = (midi) => `${PITCHES[mod(midi)]}${Math.floor(midi/12)-1}`;
export const midiFromFrequency = (hz,a4=440) => Math.round(69+12*Math.log2(hz/a4));
