'use strict';
class IdleMotion {
 constructor(wake){this.wake=wake;this.speed=0;this.mode=null;this.timer=0;this.lastActivity=performance.now();this.activity();}
 activity(wake=true){this.lastActivity=performance.now();clearTimeout(this.timer);if(!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches)this.timer=setTimeout(()=>this.wake(),3010);if(wake)this.wake();}
 reset(wake=true){this.speed=0;this.activity(wake);}
 update(time,dt,mode,blocked){
  if(blocked||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){this.reset(false);return {delta:0,moving:false,stopped:false};}
  if(mode!==this.mode){this.mode=mode;this.reset(false);}
  const idle=Math.max(0,(time-this.lastActivity-3000)/1000);
  const desired=idle>0?(mode==='featured'?Math.min(20,.25+idle*idle*.22):7):0;
  const before=this.speed;
  this.speed+=(desired-this.speed)*(1-Math.exp(-dt*(desired===0?6:1.8)));
  if(desired===0&&this.speed<.002)this.speed=0;
  return {delta:this.speed*dt,moving:idle>0||this.speed>0,stopped:before>0&&this.speed===0};
 }
}
