'use strict';
const canvas=document.querySelector('#stage');
// Share the host's brand background with the opaque WebGL canvas.
try{for(const token of ['--brand-c1','--brand-c4','--brand-c5']){const colour=getComputedStyle(window.parent.document.documentElement).getPropertyValue(token).trim();if(colour)document.documentElement.style.setProperty(token,colour)}}catch{}
const mobileViewport=matchMedia('(width < 768px)');
let mobile=mobileViewport.matches;
let hostActive=window.parent===window||/^\/projects\/?$/.test(window.parent.location.pathname),hostPrepared=false;
const hostTransition=()=>window.parent!==window&&window.parent.document.documentElement.matches('[data-navigation-pending], [data-navigation-wave]');
window.addEventListener('message',event=>{
 if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='projects:active')return;
 hostActive=event.data.active===true;
 idleMotion.reset(false);clearTimeout(snapTimer);target=position;scrollVelocity=0;
 if(!hostActive){for(const item of videoSlides)item.video.pause();}else{lastTime=0;requestRender();}
});
if(window.parent!==window)new MutationObserver(()=>{idleMotion.reset(false);if(hostTransition()){for(const item of videoSlides)item.video.pause();}else if(hostActive){lastTime=0;requestRender()}}).observe(window.parent.document.documentElement,{attributes:true,attributeFilter:['data-navigation-pending','data-navigation-wave']});
let settingsKey=mobile?'ribbon-settings-mobile':'ribbon-settings';
const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});
let loaderWave=new URL(location.href).searchParams.has('loaderWave')&&gl?new RibbonLoaderWave(gl):null;
window.addEventListener('message',event=>{
 if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='projects:loader-wave'||!loaderWave)return;
 const progress=event.data.progress;if(!Number.isFinite(progress))return;
 loaderWave.progress=Math.max(0,Math.min(1,progress));
 for(const key of Object.keys(loaderWave.settings))if(Number.isFinite(event.data.settings?.[key]))loaderWave.settings[key]=event.data.settings[key];
 if(loaderWave.progress>=1){loaderWave.dispose();loaderWave=null;}
 requestRender();
});
const desktopDefaults={rotation:0,mouseTilt:0,mouseTiltMin:-6,mouseTiltMax:6,velocityTilt:0,velocityCurve:0,velocityTiltAmount:12,velocityCurveAmount:20,distance:100,curve:74,scale:100,speed:106,blur:65,blurThreshold:30,twist:0,stacked:0,vertical:0,amount:180,spread:48};
const mobileDefaults={vertical:1,stacked:1,rotation:0,distance:100,curve:95,scale:112,speed:136,blur:24};
const defaults={...desktopDefaults,...(mobile?mobileDefaults:{})};
const state={...defaults};
// Preserve the approved 576 × 991 mobile composition using width-based projection.
const mobileReferenceAspect=576/991;
function featuredView(){
 const view=introduction.active?{...state}:velocityShape.view({...state,rotation:mouseTilt.rotation});
 if(mobile)view.scale*=innerWidth/innerHeight/mobileReferenceAspect;
 return view;
}
try{const saved=JSON.parse(localStorage.getItem(settingsKey)||'{}');for(const key of ['velocityTilt','velocityCurve','velocityTiltAmount','velocityCurveAmount','mouseTilt','mouseTiltMin','mouseTiltMax','rotation','distance','curve','scale','speed','blur','blurThreshold','stacked','vertical','amount','spread'])if(Number.isFinite(saved[key]))state[key]=saved[key]}catch{}
function saveSettings(){if(new URLSearchParams(location.search).has('capture'))return;try{localStorage.setItem(settingsKey,JSON.stringify(state))}catch{}}
// Apply the requested mobile tuning once, including on phones with saved settings.
function migrateMobileSettings(){if(mobile){if(new URLSearchParams(location.search).has('capture')){Object.assign(state,mobileDefaults);return;}try{if(localStorage.getItem('ribbon-mobile-tuning')!=='4'){Object.assign(state,mobileDefaults);saveSettings();localStorage.setItem('ribbon-mobile-tuning','4')}}catch{Object.assign(state,mobileDefaults)}}}
migrateMobileSettings();
// Restore the desktop's horizontal view once; subsequent GUI choices persist.
function restoreDesktopOrientation(){if(!mobile){try{if(localStorage.getItem('ribbon-desktop-orientation')!=='1'){state.vertical=0;saveSettings();localStorage.setItem('ribbon-desktop-orientation','1')}}catch{state.vertical=0}}}
restoreDesktopOrientation();
function migrateDesktopSettings(){if(!mobile){const tuning={rotation:0,distance:100,curve:74};try{if(localStorage.getItem('ribbon-desktop-tuning')!=='2'){Object.assign(state,tuning);saveSettings();localStorage.setItem('ribbon-desktop-tuning','2')}if(localStorage.getItem('ribbon-zero-tilt')!=='1'){state.rotation=0;saveSettings();localStorage.setItem('ribbon-zero-tilt','1')}}catch{Object.assign(state,tuning)}}}
migrateDesktopSettings();

