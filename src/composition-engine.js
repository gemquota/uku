import {mod,maskOf,notesOf,intervalSequence,transposeNotes} from "./music-theory.js";
export class CompositionEngine {
  constructor(){this.projects=[];this.active={id:"draft",name:"Untitled study",bpm:96,meter:[4,4],tracks:[{id:"melody",name:"Melody",instrument:"piano",notes:[]}],scaleMask:maskOf([0,2,4,5,7,9,11])};}
  addNote(trackId,midi,beat=0,duration=1,velocity=.8){const track=this.active.tracks.find(t=>t.id===trackId);if(!track)throw new Error("Unknown track");const note={id:crypto.randomUUID?.()??String(Date.now()+Math.random()),midi,beat,duration,velocity};track.notes.push(note);return note;}
  addTrack(name,instrument="piano"){const track={id:`track-${Date.now()}-${this.active.tracks.length}`,name,instrument,notes:[]};this.active.tracks.push(track);return track;}
  generateMotif({root=60,scale=[0,2,4,5,7,9,11],length=8,contour="balanced",seed=7}={}){
    let state=seed>>>0;const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};
    const intervals=contour==="rising"?[0,1,2,3,4,5]:contour==="angular"?[-5,-3,-1,1,3,5]:[-3,-2,-1,0,1,2,3];
    let degree=Math.floor(scale.length/2),beat=0;const notes=[];
    for(let i=0;i<length;i++){if(i)degree=Math.max(0,Math.min(scale.length-1,degree+intervals[Math.floor(random()*intervals.length)]));notes.push({midi:root+scale[degree],beat,duration:[.5,1,1,2][Math.floor(random()*4)],velocity:.55+random()*.4});beat+=i%4===3?1.5:1;}
    return notes;
  }
  transform(notes,kind,amount=0){
    if(kind==="transpose")return notes.map(n=>({...n,midi:n.midi+amount}));
    if(kind==="retrograde"){const end=Math.max(...notes.map(n=>n.beat+n.duration),0);return [...notes].reverse().map(n=>({...n,beat:end-n.beat-n.duration}));}
    if(kind==="invert"){const pivot=notes[0]?.midi??60;return notes.map(n=>({...n,midi:pivot-(n.midi-pivot)}));}
    if(kind==="augment")return notes.map(n=>({...n,beat:n.beat*2,duration:n.duration*2}));
    if(kind==="diminish")return notes.map(n=>({...n,beat:n.beat/2,duration:n.duration/2}));
    return notes.map(n=>({...n}));
  }
  exportMIDI(){
    const events=[];for(const track of this.active.tracks)for(const n of track.notes){events.push({tick:Math.round(n.beat*480),on:true,n});events.push({tick:Math.round((n.beat+n.duration)*480),on:false,n});}
    events.sort((a,b)=>a.tick-b.tick||Number(a.on)-Number(b.on));
    const bytes=[];const push=(...v)=>bytes.push(...v);const vlq=value=>{let buffer=value&127;while((value>>=7)){buffer<<=8;buffer|=(value&127)|128;}while(true){push(buffer&255);if(buffer&128)buffer>>=8;else break;}};
    push(0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,1,0xe0);
    const data=[];const out=(...v)=>data.push(...v);let last=0;const micros=Math.round(60000000/Math.max(1,this.active.bpm||120));out(0,0xff,0x51,0x03,(micros>>16)&255,(micros>>8)&255,micros&255);
    for(const e of events){const delta=Math.max(0,e.tick-last);last=e.tick;let b=delta,buf=b&127;while((b>>=7)){buf<<=8;buf|=(b&127)|128;}while(true){out(buf&255);if(buf&128)buf>>=8;else break;}out(e.on?0x90:0x80,e.n.midi,e.on?Math.round(e.n.velocity*110):0);}
    out(0,0xff,0x2f,0);push(0x4d,0x54,0x72,0x6b,(data.length>>>24)&255,(data.length>>>16)&255,(data.length>>>8)&255,data.length&255,...data);
    return new Uint8Array(bytes);
  }
  save(){const raw=localStorage.getItem("uku-projects");this.projects=raw?JSON.parse(raw):[];this.projects.push(structuredClone(this.active));localStorage.setItem("uku-projects",JSON.stringify(this.projects));return this.projects.length;}
}
