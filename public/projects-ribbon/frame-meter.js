'use strict';
// Measures delivered animation frames, not a simulated device benchmark.
class FrameMeter {
 constructor(){
  this.samples=new Float32Array(120);this.cpu=new Float32Array(120);this.count=0;this.cursor=0;this.last=0;this.reported=0;
  const panel=document.createElement('details');panel.className='settings-group';
  panel.innerHTML='<summary>Performance <span>Live frame timing</span></summary><p class="grid-note" role="status">Drag continuously to measure performance.</p>';
  document.querySelector('#settings .panel-actions').before(panel);this.label=panel.querySelector('p');this.panel=panel;
 }
 begin(time){this.started=performance.now();this.interval=this.last?time-this.last:0;this.last=time;}
 end(){
  if(this.interval<=0||this.interval>100){this.count=0;this.cursor=0;return;}
  this.samples[this.cursor]=this.interval;this.cpu[this.cursor]=performance.now()-this.started;this.cursor=(this.cursor+1)%120;this.count=Math.min(120,this.count+1);
  if(!this.panel.open||performance.now()-this.reported<750||this.count<15)return;
  this.reported=performance.now();const frames=Array.from(this.samples.subarray(0,this.count)).sort((a,b)=>a-b),cpu=Array.from(this.cpu.subarray(0,this.count)).sort((a,b)=>a-b);
  const avg=frames.reduce((a,b)=>a+b,0)/frames.length,p95=frames[Math.floor((frames.length-1)*.95)];
  this.label.textContent=`${Math.round(1000/avg)} fps · ${p95.toFixed(1)} ms frame p95 · ${cpu[Math.floor(cpu.length/2)].toFixed(1)} ms CPU median. Measure while dragging; idle video playback runs at the video's frame rate. 120 fps requires an 8.3 ms frame interval and browser support.`;
 }
}
