import {mod,maskOf,notesOf,popcount} from "./music-theory.js";
export const CHORD_TEMPLATES=Object.freeze({
  maj:[0,4,7],min:[0,3,7],dim:[0,3,6],aug:[0,4,8],sus2:[0,2,7],sus4:[0,5,7],
  "6":[0,4,7,9],m6:[0,3,7,9],maj7:[0,4,7,11],m7:[0,3,7,10],"7":[0,4,7,10],
  mMaj7:[0,3,7,11],dim7:[0,3,6,9],m7b5:[0,3,6,10],add9:[0,2,4,7],"9":[0,2,4,7,10],
  maj9:[0,2,4,7,11],m9:[0,2,3,7,10],"11":[0,2,4,5,7,10],"13":[0,2,4,5,7,9,10]
});
export class HarmonyEngine{
  chord(root,quality){const intervals=CHORD_TEMPLATES[quality];if(!intervals)throw new Error("Unknown chord quality");return {root:mod(root),quality,notes:intervals.map(n=>mod(root+n)),mask:maskOf(intervals.map(n=>root+n))};}
  identify(notes,limit=8){const observed=maskOf(notes),found=[];for(let root=0;root<12;root++)for(const [quality,intervals] of Object.entries(CHORD_TEMPLATES)){const mask=maskOf(intervals.map(n=>root+n)),missing=popcount(mask&~observed),extra=popcount(observed&~mask),coverage=popcount(mask&observed)/popcount(mask),score=coverage-extra*.2-missing*.04;found.push({root,quality,notes:notesOf(mask),missing,extra,score});}return found.sort((a,b)=>b.score-a.score||a.missing-b.missing).slice(0,limit);}
  chordsInScale(scaleMask,maxNotes=4){const scale=notesOf(scaleMask),result=[];for(const root of scale)for(const [quality,intervals] of Object.entries(CHORD_TEMPLATES)){if(intervals.length>maxNotes)continue;const notes=intervals.map(n=>mod(root+n));if(notes.every(n=>scale.includes(n)))result.push({root,quality,notes});}return result;}
  voiceLeading(a,b){const permutations=values=>values.length<2?[values]:values.flatMap((v,i)=>permutations([...values.slice(0,i),...values.slice(i+1)]).map(rest=>[v,...rest]));const left=[...a].sort((x,y)=>x-y),right=[...b].sort((x,y)=>x-y);let best={cost:Infinity,voices:[]};for(const perm of permutations(right)){const voices=left.map((n,i)=>({from:n,to:perm[i%perm.length],movement:((perm[i%perm.length]-n+6)%12)-6}));const cost=voices.reduce((sum,v)=>sum+Math.abs(v.movement),0);if(cost<best.cost)best={cost,voices};}return best;}
}
