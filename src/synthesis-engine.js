export class SynthesisEngine {
  constructor() {
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) throw new Error("Web Audio is unavailable.");
    this.context=new AC();
    this.master=this.context.createGain(); this.master.gain.value=.72;
    this.analyser=this.context.createAnalyser(); this.analyser.fftSize=8192; this.analyser.smoothingTimeConstant=.72;
    this.master.connect(this.analyser); this.analyser.connect(this.context.destination);
    this.active=new Map(); this.instrument="piano"; this.volume=.7; this.waveform="triangle";
    this.settings={attack:.012,decay:.18,sustain:.58,release:.24,filter:5200,detune:0};
  }
  async resume(){if(this.context.state!=="running") await this.context.resume();}
  setInstrument(name){this.instrument=["piano","guitar","ukulele","synth"].includes(name)?name:"piano";}
  setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)));this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.025);}
  setEnvelope(patch){this.settings={...this.settings,...patch};}
  frequency(midi){return 440*2**((midi-69)/12);}
  play(midi,velocity=.78,when=this.context.currentTime,duration=null){
    const key=String(midi),ctx=this.context,now=Math.max(when,ctx.currentTime);if(this.active.has(key))this.release(midi,now);
    const voiceGain=ctx.createGain(),filter=ctx.createBiquadFilter();
    filter.type="lowpass";filter.frequency.value=this.settings.filter;
    const osc=ctx.createOscillator(),sub=ctx.createOscillator();
    const instrument=this.instrument;
    osc.type=instrument==="piano"?"triangle":instrument==="guitar"?"sawtooth":instrument==="ukulele"?"triangle":"sawtooth";
    osc.frequency.setValueAtTime(this.frequency(midi),now);osc.detune.value=this.settings.detune;
    sub.type="sine";sub.frequency.setValueAtTime(this.frequency(midi)*2.001,now);
    const peak=Math.max(.0001,velocity*this.volume*(instrument==="guitar"?.12:instrument==="ukulele"?.16:.19));
    const attack=instrument==="piano"?.004:this.settings.attack;
    voiceGain.gain.setValueAtTime(.0001,now);voiceGain.gain.exponentialRampToValueAtTime(peak,now+attack);
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*this.settings.sustain),now+attack+this.settings.decay);
    osc.connect(filter);sub.connect(filter);filter.connect(voiceGain);voiceGain.connect(this.master);
    osc.start(now);sub.start(now);
    const voice={osc,sub,gain:voiceGain,filter,midi};
    this.active.set(key,voice);
    if(duration!==null) this.release(midi,now+duration);
    return voice;
  }
  release(midi,when=this.context.currentTime){
    const key=String(midi),voice=this.active.get(key);if(!voice)return;
    const end=Math.max(when,this.context.currentTime)+this.settings.release;
    voice.gain.gain.cancelScheduledValues(this.context.currentTime);
    voice.gain.gain.setTargetAtTime(.0001,Math.max(when,this.context.currentTime),this.settings.release/4);
    voice.osc.stop(end+.04);voice.sub.stop(end+.04);this.active.delete(key);
  }
  stopAll(){for(const key of [...this.active.keys()])this.release(Number(key));}
  strum(notes,direction="down",spacing=.028,velocity=.72){
    const ordered=direction==="up"?[...notes].reverse():[...notes];
    ordered.forEach((midi,index)=>this.play(midi,velocity,this.context.currentTime+index*spacing));
  }
  playChord(notes,duration=1.1){notes.forEach(midi=>this.play(midi,.64,this.context.currentTime,duration));}
  destroy(){this.stopAll();return this.context.close();}
}
