'use strict';
class RibbonIntroduction {
 constructor(requestFrame,prepare){
  this.requestFrame=requestFrame;this.prepare=prepare;this.progress=0;this.active=false;this.start=null;
  this.settings={version:2,effect:9,duration:1.1,intensity:90,cascadeEase:1,cascadeStagger:50,transitionStart:50};
  try{const saved=JSON.parse(localStorage.getItem('ribbon-introduction')||'{}');if(saved.version===2)for(const [key,min,max]of [['duration',.4,3],['intensity',25,150]])if(Number.isFinite(saved[key]))this.settings[key]=Math.min(max,Math.max(min,saved[key]))}catch{}
  const cascade=document.createElement('div');
  cascade.innerHTML='<label for="intro-cascadeEase">Cascade easing</label><select id="intro-cascadeEase"><option value="0">Smooth in/out</option><option value="1">Cubic out</option><option value="2">Quartic out</option><option value="3">Sine in/out</option><option value="4">Linear</option></select><div class="control"><div class="control-top"><label for="intro-cascadeStagger">Cascade stagger</label><output id="intro-cascadeStagger-value"></output></div><input id="intro-cascadeStagger" type="range" min="0" max="200" step="5"></div><div class="control"><div class="control-top"><label for="intro-transitionStart">Start during page transition</label><output id="intro-transitionStart-value"></output></div><input id="intro-transitionStart" type="range" min="0" max="100" step="5"></div>';
  document.querySelector('#intro-replay').before(cascade);
  try{const saved=JSON.parse(localStorage.getItem('ribbon-introduction')||'{}');for(const [key,max]of [['cascadeEase',4],['cascadeStagger',200],['transitionStart',100]])if(Number.isFinite(saved[key]))this.settings[key]=Math.max(0,Math.min(max,key==='cascadeEase'?Math.round(saved[key]):saved[key]))}catch{}
  for(const key of ['duration','intensity','cascadeEase','cascadeStagger','transitionStart']){
   const input=document.querySelector('#intro-'+key);input.value=this.settings[key];
   input.addEventListener('input',()=>{this.settings[key]=+input.value;this.sync();try{localStorage.setItem('ribbon-introduction',JSON.stringify(this.settings))}catch{}});
   input.addEventListener('change',()=>this.play());
  }
  document.querySelector('#intro-replay').onclick=()=>this.play();this.sync();
 }
 sync(){document.querySelector('#intro-duration-value').textContent=this.settings.duration.toFixed(1)+'s';document.querySelector('#intro-intensity-value').textContent=this.settings.intensity+'%';document.querySelector('#intro-cascadeStagger-value').textContent=this.settings.cascadeStagger+'ms';document.querySelector('#intro-transitionStart-value').textContent=this.settings.transitionStart+'%';document.querySelector('#intro-description').textContent='Slides reveal from their centres in a staggered sequence. Changes save automatically.'}
 play(waitForPage=false){this.prepare();this.waitForPage=waitForPage;this.start=null;this.progress=0;this.active=true;document.querySelector('#intro-status').textContent=matchMedia('(prefers-reduced-motion: reduce)').matches?'Reduced motion: using a short fade.':'Playing — scroll to take control.';this.requestFrame()}
 finish(){this.active=false;this.progress=1;this.start=null;document.querySelector('#intro-status').textContent='Ready. Replay slide cascade.';this.requestFrame()}
 update(time){
  if(!this.active)return false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(this.start===null){
   // Let the host cross-dissolve finish before revealing live WebGL behind its snapshot.
   if(this.waitForPage&&!reduced){
    try{const root=window.parent.document.documentElement;if(root.dataset.navigationWave==='running'){if(Number(root.dataset.navigationWaveProgress||0)<this.settings.transitionStart/100)return true;}else if(window.parent.document.getAnimations().some(animation=>(animation.effect?.pseudoElement?.startsWith('::view-transition')||animation.animationName==='vt-fade')&&(animation.playState==='running'||animation.pending)))return true}catch{}
   }
   this.start=time;this.waitForPage=false;
  }
  this.progress=Math.max(0,Math.min(1,(time-this.start)/(reduced?250:this.settings.duration*1000+(this.settings.effect===9?4*this.settings.cascadeStagger:0))));
  if(this.progress>=1){this.finish();return false}return true;
 }
}
