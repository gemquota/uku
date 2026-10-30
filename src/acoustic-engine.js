import {midiFrequency,mod} from "./music-theory.js";
export const TUNING_SYSTEMS=Object.freeze({
  "12-TET":{kind:"equal"}, "Just major":{kind:"ratio",ratios:[1,16/15,9/8,6/5,5/4,4/3,45/32,3/2,8/5,5/3,9/5,15/8]},
  "Pythagorean":{kind:"ratio",ratios:[1,256/243,9/8,32/27,81/64,4/3,729/512,3/2,128/81,27/16,16/9,243/128]}
});
export class AcousticEngine{
  frequency(midi,{system="12-TET",a4=440,tonic=0}={}){const tuning=TUNING_SYSTEMS[system]||TUNING_SYSTEMS["12-TET"];if(tuning.kind==="equal")return midiFrequency(midi,a4);const pc=mod(midi-tonic),octave=Math.floor((midi-tonic)/12)-5,tonicFrequency=midiFrequency(60+tonic,a4);return tonicFrequency*tuning.ratios[pc]*2**octave;}
  compareInterval(fromMidi,toMidi,system="12-TET"){const a=this.frequency(fromMidi,{system}),b=this.frequency(toMidi,{system}),ratio=b/a,semitones=12*Math.log2(ratio);return {fromHz:a,toHz:b,ratio,cents:1200*Math.log2(ratio),equalTemperedCents:(toMidi-fromMidi)*100,beatHz:Math.abs(b-a),semitones};}
  partials(fundamental,count=24){return Array.from({length:count},(_,i)=>({harmonic:i+1,frequency:fundamental*(i+1),relativeAmplitude:1/(i+1),db:20*Math.log10(1/(i+1))}));}
  beatFrequency(a,b){return Math.abs(a-b);}
  intervalRoughness(f1,f2){const low=Math.min(f1,f2),high=Math.max(f1,f2),x=0.24/(0.021*low+19);return Math.exp(-3.5*x*(high-low))-Math.exp(-5.75*x*(high-low));}
  harmonicity(frequencies){if(frequencies.length<2)return 0;const sorted=[...frequencies].sort((a,b)=>a-b);let aligned=0;for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){const ratio=sorted[j]/sorted[i],nearest=Math.round(ratio);aligned+=Math.exp(-Math.abs(ratio-nearest)*3);}return aligned/(frequencies.length*(frequencies.length-1)/2);}
}
