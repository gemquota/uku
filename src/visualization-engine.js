import {PITCHES,notesOf,scaleProfile,mod} from "./music-theory.js";
const COLORS=["#8fe5dc","#bca8ff","#f1a4d8","#f4c47d","#83b8ff"];
export class MusicVisualizations {
  constructor(){this.palette=COLORS;}
  circle(canvas,mask,root=0){
    const c=canvas.getContext("2d"),w=canvas.width=canvas.clientWidth*devicePixelRatio,h=canvas.height=canvas.clientHeight*devicePixelRatio,r=Math.min(w,h)*.36,cx=w/2,cy=h/2;c.clearRect(0,0,w,h);
    c.strokeStyle="rgba(188,168,255,.18)";c.lineWidth=1;for(let k=1;k<=3;k++){c.beginPath();c.arc(cx,cy,r*k/3,0,Math.PI*2);c.stroke();}
    const points=Array.from({length:12},(_,i)=>{const a=-Math.PI/2+i*Math.PI/6;return{x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};});
    c.strokeStyle="rgba(188,168,255,.32)";c.lineWidth=1.5;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.stroke();
    const fifthOrder=Array.from({length:12},(_,i)=>mod(i*7));const active=fifthOrder.filter(n=>mask&(1<<n));
    if(active.length){c.beginPath();active.forEach((n,i)=>{const p=points[n];i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.closePath();c.strokeStyle=COLORS[1];c.lineWidth=2.5;c.shadowColor=COLORS[1];c.shadowBlur=12;c.stroke();c.shadowBlur=0;}
    points.forEach((p,i)=>{const on=Boolean(mask&(1<<i));c.beginPath();c.arc(p.x,p.y,on?7:4,0,Math.PI*2);c.fillStyle=i===root?"#f4c47d":on?COLORS[0]:"rgba(180,174,198,.32)";c.fill();c.fillStyle=on?"#fff":"#8b879b";c.font=`12px system-ui`;c.textAlign="center";c.fillText(PITCHES[i],p.x,p.y-r*.14);});
  }
  fingerprint(canvas,mask){const p=scaleProfile(mask),c=canvas.getContext("2d"),w=canvas.width=canvas.clientWidth*devicePixelRatio,h=canvas.height=canvas.clientHeight*devicePixelRatio;c.clearRect(0,0,w,h);const max=Math.max(1,...p.intervalVector);p.intervalVector.forEach((v,i)=>{const bw=w/8,x=(i+.7)*bw,bar=h*.78*v/max;c.fillStyle=COLORS[i%COLORS.length];c.globalAlpha=.86;c.fillRect(x,h-bar-18,bw*.55,bar);c.globalAlpha=1;c.fillStyle="#aaa4ba";c.font="11px system-ui";c.textAlign="center";c.fillText(["m2","M2","m3","M3","P4","TT"][i],x+bw*.27,h-3);});}
  spectrum(canvas,partials){const c=canvas.getContext("2d"),w=canvas.width=canvas.clientWidth*devicePixelRatio,h=canvas.height=canvas.clientHeight*devicePixelRatio;c.clearRect(0,0,w,h);const max=Math.max(1,...partials);partials.forEach((v,i)=>{const x=i*w/partials.length,bh=v/max*h*.82;c.fillStyle=COLORS[i%COLORS.length];c.fillRect(x,h-bh,w/partials.length*.72,bh);});}
}
