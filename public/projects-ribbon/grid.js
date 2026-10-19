'use strict';
// The grid holds metadata for the entire catalogue, but renders only viewport cells.
// Its bounded texture cache therefore stays the same size for 25 or 1,000 projects.
// Case studies require an explicit Is ready toggle. External listings keep their own links.
// Missing links/readiness fail closed, including the bundled placeholder catalogue.
function isProjectClickable(project){
 if(!project||typeof project.href!=='string'||!project.href.trim())return false;
 if(/^\/projects\/[^/]+\/?$/.test(project.href))return project.isReady===true;
 return /^https?:\/\//.test(project.href);
}
let tooltipInput=null,tooltipPoint=null,tooltipDismissed=false,tooltipKey=null;
function projectKind(project){return !isProjectClickable(project)?'Coming soon':project.href.startsWith('/')?'View':'View Offsite'}
function clearProjectTooltip(){
 const label=document.querySelector('#hover-title'),stage=document.querySelector('#stage');
 label.hidden=true;tooltipKey=null;stage.removeAttribute('aria-describedby');stage.removeAttribute('aria-disabled');
}
function projectLockIcon(){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 10 12');svg.setAttribute('width','9');svg.setAttribute('height','11');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','lock');
 const shackle=document.createElementNS(ns,'path');shackle.setAttribute('d','M2.75 5.25V3.5a2.25 2.25 0 0 1 4.5 0v1.75');shackle.setAttribute('fill','none');shackle.setAttribute('stroke','currentColor');shackle.setAttribute('stroke-width','1.3');
 const body=document.createElementNS(ns,'rect');body.setAttribute('x','1');body.setAttribute('y','5');body.setAttribute('width','8');body.setAttribute('height','6.25');body.setAttribute('rx','1.4');body.setAttribute('fill','currentColor');
 svg.append(shackle,body);return svg;
}
function showProjectTooltip(project,point){
 if(!project||!point||tooltipDismissed){clearProjectTooltip();return;}
 const label=document.querySelector('#hover-title'),stage=document.querySelector('#stage'),kind=projectKind(project),key=project.name+'\n'+kind;
 if(tooltipKey!==key){
  if(kind==='Coming soon')label.replaceChildren(projectLockIcon(),document.createTextNode(kind));else label.textContent=kind;
  label.classList.toggle('is-case-study',kind==='View');tooltipKey=key;
  stage.setAttribute('aria-label',`${project.name} — ${kind==='View'?'case study. Press Enter to open.':kind==='View Offsite'?'external project. Opens in a new tab.':'coming soon'}`);
 }
 label.hidden=false;stage.setAttribute('aria-describedby','hover-title');stage.setAttribute('aria-disabled',String(!isProjectClickable(project)));
 label.style.left=Math.max(12,Math.min(point.x+18,innerWidth-label.offsetWidth-20))+'px';label.style.top=Math.max(12,Math.min(point.y+20,innerHeight-70))+'px';
}
// Host integration: the All projects grid layout — a shuffled block (rebuilt each time the grid opens)
// wrapped across the infinite grid, so no project repeats within a screen-sized window.
// - The window is one screen's worth of tiles, measured from the viewport (partly visible tiles included),
//   shrunk only when the catalogue is too small to fill it. Inside any such window every tile is different.
// - Every row draws from a shuffled bag of all projects, so each appears before any repeats.
// - The ribbon line (row 0) keeps the featured order only for the run of tiles the ribbon was showing,
//   so the ribbon ↔ grid transition lines up; the rest of that row uses other projects.
// A greedy fill places most tiles; a short repair pass reshuffles any that still clash.
const GRID_LAYOUT_MIN_COLS=16,GRID_LAYOUT_MIN_ROWS=8,GRID_LAYOUT_REPAIR_STEPS=40000;
// NOTE • The window is what one screen shows (in layout axes: `along` the ribbon, `across` it).
// It shrinks until it holds at most GRID_WINDOW_FILL of the projects, so a clash-free fill always exists.
const GRID_WINDOW_FILL=.7;
function gridWindow(projectCount,along=5,across=4){
 let w=Math.max(1,along),h=Math.max(1,across);
 while(w*h>Math.max(1,Math.floor(projectCount*GRID_WINDOW_FILL))&&(w>1||h>1)){if(w>=h&&w>1)w--;else h--}
 return{w,h};
}
function buildGridLayout(featuredCount,projectCount,anchor=0,along,across){
 const mod=(a,n)=>(a%n+n)%n,f=Math.max(1,featuredCount),n=Math.max(1,projectCount);
 const{w,h}=gridWindow(n,along,across);
 // NOTE • Block sides are whole multiples of the window, so windows that wrap round the block fit too
 const roundUp=(value,step)=>Math.ceil(value/step)*step;
 const cols=roundUp(Math.max(n,GRID_LAYOUT_MIN_COLS,2*w),w),rows=roundUp(Math.max(GRID_LAYOUT_MIN_ROWS,2*h),h);
 const cells=Array.from({length:rows},()=>new Array(cols).fill(-1)),fixed=new Set();
 // The ribbon run: the featured slides centred on the ribbon's position, in ribbon order
 const run=Math.min(f,cols);
 for(let k=-Math.floor((run-1)/2);k<=Math.ceil((run-1)/2);k++){const c=mod(anchor+k,cols);cells[0][c]=mod(anchor+k,f);fixed.add(c)}
 const shuffled=()=>{const a=Array.from({length:n},(_,i)=>i);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 // NOTE • Two tiles clash when one screen-sized window could hold both: closer than w along AND h across
 const clashes=(t,c,v)=>{let hits=0;for(let dr=1-h;dr<h;dr++)for(let dc=1-w;dc<w;dc++){if(!dr&&!dc)continue;if(cells[mod(t+dr,rows)][mod(c+dc,cols)]===v)hits++}return hits};
 const pick=(t,c,candidates)=>{let best=[],bestHits=Infinity;for(const v of candidates){const hits=clashes(t,c,v);if(hits<bestHits){best=[v];bestHits=hits}else if(hits===bestHits)best.push(v)}return best[Math.floor(Math.random()*best.length)]};
 // Greedy fill: prefer this row's bag (balance), else any project that clashes least
 for(let t=0;t<rows;t++){
  let bag=shuffled();
  for(let c=0;c<cols;c++){
   if(t===0&&fixed.has(c))continue;
   if(!bag.length)bag=shuffled();
   const fit=bag.findIndex(v=>!clashes(t,c,v));
   cells[t][c]=fit>=0?bag.splice(fit,1)[0]:pick(t,c,shuffled());
  }
 }
 // Repair: move clashing tiles to their least-clashing project until none clash (or the budget runs out)
 const all=Array.from({length:n},(_,i)=>i);
 for(let step=0;step<GRID_LAYOUT_REPAIR_STEPS;step++){
  const t=Math.floor(Math.random()*rows),c=Math.floor(Math.random()*cols);
  if(t===0&&fixed.has(c))continue;
  if(!clashes(t,c,cells[t][c]))continue;
  cells[t][c]=pick(t,c,all);
 }
 return{cols,rows,cells,w,h};
}
// How long a grid video keeps playing after its tile was last drawn
const VIDEO_IDLE_MS=500;
class ProjectGrid {
 constructor(gl,requestFrame){
  this.gl=gl;this.requestFrame=requestFrame;this.projects=[];this.featured=[];this.vertical=false;
  this.mix=0;this.target=0;this.anchor=0;this.startPosition=0;this.origin={col:0,row:0};this.returning=false;this.aligning=false;
  this.pan={x:0,y:0};this.goal={x:0,y:0};this.speed=0;this.bend=0;
  this.settings={size:100,gap:32,curve:8,response:100,inertia:95,exitEarly:65};
  try{const saved=JSON.parse(localStorage.getItem('ribbon-grid-settings')||'{}');for(const key in this.settings)if(Number.isFinite(saved[key]))this.settings[key]=saved[key]}catch{}
  this.cache=new Map();this.visible=new Set();this.visibleFeatured=new Set();this.pointer=null;this.hover=null;this.drag=null;this.frame=0;
  this.compile();this.createControls();
 }
 createControls(){
  const specs=[['size','Project size',65,145,'%'],['gap','Spacing',8,64,'px'],['curve','Resting curvature',0,50,'%'],['response','Motion curvature',0,100,'%'],['inertia','Glide',0,95,'%'],['exitEarly','Earlier grid exit',0,100,'%']];
  for(const [key,label,min,max,unit]of specs){
   this.settings[key]=Math.max(min,Math.min(max,this.settings[key]));
   const row=document.createElement('div');row.className='control';
   row.innerHTML=`<div class="control-top"><label for="grid-${key}">${label}</label><output id="grid-${key}-value">${this.settings[key]}${unit}</output></div><input id="grid-${key}" type="range" min="${min}" max="${max}" value="${this.settings[key]}">`;
   document.querySelector('#grid-controls').append(row);
   row.querySelector('input').oninput=e=>{this.settings[key]=+e.target.value;row.querySelector('output').textContent=e.target.value+unit;try{localStorage.setItem('ribbon-grid-settings',JSON.stringify(this.settings))}catch{}this.requestFrame()};
  }
 }
 compile(){
  const gl=this.gl;
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();
  gl.attachShader(this.program,shader(gl.VERTEX_SHADER,`
   precision highp float;
   attribute vec2 aUV;
   uniform vec2 uViewport,uCentre,uSize;
   uniform float uMix,uRow,uCol,uBend,uRadius,uDistance,uScale,uRotation,uAmount,uSpread,uTwist,uVertical;
   varying vec2 vUV;
   void main(){
    vUV=vec2(aUV.x,1.0-aUV.y);
    vec2 ribbon=vec2(0.0);float w=1.0;
    if(uMix<1.0){
    float pitch=mix(1.0471975512,.6544984695,uVertical);
    float angle=(uCol+mix(aUV.x,aUV.y,uVertical)-.5)*pitch;
    float vertical=(mix(aUV.y,aUV.x,uVertical)-.5)*uRadius*pitch*mix(.625,1.6,uVertical);
    float twist=sign(angle)*uAmount*uTwist*smoothstep(.62,.62+uSpread,abs(angle)/pitch)*(1.0-smoothstep(2.5,3.14159265,abs(angle)));
    float radial=uRadius+vertical*sin(twist);
    vec3 p=vec3(radial*sin(angle),vertical*cos(twist),uRadius-uDistance-radial*cos(angle));
    if(uVertical>.5)p.xy=p.yx;
    float c=cos(uRotation),s=sin(uRotation);
    vec2 roll=(mat2(c,s,-s,c)*p.xy)*uScale;
    w=max(.12,-p.z);
    ribbon=clamp(vec2(roll.x/(.77*uViewport.x/uViewport.y),roll.y/.77)/w,vec2(-4.0),vec2(4.0));
    }
    // Extra rows grow out from the separating ribbon, then fill the viewport.
    vec2 pixel=uCentre+vec2((aUV.x-.5)*uSize.x,(.5-aUV.y)*uSize.y);
    vec2 grid=vec2(2.0*pixel.x/uViewport.x,-2.0*pixel.y/uViewport.y);
    float lens=1.0+uBend*(grid.x*grid.x+.4*grid.y*grid.y);
    grid*=lens;
    if(abs(uCol)>1.8)ribbon=vec2(sign(uCol)*(2.5+max(0.0,abs(uCol)-2.0)*.5)+(aUV.x-.5)*.4,(aUV.y-.5)*.5);
    if(abs(uCol)>1.8&&uVertical>.5)ribbon=ribbon.yx;
    if(abs(uRow)>.1)ribbon=uVertical>.5?vec2(sign(grid.x)*(1.5+abs(grid.x)*.25),grid.y):vec2(grid.x,sign(grid.y)*(1.5+abs(grid.y)*.25));
    vec2 result=mix(ribbon,grid,uMix);
    float depth=mix(w,1.0,uMix);
    gl_Position=vec4(result*depth,0.0,depth);
   }
  `));
  gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
   precision highp float;
   uniform sampler2D uTexture,uRibbonTexture;
   uniform vec2 uAtlas,uRibbonAtlas;
   uniform float uOpacity,uRibbonBlend,uClip;
   varying vec2 vUV;
   void main(){
    vec2 uv=vec2(uAtlas.x+clamp(vUV.x,.0006,.9994)*uAtlas.y,clamp(vUV.y,.0006,.9994));
    vec2 ribbonUV=vec2(uRibbonAtlas.x+clamp(vUV.x,.0006,.9994)*uRibbonAtlas.y,uv.y);
    float edge=max(abs(vUV.x-.5),abs(vUV.y-.5));
    float mask=uClip>=1.0?1.0:(uClip<=0.0?0.0:1.0-smoothstep(max(0.0,uClip*.5-.004),uClip*.5,edge));
    float outgoing=mask*(1.0-uRibbonBlend),incoming=uRibbonBlend;
    float alpha=outgoing+incoming;
    if(alpha*uOpacity<.001)discard;
    vec3 colour;
    if(incoming<=0.0)colour=texture2D(uTexture,uv).rgb;
    else if(outgoing<=0.0)colour=texture2D(uRibbonTexture,ribbonUV).rgb;
    else colour=(texture2D(uTexture,uv).rgb*outgoing+texture2D(uRibbonTexture,ribbonUV).rgb*incoming)/max(alpha,.0001);
    gl_FragColor=vec4(colour,alpha*uOpacity);
   }
  `));
  gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  this.uniforms={};for(const name of ['Viewport','Centre','Size','Mix','Row','Col','Bend','Radius','Distance','Scale','Rotation','Amount','Spread','Twist','Atlas','Opacity','Texture','RibbonTexture','RibbonAtlas','RibbonBlend','Clip','Vertical'])this.uniforms[name]=gl.getUniformLocation(this.program,'u'+name);
  const vertices=[],indices=[];const nx=24,ny=24;
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)vertices.push(x/nx,y/ny);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x,b=a+nx+1;indices.push(a,a+1,b,b,a+1,b+1)}
  this.vertexCount=indices.length;this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);this.attrib=gl.getAttribLocation(this.program,'aUV');
  this.indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
  this.fallback=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.fallback);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([24,24,24,255]));this.textureParams();
 }
 // Host integration: Video loop projects play in the All projects grid too. The poster shows until the loop
 // has a frame; each new frame is cover-cropped to the 16:10 tile and uploaded. A loop pauses itself once its
 // tile hasn't been drawn for VIDEO_IDLE_MS (scrolled away, or back on the ribbon) or the page is hidden.
 attachVideo(entry,src){
  const video=document.createElement('video');
  video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.crossOrigin='anonymous';
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.src=src;
  entry.video=video;entry.lastSeen=performance.now();
  const onFrame=()=>{
   if(entry.video!==video)return;
   if(document.hidden||performance.now()-entry.lastSeen>VIDEO_IDLE_MS){video.pause();return}
   entry.videoDirty=true;this.requestFrame();
   if(video.requestVideoFrameCallback)entry.frameCallback=video.requestVideoFrameCallback(onFrame);
  };
  entry.onFrame=onFrame;
  if(!video.requestVideoFrameCallback)video.addEventListener('timeupdate',onFrame);
 }
 updateVideoTexture(entry){
  const video=entry.video;entry.lastSeen=performance.now();
  if(!document.hidden&&video.paused&&!entry.playPending){
   entry.playPending=true;
   video.play().then(()=>{if(video.requestVideoFrameCallback&&entry.video===video)entry.frameCallback=video.requestVideoFrameCallback(entry.onFrame)}).catch(()=>{}).finally(()=>{entry.playPending=false});
  }
  if(!entry.videoDirty||video.readyState<2||!video.videoWidth)return;
  entry.videoDirty=false;entry.hasVideoFrame=true;
  const gl=this.gl,c=entry.videoCanvas||(entry.videoCanvas=Object.assign(document.createElement('canvas'),{width:512,height:320})),ctx=c.getContext('2d');
  const scale=Math.max(512/video.videoWidth,320/video.videoHeight),sw=512/scale,sh=320/scale;
  ctx.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,0,0,512,320);
  if(!entry.texture)entry.texture=gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,entry.texture);this.textureParams();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
 }
 releaseVideo(entry){
  const video=entry.video;if(!video)return;entry.video=null;
  if(entry.frameCallback&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(entry.frameCallback);
  video.pause();video.removeAttribute('src');video.load();
 }
 textureParams(){const gl=this.gl;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR)}
 setProjects(featured,projects){this.featured=featured;this.projects=projects.length?projects:featured;this.layout=this.buildLayout();this.requestFrame()}
 setView(all,position,vertical=false){
  let selected=null;
  if(all&&this.target===0&&this.mix<.01){this.vertical=vertical;this.anchor=Math.round(position);this.layout=this.buildLayout();this.startPosition=position;this.origin={col:0,row:0};this.returning=false;this.pan={x:0,y:0};this.goal={x:0,y:0};this.speed=0}
  if(!all&&this.target===1){
   const nearest=this.nearestFeatured();
   if(nearest){
    const d=this.dimensions();
    // Rebase cell coordinates without changing any tile's screen position or image.
    this.pan.x+=(nearest.col+this.rowShift(nearest.row))*d.pitchX;this.pan.y+=nearest.row*d.pitchY;
    this.origin.col+=nearest.col;this.origin.row+=nearest.row;
    this.startPosition=nearest.index;selected=nearest.index;
    this.returning=true;this.aligning=true;this.goal={x:0,y:0};this.drag=null;
    this.returnMotion={elapsed:0,duration:2.2,pan:{...this.pan},mix:this.mix,bend:this.bend};
   }
  }
  if(all&&this.target===0)this.entryMotion={elapsed:0,duration:.85,mix:this.mix};
  if(!all)this.entryMotion=null;
  this.target=all?1:0;if(all){this.aligning=false;this.returnMotion=null;}
  this.clearHover();this.requestFrame();return selected;
 }
 nearestFeatured(){
  if(!this.featured.length||!this.projects.length)return null;
  const d=this.dimensions(),featuredCount=Math.min(this.featured.length,this.projects.length);
  const centreCol=-this.pan.x/d.pitchX,centreRow=-this.pan.y/d.pitchY;
  // NOTE • Reads the real layout via indexFor (featured slides are projects 0…featuredCount−1).
  // The layout repeats every cols×rows cells, so a box that size round the centre holds every featured slide.
  const layout=this.layout,spanCol=layout?Math.ceil(layout.cols/2)+1:this.projects.length,spanRow=layout?Math.ceil(layout.rows/2)+1:this.projects.length;
  let best=null;
  for(let row=Math.floor(centreRow)-spanRow;row<=Math.ceil(centreRow)+spanRow;row++){
   for(let col=Math.floor(centreCol-this.rowShift(row))-spanCol;col<=Math.ceil(centreCol-this.rowShift(row))+spanCol;col++){
    const index=this.indexFor(col,row);if(index<0||index>=featuredCount)continue;
    const x=(col+this.rowShift(row))*d.pitchX+this.pan.x,y=row*d.pitchY+this.pan.y;
    const nx=2*x/innerWidth,ny=2*y/innerHeight,lens=1+this.bend*(nx*nx+.4*ny*ny);
    const distance=(x*x+y*y)*lens*lens;
    if(!best||distance<best.distance)best={col,row,index,distance};
   }
  }
  return best;
 }
 dimensions(){const width=Math.min(340,Math.max(190,innerWidth*.205))*this.settings.size/100;return {width,height:width/1.6,pitchX:width+this.settings.gap,pitchY:width/1.6+this.settings.gap}}
 // How many tiles one screen shows (partly visible included), in layout axes
 screenWindow(){const d=this.dimensions(),cols=Math.ceil(innerWidth/d.pitchX)+1,rows=Math.ceil(innerHeight/d.pitchY)+1;return this.vertical?{along:rows,across:cols}:{along:cols,across:rows}}
 buildLayout(){const{along,across}=this.screenWindow();return buildGridLayout(this.featured.length,this.projects.length,this.anchor,along,across)}
 // Keep the anchored row centred while preserving brickwork after rebasing.
 rowShift(row){const origin=this.origin?.row||0,parity=n=>((n%2)+2)%2;return .5*(parity(row+origin)-parity(origin))}
 indexFor(col,row){
  const mod=(a,n)=>(a%n+n)%n;col+=(this.origin?.col||0);row+=(this.origin?.row||0);
  // u runs along the ribbon line, v across it — the layout keeps the ribbon's run in featured order on v=0
  const u=this.vertical?this.anchor-row:this.anchor+col,v=this.vertical?col:row;
  const layout=this.layout;if(!layout)return v===0?mod(u,this.featured.length):mod(u+v*7,this.projects.length);
  return layout.cells[mod(v,layout.rows)][mod(u,layout.cols)];
 }
 isActive(){return this.target===1}
 ribbonHandoff(){const t=Math.max(0,Math.min(1,this.mix/.18));return 1-t*t*(3-2*t)}
 wheel(e){const unit=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;this.goal.y-=Math.max(-600,Math.min(600,e.deltaY*unit));this.goal.x-=Math.max(-600,Math.min(600,e.deltaX*unit));this.requestFrame()}
 pointerDown(e){this.pointer={x:e.clientX,y:e.clientY};this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};this.goal={...this.pan};this.clearHover()}
 pointerMove(e){this.pointer={x:e.clientX,y:e.clientY};if(this.drag){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.goal.x+=dx;this.goal.y+=dy;this.drag.x=e.clientX;this.drag.y=e.clientY;this.drag.moved ||= Math.hypot(e.clientX-this.drag.startX,e.clientY-this.drag.startY)>5;}this.requestFrame()}
 pointerUp(){const clicked=!!this.drag&&!this.drag.moved;this.drag=null;this.requestFrame();return clicked}
 clearHover(){this.hover=null;clearProjectTooltip();}
 inversePoint(x,y){const sx=(x-innerWidth/2)*2/innerWidth,sy=-(y-innerHeight/2)*2/innerHeight;let factor=1;for(let i=0;i<12;i++){const q=(sx*sx+.4*sy*sy)/(factor*factor);factor=(factor+1+this.bend*q)*.5}return{x:sx/factor*innerWidth/2,y:-sy/factor*innerHeight/2}}
 hitTest(x,y){if(this.mapPointer){const point=this.mapPointer(x,y);x=point.x;y=point.y;}if(this.mix<.96||!this.target||!this.projects.length)return null;const p=this.inversePoint(x,y),d=this.dimensions(),row=Math.round((p.y-this.pan.y)/d.pitchY),col=Math.round((p.x-this.pan.x)/d.pitchX-this.rowShift(row));if(Math.abs(p.x-this.pan.x-(col+this.rowShift(row))*d.pitchX)>d.width/2||Math.abs(p.y-this.pan.y-row*d.pitchY)>d.height/2)return null;const index=this.indexFor(col,row);return {index,project:this.projects[index],col,row}}
 refreshHover(){
  if(!this.target){this.clearHover();return;}
  const point=tooltipInput==='keyboard'?{x:innerWidth/2,y:innerHeight/2}:this.pointer;
  const hit=point&&!this.drag?this.hitTest(point.x,point.y):null;this.hover=hit;
  const canvas=document.querySelector('#stage');
  canvas.style.cursor=this.drag?'grabbing':isProjectClickable(hit?.project)?'pointer':'grab';
  showProjectTooltip(hit?.project,point);
  if(!hit)canvas.setAttribute('aria-label','All projects. Drag in any direction or scroll vertically to explore the infinite grid.');
 }
 requestTexture(index){
  // Host integration: Video loop tiles key by their video so the poster and the loop share one entry.
  const project=this.projects[index],key=project.type==='video'&&project.video?project.video:project.poster;
  let entry=this.cache.get(key);if(entry){entry.last=this.frame;if(entry.video)this.updateVideoTexture(entry);return entry.texture||this.fallback}
  entry={last:this.frame,texture:null};this.cache.set(key,entry);
  if(key===project.video)this.attachVideo(entry,project.video);
  const image=new Image();image.crossOrigin='anonymous';image.onload=()=>{if(this.cache.get(key)!==entry||entry.hasVideoFrame)return;const gl=this.gl,c=document.createElement('canvas');c.width=512;c.height=320;const ctx=c.getContext('2d'),scale=Math.max(512/image.width,320/image.height),sw=512/scale,sh=320/scale;ctx.drawImage(image,(image.width-sw)/2,(image.height-sh)/2,sw,sh,0,0,512,320);entry.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,entry.texture);this.textureParams();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);this.requestFrame()};image.onerror=()=>{const fallback=window.ribbonPlaceholder;if(fallback&&image.src!==fallback)image.src=fallback;else entry.failed=true};image.src=project.poster;
  return this.fallback;
 }
 update(dt){
  if(this.entryMotion&&this.target){
   const motion=this.entryMotion;motion.elapsed+=dt;
   // Only time the surrounding tiles' clip reveal here. The ribbon keeps
   // its original interpolation, pan and curvature updates below.
   if(reducedMotion()||motion.elapsed>=motion.duration)this.entryMotion=null;
  }
  if(this.returnMotion&&!this.target){
   const motion=this.returnMotion;motion.elapsed+=dt;
   const t=reducedMotion()?1:Math.min(1,motion.elapsed/motion.duration);
   const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10)};
   // Centring and expansion overlap, with zero acceleration at both ends.
   const centre=ease(t/.78),expand=ease((t-.08)/.92);
   this.pan={x:motion.pan.x*(1-centre),y:motion.pan.y*(1-centre)};
   this.mix=motion.mix*(1-expand);this.speed=0;
   this.bend=motion.bend+(this.settings.curve/100*.35-motion.bend)*ease(t);
   if(t===1){this.pan={x:0,y:0};this.mix=0;this.aligning=false;this.returnMotion=null;}
   return t<1;
  }
  const ease=reducedMotion()?1:1-Math.exp(-dt*6.2);const mixTarget=this.aligning?1:this.target;this.mix+=(mixTarget-this.mix)*ease;if(Math.abs(this.mix-mixTarget)<.0005)this.mix=mixTarget;
  const rate=30-this.settings.inertia*.24;
  const moveEase=reducedMotion()?1:1-Math.exp(-dt*(this.aligning?12:rate)),oldX=this.pan.x,oldY=this.pan.y;
  this.pan.x+=(this.goal.x-this.pan.x)*moveEase;this.pan.y+=(this.goal.y-this.pan.y)*moveEase;
  if(Math.abs(this.goal.x-this.pan.x)<.05)this.pan.x=this.goal.x;if(Math.abs(this.goal.y-this.pan.y)<.05)this.pan.y=this.goal.y;
  if(this.aligning&&Math.hypot(this.pan.x,this.pan.y)<.5){this.pan={x:0,y:0};this.aligning=false;}
  const speed=Math.hypot(this.pan.x-oldX,this.pan.y-oldY)/Math.max(dt,.001);
  this.speed+=(Math.min(speed/1700,1.8)-this.speed)*(1-Math.exp(-dt*9));if(this.speed<.0003)this.speed=0;
  this.bend=this.settings.curve/100*.35+(reducedMotion()?0:this.settings.response/100*this.speed*.28);
  return !!this.entryMotion||this.aligning||this.mix!==this.target||this.pan.x!==this.goal.x||this.pan.y!==this.goal.y||this.speed>0;
 }
 render(featuredTexture,featuredCount,view){
  if(this.mix===0||!this.projects.length)return;
  const gl=this.gl,u=this.uniforms,d=this.dimensions();this.frame++;this.visible.clear();this.visibleFeatured.clear();
  gl.useProgram(this.program);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(this.attrib);gl.vertexAttribPointer(this.attrib,2,gl.FLOAT,false,0,0);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(u.Texture,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,featuredTexture);gl.uniform1i(u.RibbonTexture,1);gl.activeTexture(gl.TEXTURE0);
  const smooth=this.mix*this.mix*(3-2*this.mix);
  let outgoingClip=1;
  if(this.entryMotion&&this.target){
   // Open from the centre immediately, alongside the ribbon's movement.
   const t=Math.max(0,Math.min(1,this.entryMotion.elapsed/this.entryMotion.duration));
   outgoingClip=t*t*(3-2*t);
  }
  if(this.returnMotion&&!this.target){
   const finish=.95-.8*(this.settings.exitEarly??65)/100;
   const t=Math.min(1,this.returnMotion.elapsed/(this.returnMotion.duration*finish));
   outgoingClip=1-t*t*(3-2*t);
  }
  gl.uniform2f(u.Viewport,innerWidth,innerHeight);gl.uniform2f(u.Size,d.width,d.height);gl.uniform1f(u.Mix,smooth);gl.uniform1f(u.Bend,this.bend);
  gl.uniform1f(u.Vertical,view.vertical||0);gl.uniform1f(u.Radius,14+(3.6-14)*view.curve/100);gl.uniform1f(u.Distance,2.5+4.5*view.distance/100);gl.uniform1f(u.Scale,view.scale/100);gl.uniform1f(u.Rotation,view.rotation*Math.PI/180);gl.uniform1f(u.Amount,view.amount*Math.PI/180);gl.uniform1f(u.Spread,view.spread/100);gl.uniform1f(u.Twist,view.twist);
  const left=Math.floor((-innerWidth*.65-this.pan.x)/d.pitchX)-1,right=Math.ceil((innerWidth*.65-this.pan.x)/d.pitchX)+1;
  const top=Math.floor((-innerHeight*.65-this.pan.y)/d.pitchY)-1,bottom=Math.ceil((innerHeight*.65-this.pan.y)/d.pitchY)+1;
  const rows=[];for(let row=top;row<=bottom;row++)if(row!==0)rows.push(row);if(top<=0&&bottom>=0)rows.push(0);
  for(const row of rows)for(let col=left;col<=right;col++){
   if(this.entryMotion){const preload=this.indexFor(col,row);if(preload>=featuredCount)this.requestTexture(preload);}
   const spine=this.vertical?col===0:row===0,axial=this.vertical?-row:col,cross=this.vertical?col:row;
   const opacity=spine?1:Math.max(0,Math.min(1,(smooth-.12)/.58));
   if(opacity===0||(!spine&&outgoingClip===0))continue;
   const index=this.indexFor(col,row);this.visible.add(index);
   gl.uniform2f(u.Centre,(col+this.rowShift(row))*d.pitchX+this.pan.x,row*d.pitchY+this.pan.y);gl.uniform1f(u.Row,cross);gl.uniform1f(u.Col,this.returning?axial:axial+this.anchor-this.startPosition);
   const ribbonIndex=((this.startPosition+axial)%featuredCount+featuredCount)%featuredCount;
   gl.uniform2f(u.RibbonAtlas,ribbonIndex/featuredCount,1/featuredCount);gl.uniform1f(u.RibbonBlend,this.returning&&spine?1-smooth:0);
   if(this.returning&&spine)this.visibleFeatured.add(ribbonIndex);
   gl.uniform1f(u.Clip,(this.target&&spine)||(row===0&&col===0)?1:outgoingClip);
   gl.uniform1f(u.Opacity,opacity*(1-this.ribbonHandoff()));
   if(index<featuredCount){this.visibleFeatured.add(index);gl.bindTexture(gl.TEXTURE_2D,featuredTexture);gl.uniform2f(u.Atlas,index/featuredCount,1/featuredCount)}else{gl.bindTexture(gl.TEXTURE_2D,this.requestTexture(index));gl.uniform2f(u.Atlas,0,1)}
   gl.drawElements(gl.TRIANGLES,this.vertexCount,gl.UNSIGNED_SHORT,0);
  }
  if(this.cache.size>96){for(const [key,entry] of [...this.cache].sort((a,b)=>a[1].last-b[1].last)){if(this.cache.size<=96)break;if(entry.last===this.frame)continue;this.releaseVideo(entry);if(entry.texture)gl.deleteTexture(entry.texture);this.cache.delete(key)}}
  gl.disable(gl.BLEND);this.refreshHover();
 }
}
function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches}
