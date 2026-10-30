export class AudioTransport {
  constructor(){this.context=null;this.running=false;this.startTime=0;this.bpm=96;this.listeners=new Set();}
  subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  async ensureAudio(){if(!this.context){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Web Audio is unavailable in this browser.');this.context=new AC();}if(this.context.state==='suspended')await this.context.resume();return this.context;}
  async start(){await this.ensureAudio();if(!this.running){this.startTime=this.context.currentTime+.08;this.running=true;}return this.startTime;}
  setTempo(value){this.bpm=Math.max(40,Math.min(220,Math.round(Number(value)||96)));this.listeners.forEach(listener=>listener.onTempo?.(this.bpm));}
  nextGridTime(subdivisionsPerBeat=1){if(!this.context)return this.startTime;const interval=60/this.bpm/subdivisionsPerBeat;const elapsed=this.context.currentTime-this.startTime;const index=Math.max(0,Math.ceil(elapsed/interval-1e-8));return this.startTime+index*interval;}
  stop(){if(!this.running)return;this.running=false;this.listeners.forEach(listener=>listener.onStop?.());}
}