let featured=[];
let featuredProjects=[],allProjects=[],catalogRevision=0;
const posterCache=new Map();
let names=Array.from({length:12},(_,i)=>`Featured ${String(i+1).padStart(2,'0')}`);
let count=names.length,position=0,target=0,lastTime=0,raf=0,snapTimer,texture,ready=false;
let scrollVelocity=0;
let stackedDeparture=0;
let exportPixelRatio=0;
let videoSlides=[],atlasWidth=1024,atlasHeight=640,videoUploader=null;
let atlasColumns=12,atlasRows=1;
const numberLabel=document.querySelector('#slide-number'),titleLabel=document.querySelector('#slide-title');
let uiKey='';
const frameMeter=new FrameMeter();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduced)position=0;
const controls=[['rotation','Head tilt',-45,45,'°'],['distance','Viewing distance',0,100,'%'],['curve','Curvature',0,100,'%'],['scale','Ribbon size',60,150,'%'],['speed','Scroll sensitivity',25,200,'%'],['blur','Motion blur',0,150,'%'],['blurThreshold','Blur threshold',0,100,'%'],['amount','Twist amount',0,180,'°'],['spread','Twist spread',20,160,'%']];
for(const [key,label,min,max,unit]of controls){const row=document.createElement('div');row.className='control';row.innerHTML=`<div class="control-top"><label for="${key}">${label}</label><output for="${key}" id="${key}-value">${state[key]}${unit}</output></div><input id="${key}" type="range" min="${min}" max="${max}" value="${state[key]}">`;document.querySelector('#controls').append(row);row.querySelector('input').addEventListener('input',e=>{state[key]=+e.target.value;document.getElementById(key+'-value').textContent=state[key]+unit;saveSettings();requestRender()})}
const velocityShape=new VelocityShape();
const velocityControls=document.createElement('div');
document.querySelector('#controls').before(velocityControls);
for(const [toggle,key,label,max,unit] of [
 ['velocityTilt','velocityTiltAmount','Velocity tilt',30,'°'],
 ['velocityCurve','velocityCurveAmount','Velocity curvature',100,'%']
]){
 const section=document.createElement('div');
 section.innerHTML=`<label class="switch-row">${label}<input id="${toggle}" type="checkbox"></label><div class="control"><div class="control-top"><label for="${key}">${toggle==='velocityTilt'?'Maximum added tilt':'Maximum added curvature'}</label><output id="${key}-value"></output></div><input id="${key}" type="range" min="0" max="${max}" step="1"></div>`;
 section.querySelector('#'+toggle).onchange=e=>{state[toggle]=e.target.checked?1:0;syncVelocityControls();saveSettings();requestRender()};
 section.querySelector('#'+key).oninput=e=>{state[key]=+e.target.value;syncVelocityControls();saveSettings();requestRender()};
 velocityControls.append(section);
}
function syncVelocityControls(){
 velocityControls.hidden=mobile;velocityControls.style.display=mobile?'none':'';
 for(const [toggle,key,unit] of [['velocityTilt','velocityTiltAmount','°'],['velocityCurve','velocityCurveAmount','%']]){
  document.getElementById(toggle).checked=!!state[toggle];
  const input=document.getElementById(key);input.value=state[key];input.disabled=!state[toggle];
  document.getElementById(key+'-value').textContent=state[key]+unit;
 }
}
const mouseTilt=new MouseTilt(state.rotation);
const mouseTiltRow=document.createElement('div');mouseTiltRow.className='switch-row';
mouseTiltRow.innerHTML='<label for="mouse-tilt">Mouse-controlled tilt</label><input type="checkbox" id="mouse-tilt">';
document.querySelector('#controls').before(mouseTiltRow);
const mouseTiltToggle=mouseTiltRow.querySelector('input');
const mouseTiltLimits=document.createElement('div');mouseTiltRow.after(mouseTiltLimits);
for(const [key,label,min,max] of [['mouseTiltMin','Minimum tilt (top)',-45,0],['mouseTiltMax','Maximum tilt (bottom)',0,45]]){
 const row=document.createElement('div');row.className='control';
 row.innerHTML=`<div class="control-top"><label for="${key}">${label}</label><output id="${key}-value" for="${key}"></output></div><input id="${key}" type="range" min="${min}" max="${max}" step="1">`;
 row.querySelector('input').oninput=e=>{state[key]=+e.target.value;syncMouseTilt();saveSettings();requestRender()};mouseTiltLimits.append(row);
}
function syncMouseTilt(){
 syncVelocityControls();
 mouseTiltRow.hidden=mobile;mouseTiltRow.style.display=mobile?'none':'';
 mouseTiltLimits.hidden=mobile;
 for(const key of ['mouseTiltMin','mouseTiltMax']){
  const input=document.getElementById(key);input.value=state[key];input.disabled=mobile||!state.mouseTilt;
  document.getElementById(key+'-value').textContent=state[key]+'°';
 }
 mouseTiltToggle.checked=!!state.mouseTilt;mouseTiltToggle.disabled=mobile;
 document.querySelector('#rotation').disabled=!mobile&&!!state.mouseTilt;
}
mouseTiltToggle.onchange=()=>{state.mouseTilt=mouseTiltToggle.checked?1:0;syncMouseTilt();saveSettings();requestRender()};
window.addEventListener('pointermove',e=>{
 if(e.pointerType!=='mouse'||mobile)return;
 mouseTilt.y=Math.max(0,Math.min(1,e.clientY/Math.max(1,innerHeight)));
 if(state.mouseTilt)requestRender();
},{passive:true});
syncMouseTilt();
const stackedToggle=document.querySelector('#stacked');stackedToggle.checked=!!state.stacked;
stackedToggle.onchange=()=>{state.stacked=stackedToggle.checked?1:0;saveSettings();requestRender()};
const verticalToggle=document.querySelector('#vertical');verticalToggle.checked=!!state.vertical;
function syncDirection(){if(!gridView?.target){const arrow=document.querySelector('.hint span');if(arrow)arrow.textContent=state.vertical?'↕':'↔';}document.querySelector('#prev').textContent=state.vertical?'↑':'←';document.querySelector('#next').textContent=state.vertical?'↓':'→';}
verticalToggle.onchange=()=>{state.vertical=verticalToggle.checked?1:0;drag=null;saveSettings();syncDirection();requestRender()};
const twistToggle=document.querySelector('#twist');
function syncTwist(){syncMouseTilt();twistToggle.checked=!!state.twist;for(const key of ['amount','spread'])document.getElementById(key).disabled=!state.twist}
twistToggle.onchange=()=>{state.twist=twistToggle.checked?1:0;syncTwist();saveSettings();requestRender()};syncTwist();
const mod=(v,n)=>(v%n+n)%n;
function updateUI(){
 if(!gridView?.target)refreshFeaturedTooltip();
 const key=gridView?.target?'grid:'+ (gridView.hover?.index??'none')+':'+gridView.projects.length:'featured:'+mod(Math.round(position),count);
 if(key===uiKey)return;uiKey=key;
 const currentProject=gridView?.target?gridView.hover?.project:featured[mod(Math.round(position),count)];
 const tags=(currentProject?.tags||[]).filter(tag=>typeof tag==='string'&&tag.trim()).join(', ');
 // Host integration: the tags line always keeps its height (a non-breaking space when a project has no
 // tags) so the name above it never jumps as different projects are highlighted.
 const tagsLabel=document.querySelector('.project-services');tagsLabel.textContent=tags||'\u00a0';
 if(gridView&&gridView.target){const hover=gridView.hover;numberLabel.textContent=hover?`${String(hover.index+1).padStart(2,'0')} / ${gridView.projects.length}`:`${gridView.projects.length} projects`;titleLabel.textContent=hover?hover.project.name:'Explore all projects';return;}
 const index=mod(Math.round(position),count);numberLabel.textContent=`${String(index+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`;titleLabel.textContent=names[index];document.querySelectorAll('#dots button').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-current',i===index?'true':'false')})}
function buildDots(){uiKey='';document.querySelector('#dots').replaceChildren();names.forEach((name,i)=>{const b=document.createElement('button');b.setAttribute('aria-label','Go to '+name);b.onclick=()=>{if(returningToFeatured())return;clearTimeout(snapTimer);target+=mod(i-mod(Math.round(target),count)+count/2,count)-count/2;target=Math.round(target);requestRender()};document.querySelector('#dots').append(b)});updateUI()}
function returningToFeatured(){return projectTransition.active||projectTransition.loading||projectTransition.returning||gridView?.returning&&!gridView.target&&gridView.mix>0}
function move(direction){if(returningToFeatured())return;clearTimeout(snapTimer);target=Math.round(target)+direction;requestRender()}
document.querySelector('#prev').onclick=()=>move(-1);document.querySelector('#next').onclick=()=>move(1);
window.addEventListener('keydown',e=>{if(returningToFeatured())return;if(/INPUT|BUTTON|SELECT/.test(e.target.tagName))return;if(e.key==='Escape'){tooltipDismissed=true;clearProjectTooltip();return;}if(e.target===canvas){tooltipInput='keyboard';tooltipDismissed=false;requestRender();if(e.key==='Enter'||e.key===' '){e.preventDefault();projectKeyboardClick();return;}}if(gridView?.isActive()){const step=150;if(e.key==='ArrowLeft')gridView.goal.x+=step;else if(e.key==='ArrowRight')gridView.goal.x-=step;else if(e.key==='ArrowUp')gridView.goal.y+=step;else if(e.key==='ArrowDown')gridView.goal.y-=step;else return;e.preventDefault();requestRender();return;}if(e.key==='ArrowRight'||e.key==='ArrowLeft'||(state.vertical&&(e.key==='ArrowDown'||e.key==='ArrowUp'))){e.preventDefault();move(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1)}});
function scheduleSnap(){clearTimeout(snapTimer);if(projectTransition.loading||projectTransition.active)return;if(document.querySelector('#snap').checked)snapTimer=setTimeout(()=>{target=Math.round(target);requestRender()},160)}
canvas.addEventListener('wheel',e=>{e.preventDefault();if(returningToFeatured())return;if(gridView?.isActive()){gridView.wheel(e);return;}const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;target+=Math.max(-250,Math.min(250,delta*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1)))*.0025*state.speed/100;scheduleSnap();requestRender()},{passive:false});
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(returningToFeatured())return;tooltipInput=e.pointerType==='touch'?'touch':'pointer';tooltipPoint={x:e.clientX,y:e.clientY};tooltipDismissed=false;clearProjectTooltip();clearTimeout(snapTimer);canvas.setPointerCapture(e.pointerId);if(gridView?.isActive()){gridView.pointerDown(e);return;}drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.style.cursor='grabbing'});
canvas.addEventListener('pointermove',e=>{if(returningToFeatured())return;tooltipInput=e.pointerType==='touch'?'touch':'pointer';tooltipPoint={x:e.clientX,y:e.clientY};tooltipDismissed=false;if(gridView?.isActive()){gridView.pointerMove(e);return;}if(!drag){refreshFeaturedTooltip();return;}clearProjectTooltip();target+=(state.vertical?(e.clientY-drag.y)/Math.max(220,innerHeight*.3):(drag.x-e.clientX)/Math.max(220,innerWidth*.3))*state.speed/100;drag.x=e.clientX;drag.y=e.clientY;drag.moved ||= Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5;requestRender()});
function projectClick(project,hit){if(!isProjectClickable(project)){showProjectTooltip(project,tooltipInput==='keyboard'?{x:innerWidth/2,y:innerHeight/2}:tooltipPoint);return;}clearProjectTooltip();if(/^https?:\/\//.test(project.href)){if(window.parent!==window)window.parent.postMessage({type:'projects:open',href:project.href},location.origin);else window.open(project.href,'_blank','noopener,noreferrer');return;}projectTransition.open(project,hit||project.ribbonHit);canvas.dispatchEvent(new CustomEvent('project:select',{detail:{project},bubbles:true}));}
function projectKeyboardClick(){if(gridView?.isActive()){const hit=gridView.hitTest(innerWidth/2,innerHeight/2);if(hit)projectClick(hit.project,{...hit,grid:true})}else projectClick(pickFeatured(innerWidth/2,innerHeight/2));}
canvas.addEventListener('pointerup',e=>{if(returningToFeatured())return;tooltipInput=e.pointerType==='touch'?'touch':'pointer';tooltipPoint={x:e.clientX,y:e.clientY};if(gridView?.isActive()){if(gridView.pointerUp()){const hit=gridView.hitTest(e.clientX,e.clientY);if(hit)projectClick(hit.project,{...hit,grid:true})}}else{if(drag&&!drag.moved)projectClick(pickFeatured(e.clientX,e.clientY));drag=null;scheduleSnap()}requestRender();});
canvas.addEventListener('pointercancel',()=>{drag=null;if(gridView)gridView.drag=null});
canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='touch')return;tooltipPoint=null;if(tooltipInput==='pointer')tooltipInput=null;clearProjectTooltip();if(gridView){gridView.pointer=null;gridView.clearHover();requestRender()}});
canvas.addEventListener('focus',()=>{tooltipInput='keyboard';tooltipDismissed=false;requestRender()});
canvas.addEventListener('blur',()=>{tooltipInput=null;tooltipPoint=null;clearProjectTooltip();if(gridView)gridView.pointer=null;requestRender()});
function refreshFeaturedTooltip(){
 const point=tooltipInput==='keyboard'?{x:innerWidth/2,y:innerHeight/2}:tooltipPoint;
 const project=ready&&point&&!drag&&!returningToFeatured()?pickFeatured(point.x,point.y):null;
 canvas.style.cursor=drag?'grabbing':isProjectClickable(project)?'pointer':'grab';
 showProjectTooltip(project,point);
 if(!project)canvas.setAttribute('aria-label','Featured projects. Scroll, drag, or use the arrow keys to explore.');
}
function pickFeatured(clientX,clientY){
 const shaped=featuredView();
 const x=(clientX/innerWidth*2-1)*innerWidth/innerHeight*.77/shaped.scale*100,y=(1-clientY/innerHeight*2)*.77/shaped.scale*100,a=shaped.rotation*Math.PI/180;
 const unrolledX=Math.cos(a)*x+Math.sin(a)*y,unrolledY=-Math.sin(a)*x+Math.cos(a)*y;
 const rx=state.vertical?unrolledY:unrolledX,ry=state.vertical?unrolledX:unrolledY;
 const pitch=state.vertical?Math.PI/4.8:Math.PI/3;
 const radius=14-10.4*shaped.curve/100,distance=2.5+4.5*state.distance/100,z=radius-distance,A=rx*rx+1;
 const t=(-z+Math.sqrt(z*z+A*(radius*radius-z*z)))/A;
 const halfHeight=radius*pitch*(state.vertical?.8:1/3.2),vertical=t*ry;
 let band=0;if(Math.abs(vertical)>halfHeight){if(!state.stacked)return null;band=Math.sign(vertical);if(Math.abs(vertical-band*halfHeight*2.08)>halfHeight)return null;}
 const angle=Math.atan2(t*rx,z+t),shift=Math.max(1,Math.floor(count*(band===1?1:2)/3));
 const index=band?mod(count-1-Math.floor(angle/pitch-position+count-1-shift+1.0),count):mod(Math.floor(angle/pitch+position+.5),count);
 const offset=band?mod(-position+count-1-shift+.5,count):mod(position,count);
 return {...(featured[index]||{name:names[index],index}),ribbonHit:{band,slide:Math.floor(angle/pitch+offset+.5)}};
}
function setProjectView(all){
 if(mobile)all=false;
 if(!gridView)return;idleMotion.reset();introduction.finish();clearTimeout(snapTimer);drag=null;scrollVelocity=0;target=position;const selected=gridView.setView(all,position,!!state.vertical);if(selected!==null)position=target=selected;
 tooltipInput=null;tooltipPoint=null;clearProjectTooltip();
 canvas.setAttribute('aria-label',all?'All projects. Drag in any direction or scroll vertically to explore the infinite grid.':'Featured projects. Scroll or drag to explore the curved ribbon.');document.body.classList.toggle('all-projects',all);document.querySelector('#view-featured').setAttribute('aria-pressed',String(!all));document.querySelector('#view-all').setAttribute('aria-pressed',String(all));
 document.querySelector('#featured-controls').hidden=all;document.querySelector('#grid-controls').hidden=!all;
 document.querySelector('.panel-copy').textContent=all?'A quieter grid. Curvature follows motion.':'Inside the ribbon. Find your perspective.';
 document.querySelector('.hint').innerHTML=all?'Drag or scroll to explore <img src="assets/scroll-direction.svg" width="12" height="12" alt="">':'Scroll or drag to move <img src="assets/scroll-direction.svg" width="12" height="12" alt="">';
 if(mobile)canvas.setAttribute('aria-label','All projects. Scroll or drag to explore the curved ribbon.');
 syncDirection();requestRender();
}
document.querySelector('#view-featured').onclick=()=>setProjectView(false);document.querySelector('#view-all').onclick=()=>setProjectView(true);
function panel(open){document.querySelector('#settings').classList.toggle('hidden',!open);document.querySelector('#settings').inert=!open;document.querySelector('#toggle').setAttribute('aria-expanded',String(open))}document.querySelector('#toggle').onclick=()=>panel(document.querySelector('#settings').classList.contains('hidden'));document.querySelector('#close').onclick=()=>{panel(false);document.querySelector('#toggle').focus()};panel(false);
document.querySelector('#reset').onclick=()=>{if(gridView?.isActive()){Object.assign(gridView.settings,{size:100,gap:32,curve:8,response:100,inertia:95,exitEarly:65});gridView.pan={x:0,y:0};gridView.goal={x:0,y:0};document.querySelector('#grid-controls').innerHTML='<summary>All projects <span>Layout & movement</span></summary><p class="grid-note">Drag in any direction. Movement brings the curve back.</p>';try{localStorage.removeItem('ribbon-grid-settings')}catch{}gridView.createControls();requestRender();return;}Object.assign(state,defaults);document.querySelector('#snap').checked=true;controls.forEach(([key,,, ,unit])=>{document.getElementById(key).value=state[key];document.getElementById(key+'-value').textContent=state[key]+unit});syncTwist();stackedToggle.checked=!!state.stacked;verticalToggle.checked=!!state.vertical;syncDirection();saveSettings();requestRender()};
const showRibbonSettings=new URL(routeLocation.href).searchParams.has('projectSettings');
document.querySelector('#toggle').hidden=true;
panel(showRibbonSettings);document.querySelector('#intro-controls').open=showRibbonSettings;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const introduction=new RibbonIntroduction(requestRender,()=>{if(gridView?.target||gridView?.mix){setProjectView(false);gridView.mix=0;gridView.aligning=false;gridView.returnMotion=null;gridView.pan={x:0,y:0};gridView.goal={x:0,y:0}}position=target;});
for(const event of ['wheel','pointerdown'])canvas.addEventListener(event,()=>introduction.finish(),{capture:true,passive:true});
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key)&&!['INPUT','SELECT'].includes(e.target.tagName))introduction.finish()},{capture:true});
document.querySelector('nav').addEventListener('click',()=>introduction.finish(),true);
const idleMotion=new IdleMotion(requestRender);
for(const event of ['pointermove','pointerdown','pointerup','wheel','keydown'])window.addEventListener(event,()=>idleMotion.activity(),{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>idleMotion.reset());
let program,uniforms={},ribbonBuffer,ribbonIndices,ribbonAttrib,gridView=null;
const projectTransition=new ProjectTransition(gl);
// A two-sided subdivided cylinder, with an upright texture mapping for either axis.
// Twist leaves the central 1.24 slides flat.
const meshSegments=mobile?320:1200,meshRows=mobile?4:8;
function setup(){
 program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,`
 precision highp float;
 attribute vec2 aPosition;
 uniform float uRotation,uDistance,uCurve,uScale,uAspect,uCount,uTwist,uAmount,uSpread;
 uniform float uReveal,uEffect,uIntensity,uBand,uVertical,uStackExit;
 varying vec2 vUV;
 varying float vLight;
 vec3 surface(float angle,float height){
  float radius=mix(14.0,3.6,uCurve);
  float distance=mix(2.5,7.0,uDistance);
  float pitch=mix(1.0471975512,.6544984695,uVertical);
  float slides=abs(angle)/pitch;
  float ramp=smoothstep(.62,.62+uSpread,slides);
  float closure=1.0-smoothstep(2.5,3.14159265359,abs(angle));
  float twist=sign(angle)*uAmount*uTwist*ramp*closure;
  // Keep upright 16:10 slides: arc width in horizontal mode, arc height in vertical mode.
  float halfHeight=radius*pitch*mix(.3125,.8,uVertical);
  float vertical=height*halfHeight;
  float radial=radius+vertical*sin(twist);
  vec2 xy=vec2(radial*sin(angle),vertical*cos(twist));
  if(uVertical>.5)xy=xy.yx;
  return vec3(xy,radius-distance-radial*cos(angle));
 }
 void main(){
  float angle=aPosition.x;
  float eased=1.0-pow(1.0-uReveal,3.0);
  float remaining=1.0-eased;
  vec3 p=surface(angle,aPosition.y);
  float bandOffset=uBand*mix(14.0,3.6,uCurve)*mix(1.0471975512*.3125,.6544984695*.8,uVertical)*2.08;
  if(uVertical>.5)p.x+=bandOffset;else p.y+=bandOffset;
  vLight=1.0;
  if(uTwist>.001){
   vec3 tangent=surface(angle+.001,aPosition.y)-surface(angle-.001,aPosition.y);
   vec3 across=surface(angle,aPosition.y+.001)-surface(angle,aPosition.y-.001);
   vec3 normal=normalize(cross(tangent,across));
   vLight=mix(1.0,.72+.28*abs(dot(normal,normalize(vec3(-.2,.6,1.0)))),uTwist);
  }
  float c=cos(uRotation),s=sin(uRotation);
  // Scale the projected view uniformly; never stretch the slide height alone.
  vec2 xy=(mat2(c,s,-s,c)*p.xy)*uScale;
  if(uEffect==1.0)xy*=1.0-remaining*.15*uIntensity;
  float near=.04,far=100.0;
  gl_Position=vec4(xy.x/(.77*uAspect),xy.y/.77,
    -(far+near)/(far-near)*p.z-2.0*far*near/(far-near),-p.z);
  vec2 departureDirection=uVertical>.5?vec2(c,s):vec2(-s,c);
  gl_Position.xy+=departureDirection*sign(uBand)*uStackExit*3.0*gl_Position.w;
  vUV=vec2(angle/mix(1.0471975512,.6544984695,uVertical)/6.0,.5-aPosition.y*.5);
 }
 `));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
 precision highp float;
 uniform sampler2D uTexture;
 uniform float uOffset,uCount,uReveal,uEffect,uIntensity,uMotionBlur,uReverse,uFade,uVertical,uOpacity;
 uniform float uCascadeEase,uCascadeStagger;
 uniform vec2 uAtlasSize;
 uniform vec2 uResolution;
 varying vec2 vUV;
 varying float vLight;
 vec4 sampleSlide(float slide,float y){
  float index=mod(floor(slide),uCount);
  if(uReverse>.5)index=uCount-1.0-index;
  vec2 imageUV=uVertical>.5?vec2(1.0-y,1.0-fract(slide)):vec2(fract(slide),y);
  return texture2D(uTexture,(vec2(mod(index,uAtlasSize.x),floor(index/uAtlasSize.x))+clamp(imageUV,vec2(.001),vec2(.999)))/uAtlasSize);
 }
 void main(){
  float slide=vUV.x*6.0+uOffset+.5;
  vec2 uv=vec2(fract(slide/uCount),vUV.y);
  // The reverse keeps each image attached to its corresponding front slide.
  vec2 backUV=vec2(uv.x,1.0-vUV.y);
  bool front=uVertical>.5?!gl_FrontFacing:gl_FrontFacing;
  vec4 colour=sampleSlide(slide,front?vUV.y:1.0-vUV.y);
  if(uMotionBlur>.0001){
   vec2 base=front?uv:backUV;
   vec4 sum=vec4(0.0);
   float radius=uMotionBlur;
   for(int i=0;i<9;i++){
    float t=float(i)/8.0-.5;
    vec2 delta=vec2(t*radius/uCount,0.0);
    sum+=sampleSlide(slide+delta.x*uCount,base.y+delta.y);
   }
   colour=sum/9.0;
  }
  float reveal=smoothstep(0.0,.35,uReveal);
  if(uEffect==1.0)reveal=pow(smoothstep(0.0,1.0,uReveal),uIntensity);
  if(uEffect==9.0){
   // Stagger out from the visible centre, not the repeating atlas indices.
   float order=min(4.0,abs(floor(slide)-floor(uOffset+.5)));
   float progress=clamp((uReveal-order*uCascadeStagger)/(1.0-4.0*uCascadeStagger),0.0,1.0);
   // Zero velocity and acceleration at both ends avoids a hard clip start/stop.
   float arrival=progress*progress*progress*(progress*(progress*6.0-15.0)+10.0);
   if(uCascadeEase==1.0)arrival=1.0-pow(1.0-progress,3.0);
   if(uCascadeEase==2.0)arrival=1.0-pow(1.0-progress,4.0);
   if(uCascadeEase==3.0)arrival=.5-.5*cos(progress*3.14159265359);
   if(uCascadeEase==4.0)arrival=progress;
   float inset=max(abs(fract(slide)-.5),abs(vUV.y-.5));
   float clipFeather=.006+.008*uIntensity;
   float opening=mix(-clipFeather,.5+clipFeather,arrival);
   reveal=1.0-smoothstep(opening-clipFeather,opening+clipFeather,inset);
  }
  if(uReveal>=1.0)reveal=1.0;
  // Fade the entire surface into the scene, including the image's dark areas.
  gl_FragColor=vec4(colour.rgb*vLight,uOpacity*reveal*uFade);
 }
 `));
 gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);
 const vertices=[],indices=[];
 for(let i=0;i<=meshSegments;i++)for(let j=0;j<=meshRows;j++)vertices.push(-Math.PI+i*2*Math.PI/meshSegments,-1+2*j/meshRows);
 for(let i=0;i<meshSegments;i++)for(let j=0;j<meshRows;j++){const a=i*(meshRows+1)+j,b=a+meshRows+1;indices.push(a,b,a+1,a+1,b,b+1)}
 ribbonBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,ribbonBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
 ribbonIndices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ribbonIndices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
 const a=gl.getAttribLocation(program,'aPosition');ribbonAttrib=a;
 gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
 for(const n of ['Rotation','Distance','Curve','Scale','Aspect','Offset','Count','Twist','Amount','Spread','Reveal','Effect','Intensity','Resolution','MotionBlur','Band','Reverse','Fade','Vertical','StackExit','Opacity'])uniforms[n]=gl.getUniformLocation(program,'u'+n);
 gl.uniform1i(gl.getUniformLocation(program,'uTexture'),0);
 uniforms.AtlasSize=gl.getUniformLocation(program,'uAtlasSize');
 uniforms.CascadeEase=gl.getUniformLocation(program,'uCascadeEase');uniforms.CascadeStagger=gl.getUniformLocation(program,'uCascadeStagger');
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 const background=getComputedStyle(document.documentElement).backgroundColor.match(/[\d.]+/g).map(Number);
 gl.clearColor(background[0]/255,background[1]/255,background[2]/255,1);
}
// Threshold is measured against slide velocity, independent of frame rate.
// A soft knee keeps the onset smooth while remaining exactly sharp below it.
function featuredBlur(velocity,threshold,strength){
 const excess=Math.max(0,Math.abs(velocity)-threshold/10);
 return Math.min(.75,.045*excess*excess/(excess+1))*strength/100;
}
function drawFeaturedRibbons(){
 gl.uniform1f(uniforms.CascadeEase,introduction.settings.cascadeEase);
 gl.uniform1f(uniforms.CascadeStagger,introduction.settings.cascadeStagger/(introduction.settings.duration*1000+4*introduction.settings.cascadeStagger));
 gl.uniform2f(uniforms.AtlasSize,atlasColumns,atlasRows);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ribbonIndices);
 const mix=gridView?.mix||0;
 gl.uniform1f(uniforms.StackExit,0);gl.uniform1f(uniforms.Opacity,1);
 gl.uniform1f(uniforms.Fade,1);gl.uniform1f(uniforms.Band,0);gl.uniform1f(uniforms.Reverse,0);
 gl.uniform1f(uniforms.Offset,mod(position,count));
 const handoff=gridView?gridView.ribbonHandoff():1;
 if(handoff>0){
  // Crossfade coverage, not image brightness: an opaque dimmed ribbon
  // leaves a black silhouette behind the morphing project tiles.
  gl.uniform1f(uniforms.Opacity,handoff);
  if(handoff<1||introduction.progress<1){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA)}
  gl.drawElements(gl.TRIANGLES,meshSegments*meshRows*6,gl.UNSIGNED_SHORT,0);
  gl.disable(gl.BLEND);
 }
 if(state.stacked&&stackedDeparture<1){
  const departure=stackedDeparture*stackedDeparture*(3-2*stackedDeparture);
  gl.uniform1f(uniforms.Reverse,1);gl.uniform1f(uniforms.Fade,1);
  gl.uniform1f(uniforms.StackExit,departure);gl.uniform1f(uniforms.Opacity,1-departure);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  for(const band of [-1,1]){
   const shift=Math.max(1,Math.floor(count*(band===1?1:2)/3));
   gl.uniform1f(uniforms.Band,band);gl.uniform1f(uniforms.Offset,mod(-position+count-1-shift+.5,count));
   gl.drawElements(gl.TRIANGLES,meshSegments*meshRows*6,gl.UNSIGNED_SHORT,0);
  }
  gl.depthMask(true);gl.disable(gl.BLEND);
 }
}
function requestRender(){if(ready&&!raf&&(hostActive||!hostPrepared))raf=requestAnimationFrame(render)}
function updateStackedDeparture(dt){
 const destination=gridView&&(gridView.target||gridView.mix>.12)?1:0;
 stackedDeparture+=(destination-stackedDeparture)*(reduced?1:1-Math.exp(-dt*(destination?16:10)));
 if(Math.abs(destination-stackedDeparture)<.0005)stackedDeparture=destination;
 if(state.stacked&&stackedDeparture!==destination)requestRender();
}
function render(time){
 if(hostPrepared&&(!hostActive||hostTransition())){raf=0;return;}
 const dpr=exportPixelRatio||Math.min(devicePixelRatio||1,mobile?1.5:2);
 const w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
 let wavePass=false;
 try{wavePass=!!loaderWave?.begin();}catch{gl.bindFramebuffer(gl.FRAMEBUFFER,null);loaderWave?.dispose();loaderWave=null;}
 renderScene(time);
 if(wavePass)loaderWave.end();
}
function renderScene(time){if(projectTransition.active){raf=0;projectTransition.draw(time);return;}frameMeter.begin(time);raf=0;const dt=Math.min((time-lastTime)/1000||.016,.05);lastTime=time;const introMoving=introduction.update(time);const idle=idleMotion.update(time,dt,gridView?.target?'all':'featured',projectTransition.loading||introMoving||!!drag||!!gridView?.drag||!!(gridView&&gridView.mix!==gridView.target));
mouseTilt.update(dt,!introMoving&&!mobile&&!!state.mouseTilt,state.rotation,reduced,state.mouseTiltMin,state.mouseTiltMax);
if(mouseTilt.moving)requestRender();
updateStackedDeparture(dt);
if(idle.delta){if(gridView?.target){gridView.goal.x+=idle.delta;gridView.goal.y+=idle.delta;}else{clearTimeout(snapTimer);target+=idle.delta*(state.vertical?-1:1);}}
if(idle.stopped&&!gridView?.target)scheduleSnap();const gridMoving=gridView?.update(dt);updateVideoTextures();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,ribbonBuffer);gl.enableVertexAttribArray(ribbonAttrib);gl.vertexAttribPointer(ribbonAttrib,2,gl.FLOAT,false,0,0);gl.enable(gl.DEPTH_TEST);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);const previousPosition=position;position=reduced?target:position+(target-position)*(1-Math.exp(-dt*9));if(Math.abs(target-position)<.0001)position=target;const velocity=(position-previousPosition)/Math.max(dt,.001);scrollVelocity+=(velocity-scrollVelocity)*(1-Math.exp(-dt*14));if(Math.abs(scrollVelocity)<.001)scrollVelocity=0;velocityShape.update(dt,scrollVelocity,state,!mobile&&!reduced&&!introMoving&&!idle.delta&&!gridView?.target&&!(gridView?.mix>0),reduced);if(velocityShape.moving)requestRender();const shaped=featuredView();if(Math.abs(target)>count*100){const shift=Math.trunc(target/count)*count;position-=shift;target-=shift}const dpr=exportPixelRatio||Math.min(devicePixelRatio||1,mobile?1.5:2),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.Vertical,state.vertical);gl.uniform1f(uniforms.Rotation,shaped.rotation*Math.PI/180);gl.uniform1f(uniforms.Distance,state.distance/100);gl.uniform1f(uniforms.Curve,shaped.curve/100);gl.uniform1f(uniforms.Scale,shaped.scale/100);gl.uniform1f(uniforms.Aspect,w/h);gl.uniform1f(uniforms.Offset,mod(position,count));gl.uniform1f(uniforms.Count,count);gl.uniform1f(uniforms.Twist,state.twist);gl.uniform1f(uniforms.Amount,state.amount*Math.PI/180);gl.uniform1f(uniforms.Spread,state.spread/100);gl.uniform1f(uniforms.Reveal,introduction.progress);gl.uniform1f(uniforms.Effect,reduced?1:introduction.settings.effect);gl.uniform1f(uniforms.Intensity,introduction.settings.intensity/100);gl.uniform2f(uniforms.Resolution,w,h);gl.uniform1f(uniforms.MotionBlur,reduced||introMoving?0:featuredBlur(scrollVelocity,state.blurThreshold,state.blur));drawFeaturedRibbons();if(gridView&&gridView.mix>0)gridView.render(texture,count,shaped);updateUI();frameMeter.end();if(projectTransition.pending){try{projectTransition.begin(shaped)}catch(error){projectTransition.close();showCatalogError(error)}return;}if(idle.moving||introMoving||gridMoving||scrollVelocity!==0||position!==target||videoSlides.some(item=>!item.video.requestVideoFrameCallback&&!item.video.paused&&!document.hidden))requestRender()}
window.addEventListener('resize',requestRender);
mobileViewport.addEventListener('change',()=>{
 mobile=mobileViewport.matches;mouseTilt.y=.5;settingsKey=mobile?'ribbon-settings-mobile':'ribbon-settings';
 Object.assign(defaults,desktopDefaults,mobile?mobileDefaults:{});Object.assign(state,defaults);
 try{const saved=JSON.parse(localStorage.getItem(settingsKey)||'{}');for(const key in defaults)if(Number.isFinite(saved[key]))state[key]=saved[key]}catch{}
 migrateMobileSettings();restoreDesktopOrientation();migrateDesktopSettings();mouseTilt.rotation=state.rotation;velocityShape.tilt=velocityShape.curve=0;
 controls.forEach(([key,,,,unit])=>{document.getElementById(key).value=state[key];document.getElementById(key+'-value').textContent=state[key]+unit});
 verticalToggle.checked=!!state.vertical;stackedToggle.checked=!!state.stacked;syncTwist();syncDirection();
 if(gridView)gridView.vertical=!!state.vertical;
 if(allProjects.length)applyRibbonCatalog().catch(showCatalogError);
 requestRender();
});
// Host integration: a poster that fails or stalls is swapped for the CMS placeholder (src/data/site.ts) so the ribbon never breaks.
function imageLoad(src,allowFallback=true){return new Promise((resolve,reject)=>{const im=new Image();const fallback=allowFallback&&window.ribbonPlaceholder;const recover=error=>fallback&&src!==fallback?resolve(imageLoad(fallback)):reject(error);const timer=setTimeout(()=>{im.onload=im.onerror=null;recover(Error('A project image is taking too long to load. Please reload.'))},20000);im.onload=()=>{clearTimeout(timer);resolve(im)};im.onerror=()=>{clearTimeout(timer);recover(Error('A project image could not load. Please reload.'))};im.crossOrigin='anonymous';im.src=src})}
function cover(ctx,img,x,y,w,h){const s=Math.max(w/img.width,h/img.height),sw=w/s,sh=h/s;ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h)}
function makeAtlas(images){
 stopVideos();
 // Keep the backing canvas within mobile browser memory limits as well as
 // the GPU texture limit (the two limits are not necessarily the same).
 const max=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),mobile?8192:16384);
 atlasColumns=mobile?Math.min(12,images.length):images.length;atlasRows=Math.ceil(images.length/atlasColumns);
 const W=Math.min(1024,Math.floor(max/atlasColumns/16)*16),H=W*10/16;
 const atlas=document.createElement('canvas');atlas.width=W*atlasColumns;atlas.height=H*atlasRows;
 atlasWidth=W;atlasHeight=H;
 const c=atlas.getContext('2d');
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 images.forEach((im,i)=>cover(c,im,(i%atlasColumns)*W,Math.floor(i/atlasColumns)*H,W,H));

 if(texture)gl.deleteTexture(texture);texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);if(gl.getError()!==gl.NO_ERROR)throw Error('The project images could not be loaded into WebGL. Please reload.');if(!videoUploader)videoUploader=new VideoAtlasUploader(gl);videoUploader.attach(texture);ready=!!texture;requestRender()}
function stopVideos(){
 for(const item of videoSlides){item.stopped=true;if(item.callback&&item.video.cancelVideoFrameCallback)item.video.cancelVideoFrameCallback(item.callback);item.video.pause();item.video.removeAttribute('src');item.video.load();item.video.remove()}
 videoSlides=[];
}
function videoIsVisible(index){
 if(gridView&&gridView.mix>.01&&gridView.visibleFeatured.has(index))return true;
 if(gridView?.mix===1)return false;
 const near=centre=>Math.abs(mod(index-centre+count/2,count)-count/2)<3.5;
 if(near(position))return true;
 if(state.stacked&&stackedDeparture<1){
  for(const band of [-1,1]){
   const shift=Math.max(1,Math.floor(count*(band===1?1:2)/3));
   if(near(position+shift-.5))return true;
  }
 }
 return false;
}
function updateVideoTextures(){
 const now=performance.now();let uploaded=false;
 for(const item of videoSlides){
  const video=item.video;
  {
   if(!hostActive||hostTransition()||!videoIsVisible(item.index)||document.hidden){if(!video.paused)video.pause();continue;}
   if(video.paused&&!item.playPending&&!item.playBlocked&&!document.hidden){item.playPending=true;video.play().catch(()=>{item.playBlocked=true}).finally(()=>{item.playPending=false})}
  }
  if(!videoIsVisible(item.index)||video.readyState<2||(!item.dirty&&video.requestVideoFrameCallback))continue;
  if(mobile&&now-(item.lastUpload||0)<1000/30)continue;
  item.lastUpload=now;item.dirty=false;
  videoUploader.upload(video,item.index,atlasWidth,atlasHeight,atlasColumns);uploaded=true;
 }
 if(uploaded)videoUploader.finish();
}

function startFeaturedVideos(){
 for(const entry of featured.filter(item=>item.type==='video')){
  const index=entry.index,src=entry.video;
  const video=document.createElement('video');
  video.muted=true;video.defaultMuted=true;video.loop=true;video.autoplay=false;video.playsInline=true;video.preload='metadata';
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.tabIndex=-1;
  video.crossOrigin='anonymous';video.className='texture-video';video.dataset.slide=String(index+1);video.src=src;document.body.append(video);
  const item={index,video,dirty:true,stopped:false,callback:0};videoSlides.push(item);
  const frame=()=>{if(item.stopped)return;item.dirty=true;if(videoIsVisible(item.index))requestRender();if(video.requestVideoFrameCallback)item.callback=video.requestVideoFrameCallback(frame)};
  video.addEventListener('loadeddata',()=>{item.dirty=true;requestRender()});
  video.addEventListener('playing',()=>{requestRender();if(videoSlides.every(item=>!item.video.error&&!item.video.paused))document.querySelector('#upload-note').textContent='Each image or video appears on both sides.'});
  video.addEventListener('error',()=>{document.querySelector('#upload-note').textContent='A video could not load. Its poster is shown instead.'});
  if(video.requestVideoFrameCallback)item.callback=video.requestVideoFrameCallback(frame);
  if(hostActive&&!hostTransition()&&videoIsVisible(index))video.play().catch(()=>{item.playBlocked=true;document.querySelector('#upload-note').textContent='Click or scroll the ribbon to start the muted videos.'});
 }
}
function resumeVideos(){if(!hostActive||hostTransition()||document.hidden||projectTransition.active)return;for(const item of videoSlides){item.playBlocked=false;if(item.video.paused&&videoIsVisible(item.index))item.video.play().catch(()=>{item.playBlocked=true})}}
canvas.addEventListener('pointerdown',resumeVideos);canvas.addEventListener('wheel',resumeVideos,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const item of videoSlides)item.video.pause()}else{resumeVideos();requestRender()}});
document.querySelector('#upload').onclick=()=>document.querySelector('#files').click();document.querySelector('#files').onchange=async e=>{const files=[...e.target.files].filter(f=>f.type.startsWith('image/')).slice(0,12);if(!files.length)return;const urls=files.map(f=>URL.createObjectURL(f));try{const images=await Promise.all(urls.map(imageLoad));names=files.map(f=>f.name.replace(/\.[^.]+$/,''));count=names.length;position=target=0;makeAtlas(images,true);featured=names.map((name,index)=>({name,index,poster:urls[index]}));gridView.setProjects(featured,featured);document.querySelector('#all-count').textContent=featured.length;setProjectView(false);buildDots();document.querySelector('#upload-note').textContent=`${count} image${count===1?'':'s'} loaded. Stored only in this tab.`}catch{document.querySelector('#upload-note').textContent='Could not read those images. Try JPG, PNG, or WebP.'}finally{urls.forEach(URL.revokeObjectURL);e.target.value=''}};
function showCatalogError(error){const status=document.querySelector('#error');status.hidden=false;status.textContent=error.message||'Images could not load. Please reload the page.';console.error(error)}
async function applyRibbonCatalog(){
 const revision=++catalogRevision,items=mobile?allProjects:featuredProjects;
 const previousPoster=featured[mod(Math.round(position),count)]?.poster;
 // Reset the outgoing layout before changing the atlas or its item indices.
 Object.assign(gridView,{target:0,mix:0,returning:false,aligning:false,returnMotion:null,drag:null,pan:{x:0,y:0},goal:{x:0,y:0}});
 stackedDeparture=0;setProjectView(false);
 document.querySelector('#view-all').disabled=mobile;
 document.querySelector('#view-featured').disabled=mobile;
 const images=await Promise.all(items.map(item=>{
  if(!posterCache.has(item.poster))posterCache.set(item.poster,imageLoad(item.poster).catch(error=>{posterCache.delete(item.poster);throw error}));
  return posterCache.get(item.poster);
 }));
 if(revision!==catalogRevision)return;
 featured=items.map((item,index)=>({...item,index}));names=featured.map(item=>item.name);count=names.length;
 position=target=Math.max(0,featured.findIndex(item=>item.poster===previousPoster));
 makeAtlas(images);gridView.setProjects(featured,allProjects);buildDots();startFeaturedVideos();
 canvas.setAttribute('aria-label',`${mobile?'All':'Featured'} projects. Scroll or drag to explore the curved ribbon.`);
 document.querySelector('#all-count').textContent=allProjects.length;
 document.querySelector('#error').hidden=true;requestRender();
}
(async()=>{
 const status=document.querySelector('#error');status.hidden=false;status.textContent='Loading projects…';
 try{
  if(!gl)throw Error('WebGL is unavailable. Please open this in a browser with hardware acceleration enabled.');
  setup();gridView=new ProjectGrid(gl,requestRender);syncDirection();
  // Host integration: the CMS catalog (Sanity via /api/projects-ribbon), falling back to the bundled JSON.
  const loadJson=url=>fetch(url).then(response=>{if(!response.ok)throw Error('Project items could not load. Please reload.');return response.json()});
  const preloaded=window.parent.getPreloadedProjects?.();
  const catalog=preloaded?preloaded.catch(()=>loadJson('/api/projects-ribbon/')):loadJson('/api/projects-ribbon/');
  [featuredProjects,allProjects]=await catalog.then(data=>{window.ribbonPlaceholder=data.placeholder;return[data.featured,data.all]}).catch(()=>Promise.all([loadJson('featured.json'),loadJson('projects.json')]));
  allProjects=allProjects.map((project,index)=>({...project,index}));
  await applyRibbonCatalog();
  // Internal navigation already has its page wave: only cascade the slides afterwards.
  if(new URL(location.href).searchParams.get('entrance')==='cascade'){
   introduction.settings.effect=9;introduction.sync();
  }
  if(loaderWave){
   introduction.finish();
   if(window.parent.document.querySelector('[data-site-loader]')?.dataset.complete==='true'){loaderWave.dispose();loaderWave=null;}
  // Host integration: no card entrance — the ribbon appears in its resting state (the page transition
  // still plays). The cascade stays available from the tuning panel's Replay button.
  }else introduction.finish();
  // Let atlas uploads and the first canvas paint finish before the host reveals us.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{hostPrepared=true;window.parent.postMessage({type:'projects:wave-ready'},location.origin)}));
  const projectSlug=new URL(routeLocation.href).searchParams.get('project');if(projectSlug)projectTransition.openRoute(projectSlug);
 }catch(error){showCatalogError(error);window.parent.postMessage({type:'projects:error'},location.origin)}
})();
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;document.querySelector('#error').hidden=false;document.querySelector('#error').textContent='The graphics connection was interrupted. Reload to restore the ribbon.'});

// Keep the tuning panel available without competing with the portfolio navigation.
const projectsNav=document.querySelector('#nav-projects');if(projectsNav)projectsNav.onclick=()=>{if(projectTransition.active||projectTransition.loading)projectTransition.page.querySelector('button').click();else if(!projectTransition.returning)setProjectView(false)};
window.addEventListener('keydown',e=>{if(showRibbonSettings&&e.key.toLowerCase()==='s'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();panel(document.querySelector('#settings').classList.contains('hidden'));}});

// Measure the selected label so the pill also fits loaded fonts and mobile sizes.
const projectSwitch=document.querySelector('.view-switch');
function syncProjectPill(){
 const selected=projectSwitch.querySelector('button[aria-pressed="true"]');
 if(!selected)return;
 projectSwitch.style.setProperty('--pill-x',selected.offsetLeft+'px');
 projectSwitch.style.setProperty('--pill-y',selected.offsetTop+'px');
 projectSwitch.style.setProperty('--pill-width',selected.offsetWidth+'px');
 projectSwitch.style.setProperty('--pill-height',selected.offsetHeight+'px');
}
const pillSelectionObserver=new MutationObserver(syncProjectPill);
pillSelectionObserver.observe(projectSwitch,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
const pillSizeObserver=new ResizeObserver(syncProjectPill);
projectSwitch.querySelectorAll('button').forEach(button=>pillSizeObserver.observe(button));
syncProjectPill();
document.fonts.ready.then(syncProjectPill);
