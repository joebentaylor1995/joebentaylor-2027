'use strict';
const projectEase=t=>t*t*(3-2*t);
const PROJECT_CURVE_SAMPLES=32;
// The eases the settings panel offers, without loading GSAP into the ribbon. 'custom' is a plain ease-out whose exponent is the softness slider.
function projectEasing(name,softness){
 if(name==='none')return t=>t;
 const [,family,level,direction]=/^(power([1-4])|sine|expo|circ)\.(in|out|inOut)$/.exec(name)||[];
 if(!family)return t=>1-Math.pow(1-t,softness);
 const accelerate=level?t=>Math.pow(t,+level+1):family==='sine'?t=>1-Math.cos(t*Math.PI/2):family==='expo'?t=>t?Math.pow(2,10*(t-1)):0:t=>1-Math.sqrt(1-t*t);
 if(direction==='in')return accelerate;
 if(direction==='out')return t=>1-accelerate(1-t);
 return t=>t<.5?accelerate(2*t)/2:1-accelerate(2-2*t)/2;
}
// Tuned from the site's global settings panel. Keep in step with fillDefaults in src/components/ProjectsRibbon/fillSettings.ts.
// stagger: how far behind the clicked point the farthest corner sets off, as a fraction of the expansion. wave: height, as a fraction of the viewport's shorter side.
const PROJECT_FILL_DEFAULTS={duration:850,returnDuration:1000,stagger:.34,easing:'custom',softness:1.3,wave:.045,waves:1.7,travel:1.1,lift:.05,shading:.55};
function projectFillSettings(){
 const settings={...PROJECT_FILL_DEFAULTS};
 try{const saved=JSON.parse(localStorage.getItem('jbt-project-fill-v1')||'{}');for(const key in settings)if(Number.isFinite(saved?.[key]))settings[key]=saved[key];if(typeof saved?.easing==='string')settings.easing=saved.easing}catch{}
 settings.stagger=Math.min(.9,Math.max(0,settings.stagger));settings.duration=Math.max(1,settings.duration);settings.returnDuration=Math.max(1,settings.returnDuration);settings.softness=Math.max(1,settings.softness);
 // The vertex shader looks each vertex's ease up in this curve, so it and the page's crop always share one easing
 settings.ease=projectEasing(settings.easing,settings.softness);settings.curve=Float32Array.from({length:PROJECT_CURVE_SAMPLES+1},(_,index)=>settings.ease(index/PROJECT_CURVE_SAMPLES));
 return settings;
}
const projectCover=(imageAspect,boxAspect)=>[Math.min(1,boxAspect/imageAspect),Math.min(1,imageAspect/boxAspect)];
// Snapshot the selected surface in homogeneous coordinates, preserving perspective.
function projectSurface(u,v,source,view,width,height){
 if(source.grid){
  const {centre,size,bend}=source.grid;
  let x=2*(centre.x+(u-.5)*size.width)/width,y=-2*(centre.y+(v-.5)*size.height)/height;
  const lens=1+bend*(x*x+.4*y*y);return [x*lens,y*lens,1];
 }
 const pitch=view.vertical?Math.PI/4.8:Math.PI/3,radius=14-10.4*view.curve/100,distance=2.5+4.5*view.distance/100;
 const angle=(source.slide+(view.vertical?1-v:u)-source.offset-.5)*pitch;
 const acrossHeight=view.vertical?2*u-1:1-2*v;
 const smooth=(a,b,t)=>projectEase(Math.max(0,Math.min(1,(t-a)/(b-a))));
 const twist=Math.sign(angle)*view.amount*Math.PI/180*view.twist*smooth(.62,.62+view.spread/100,Math.abs(angle)/pitch)*(1-smooth(2.5,Math.PI,Math.abs(angle)));
 const half=radius*pitch*(view.vertical?.8:.3125),across=acrossHeight*half,radial=radius+across*Math.sin(twist);
 let x=radial*Math.sin(angle),y=across*Math.cos(twist);
 if(view.vertical)[x,y]=[y,x];
 if(view.vertical)x+=source.band*half*2.08;else y+=source.band*half*2.08;
 const a=view.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),scale=view.scale/100;
 return [(c*x-s*y)*scale/(.77*width/height),(s*x+c*y)*scale/.77,distance-radius+radial*Math.cos(angle)];
}
class ProjectTransition {
 constructor(gl){this.gl=gl;this.pending=null;this.active=false;this.loading=false;this.progress=0;this.backURL=null;this.serial=0;this.resources=[];this.savedInert=[];this.heroChoices=new Map();
  this.page=document.createElement('section');this.page.id='project-page';this.page.hidden=true;
  this.page.innerHTML='<div class="project-hero"><img alt=""><button id="project-back">← Back to projects</button><h1 tabindex="-1"></h1></div>';
  document.body.append(this.page);
  this.returning=false;this.fadeSerial=0;
  this.fade=document.createElement('div');this.fade.id='project-return-fade';this.fade.hidden=true;this.fade.setAttribute('aria-hidden','true');document.body.append(this.fade);
  this.page.querySelector('button').onclick=()=>{if(this.returning)return;if(routeHistory.state?.ribbonProject)routeHistory.back();else{const url=new URL(routeLocation.href);url.searchParams.delete('project');routeHistory.replaceState(null,'',url);this.returnToGallery()}};
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&(this.active||this.loading)){e.preventDefault();this.page.querySelector('button').click()}});
  window.addEventListener('message',e=>{if(!fromHost(e))return;if(e.data?.type==='projects:fill-preview')this.preview();else if(e.data?.type==='projects:fill-scrub')this.scrub(e.data.flight)});
 }
 slug(project){return project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+project.index;}
 // Keep the random prototype hero stable through Back, Forward and reload.
 hero(project){
  if(project.hero)return project.hero;
  if(routeHistory.state?.projectSlug===this.slug(project)&&routeHistory.state.hero)return routeHistory.state.hero;
  if(!this.heroChoices.has(project.poster)){
   const choices=allProjects.filter(item=>item.poster!==project.poster);
   this.heroChoices.set(project.poster,choices.length?choices[Math.floor(Math.random()*choices.length)].poster:project.poster);
  }
  return this.heroChoices.get(project.poster);
 }
 // Host integration: one request per case study, shared by the idle prefetch and a tap, so a tap rarely waits on the network
 heroData(slug){
  this.heroCache=this.heroCache||new Map();
  if(!this.heroCache.has(slug))this.heroCache.set(slug,fetch('/api/projects-ribbon/?project='+encodeURIComponent(slug)).then(response=>{if(!response.ok)throw Error('Unable to load project hero');return response.json()}).catch(error=>{this.heroCache.delete(slug);throw error}));
  return this.heroCache.get(slug);
 }
 // Host integration: once the ribbon is ready, fetch each featured case study's hero details in idle slots and hand them to the host, which warms the exact hero image variant its page uses — so a tap starts the transition without waiting on the network
 prefetch(projects){
  const idle=window.requestIdleCallback?callback=>window.requestIdleCallback(callback,{timeout:1500}):callback=>setTimeout(callback,120);
  idle(()=>this.warm());
  if(window.parent===window)return;
  const queue=projects.filter(project=>project.featured!==false&&isProjectClickable(project)&&/^\/projects\/[^/]+\/?$/.test(project.href));
  const next=()=>{const project=queue.shift();if(!project)return;const slug=new URL(project.href,location.origin).pathname.split('/')[2];this.heroData(slug).then(data=>window.parent.postMessage({type:'projects:prefetch',href:project.href,...data},location.origin)).catch(()=>{}).finally(()=>idle(next))};
  idle(next);
 }
 // The settings panel's preview: play the fill on whichever project is centred, then fly back instead of navigating. A project that isn't ready borrows a ready one's hero, so every card can be tuned.
 preview(){
  if(!ready||this.active||this.loading||this.returning)return;
  const inGrid=gridView?.isActive(),hit=inGrid?gridView.hitTest(innerWidth/2,innerHeight/2):null,centred=inGrid?hit?.project:pickFeatured(innerWidth/2,innerHeight/2);
  if(!centred)return;
  const hasHero=item=>isProjectClickable(item)&&item.href.startsWith('/projects/');
  const heroFrom=hasHero(centred)?centred:featured.find(hasHero)||allProjects.find(hasHero);
  this.previewing=true;this.open(heroFrom?{...centred,href:heroFrom.href}:centred,inGrid?{...hit,grid:true}:centred.ribbonHit,null);
 }
 // The settings panel's timeline: hold the fill at one point of its flight, redrawn as settings change. null flies it back.
 scrub(flight){
  if(flight===null){if(this.scrubbing==null)return;this.scrubbing=null;if(this.previewing)this.returnToGallery();return;}
  this.scrubbing=flight;
  if(this.active&&!this.returning){this.fill=projectFillSettings();requestRender();}else if(!this.loading&&!this.active)this.preview();
 }
 async open(project,hit,point){
  if(this.active||this.loading||this.returning||gridView?.mix>0&&gridView.mix<1)return;
  this.embedded=window.parent!==window;this.loading=true;const serial=++this.serial;
  canvas.setAttribute('aria-busy','true');canvas.style.cursor='progress';
  clearTimeout(snapTimer);target=position;scrollVelocity=0;idleMotion.reset();
  if(gridView){gridView.goal={...gridView.pan};gridView.drag=null;}
  try{
   if(this.embedded){
    this.href=project.href||'/projects/pocketchange';
    const path=new URL(this.href,location.origin);
    if(path.origin!==location.origin||!/^\/projects\/[^/]+\/?$/.test(path.pathname))throw Error('Invalid case study path');
    const slug=path.pathname.split('/')[2];
    const data=await this.heroData(slug);if(serial!==this.serial)return;
    const prepared=await new Promise((resolve,reject)=>{
     const listener=event=>{if(!fromHost(event)||event.data?.type!=='projects:prepared'||event.data.request!==serial)return;cleanup();event.data.error?reject(Error('Unable to prepare project hero')):resolve(event.data)};
     const timeout=setTimeout(()=>{cleanup();reject(Error('Project preparation timed out'))},15000);
     const cleanup=()=>{clearTimeout(timeout);window.removeEventListener('message',listener)};
     window.addEventListener('message',listener);
     window.parent.postMessage({type:'projects:prepare',href:this.href,request:serial,...data},location.origin);
    });
    if(serial!==this.serial)return;
    project={...project,hero:prepared.hero};this.heroHeight=prepared.heroHeight;this.heroTop=prepared.heroTop;
   }
   const image=await imageLoad(this.hero(project),!this.embedded);if(serial!==this.serial)return;
   this.pending={project,hit,point,image,destination:this.upload(image)};requestRender();
  }catch(error){if(serial===this.serial){this.loading=false;this.previewing=false;this.scrubbing=null;canvas.removeAttribute('aria-busy');canvas.style.cursor='grab';showCatalogError(error)}}
 }
 // Upload the hero while the ribbon is at rest after the tap: on phones the upload alone outlasts a frame, and inside begin() it would stutter the expansion's first frame
 upload(image){
  const gl=this.gl,unit=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0);const bound=gl.getParameter(gl.TEXTURE_BINDING_2D);
  const t=this.texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
  gl.bindTexture(gl.TEXTURE_2D,bound);gl.activeTexture(unit);return t;
 }
 lock(){this.savedInert=[...document.body.children].filter(el=>el!==canvas&&el!==this.page&&el!==this.fade&&!['SCRIPT','HEADER'].includes(el.tagName)).map(el=>[el,el.inert]);for(const [el]of this.savedInert)el.inert=true;for(const item of videoSlides)item.video.pause();document.title=this.project.name+' — Joe Ben Taylor';document.body.classList.add('project-open');}
 begin(view){
  const {project,hit,point,image,destination}=this.pending;this.pending=null;this.fill=projectFillSettings();this.project=project;this.image=image;this.active=true;this.loading=false;this.start=null;this.progress=0;
  this.backURL=routeLocation.pathname+routeLocation.search+routeLocation.hash;
  const url=new URL(routeLocation.href);url.searchParams.set('project',this.slug(project));if(!this.embedded)routeHistory.pushState({ribbonProject:true,projectSlug:this.slug(project),hero:image.src},'',url);
  this.page.querySelector('img').src=image.src;this.page.querySelector('img').alt=project.name;
  this.page.querySelector('h1').textContent=project.name;this.page.hidden=Boolean(this.embedded);this.page.scrollTop=0;this.page.style.setProperty('--project-content','0');this.lock();panel(false);
  canvas.removeAttribute('aria-busy');
  const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  this.background=this.texture();gl.copyTexImage2D(gl.TEXTURE_2D,0,gl.RGB,0,0,canvas.width,canvas.height,0);
  this.destination=destination;
  let source;
  if(hit?.grid){const d=gridView.dimensions();source={grid:{centre:{x:(hit.col+gridView.rowShift(hit.row))*d.pitchX+gridView.pan.x,y:hit.row*d.pitchY+gridView.pan.y},size:d,bend:gridView.bend}};}
  else{
   const band=hit?.band||0,shift=Math.max(1,Math.floor(count*(band===1?1:2)/3));
   const offset=band?mod(-position+count-1-shift+.5,count):mod(position,count);
   const slide=hit?.slide??Math.floor(offset+.5);source={band,offset,slide};
  }
  const index=featured.findIndex(item=>item.poster===project.poster);
  this.sourceTexture=index>=0?texture:gridView.requestTexture(hit?.index??project.index);
  this.sourceAtlas=index>=0?[index%atlasColumns/atlasColumns,Math.floor(index/atlasColumns)/atlasRows,1/atlasColumns,1/atlasRows]:[0,0,1,1];
  this.captureSize=[innerWidth,innerHeight];this.makeMesh(source,view,point);this.compile();this.draw(performance.now());
 }
 texture(){const gl=this.gl,t=gl.createTexture();this.resources.push(['texture',t]);gl.bindTexture(gl.TEXTURE_2D,t);for(const [key,val]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,val);return t;}
 makeMesh(source,view,point){
  const gl=this.gl,vertices=[],indices=[],nx=mobile?48:96,ny=mobile?64:54;
  const top=projectSurface(.5,0,source,view,innerWidth,innerHeight),bottom=projectSurface(.5,1,source,view,innerWidth,innerHeight);
  this.sourceHeight=Math.max(1,Math.hypot((top[0]/top[2]-bottom[0]/bottom[2])*innerWidth/2,(top[1]/top[2]-bottom[1]/bottom[2])*innerHeight/2));
  // The motion spreads from the clicked spot on the image; a keyboard press has none, so it starts from the middle
  let origin=[.5,.5],nearest=Infinity;
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
   const u=x/nx,v=y/ny,start=projectSurface(u,v,source,view,innerWidth,innerHeight);vertices.push(...start,u,v);
   if(point&&start[2]>.04){const distance=Math.hypot((start[0]/start[2]+1)/2*innerWidth-point.x,(1-start[1]/start[2])/2*innerHeight-point.y);if(distance<nearest){nearest=distance;origin=[u,v]}}
  }
  const aspect=innerWidth/innerHeight;
  this.origin=origin;this.aspect=[aspect,1];this.reach=Math.hypot(Math.max(origin[0],1-origin[0])*aspect,Math.max(origin[1],1-origin[1]));
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x,b=a+nx+1;indices.push(a,a+1,b,b,a+1,b+1)}
  this.vertices=gl.createBuffer();this.resources.push(['buffer',this.vertices]);gl.bindBuffer(gl.ARRAY_BUFFER,this.vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  this.indices=gl.createBuffer();this.resources.push(['buffer',this.indices]);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);this.vertexCount=indices.length;
 }
 // Link the expansion program in idle time: the first compile in a fresh WebKit process can stall the main thread for most of a second, which would swallow the whole animation on the first tap
 warm(){if(this.warmProgram)return;try{this.warmProgram=this.link()}catch{}}
 compile(){
  const gl=this.gl;this.program=this.warmProgram||this.link();this.warmProgram=null;this.resources.push(['program',this.program]);
  this.uniforms={};for(const key of ['Progress','Background','Source','Hero','Atlas','Crop','SourceCrop','Opacity','HeroViewport','HeroOffset','Origin','Aspect','Reach','Stagger','Motion','Wave','Curve','Waves','Travel','Lift','Shading'])this.uniforms[key]=gl.getUniformLocation(this.program,'u'+key);
 }
 link(){
  const gl=this.gl,program=gl.createProgram();
  const shaders=[
   // Each vertex runs the same flight, delayed by its distance from the clicked point. The billow (env) is zero at both ends of a vertex's flight, so the sheet still leaves the ribbon and lands on the viewport exactly. The lead overtakes the edges still waiting on the ribbon, so depth keeps it on top: they tuck underneath instead of showing through.
   [gl.VERTEX_SHADER,`attribute vec3 aStart;attribute vec2 aUV;uniform float uProgress,uBackground,uReach,uStagger,uMotion,uWaves,uTravel,uLift,uCurve[33];uniform vec2 uOrigin,uAspect,uWave;varying vec2 vUV;varying float vBlend,vShade;const vec2 LIGHT=vec2(-.53,.85);void main(){vUV=aUV;vec3 end=vec3(aUV.x*2.-1.,1.-aUV.y*2.,1.);if(uBackground>.5){vBlend=0.;vShade=0.;gl_Position=vec4(end.xy,0.,1.);return;}vec2 rel=(aUV-uOrigin)*uAspect;float r=length(rel),d=r/uReach,local=clamp((uProgress-d*uStagger)/(1.-uStagger),0.,1.),sample=min(floor(local*32.),31.),eased=mix(uCurve[int(sample)],uCurve[int(sample)+1],local*32.-sample),env=sin(3.14159265*local)*uMotion,phase=6.2831853*(uWaves*d-uTravel*uProgress);vec2 dir=vec2(rel.x,-rel.y)/max(r,.0001)*smoothstep(0.,.18,d);float depth=mix(max(.04,aStart.z),1.,eased);vec2 screen=mix(aStart.xy/max(.04,aStart.z),end.xy,eased)*(1.+uLift*env)+dir*sin(phase)*env*uWave;vBlend=smoothstep(.25,.95,eased);vShade=-cos(phase)*env*dot(dir,LIGHT);gl_Position=vec4(screen*depth,d*.9*depth,depth);}`],
   [gl.FRAGMENT_SHADER,`precision highp float;uniform sampler2D uSource,uHero;uniform vec4 uAtlas;uniform vec2 uCrop,uSourceCrop;uniform float uBackground,uOpacity,uHeroViewport,uHeroOffset,uShading;varying vec2 vUV;varying float vBlend,vShade;void main(){vec2 uv=clamp(vUV,vec2(.001),vec2(.999));if(uBackground>.5){gl_FragColor=vec4(texture2D(uSource,vec2(vUV.x,1.-vUV.y)).rgb,uOpacity);return;}vec3 before=texture2D(uSource,uAtlas.xy+clamp((vUV-.5)*uSourceCrop+.5,vec2(.001),vec2(.999))*uAtlas.zw).rgb;vec3 after=texture2D(uHero,(vec2(vUV.x,vUV.y*uHeroViewport+uHeroOffset)-.5)*uCrop+.5).rgb;gl_FragColor=vec4(mix(before,after,vBlend)*(1.+vShade*uShading),uOpacity);}`]
  ];
  for(const [type,src]of shaders){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);gl.deleteShader(s)}
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw Error(log)}
  return program;
 }
 draw(time){
  if(!this.program||this.settled&&!this.returning)return;if(this.start===null)this.start=time;
  const fill=this.fill,duration=reduced?200:this.returning?fill.returnDuration:fill.duration;const holding=this.scrubbing!=null&&!this.returning;this.progress=holding?this.scrubbing:Math.min(1,(time-this.start)/duration);
  const flight=this.returning?this.returnFrom*(1-projectEase(this.progress)):this.progress,t=fill.ease(flight),gl=this.gl,u=this.uniforms;
  this.meshProgress=flight;
  this.page.style.setProperty('--project-content',String(projectEase(Math.max(0,Math.min(1,(t-.65)/.35)))));
  const dpr=Math.min(devicePixelRatio||1,mobile?1.5:2),width=Math.round(innerWidth*dpr),height=Math.round(innerHeight*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}gl.viewport(0,0,canvas.width,canvas.height);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.vertices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);
  const a=gl.getAttribLocation(this.program,'aStart'),b=gl.getAttribLocation(this.program,'aUV');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(b);gl.vertexAttribPointer(b,2,gl.FLOAT,false,20,12);
  gl.uniform1i(u.Source,0);gl.uniform1i(u.Hero,1);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.destination);gl.activeTexture(gl.TEXTURE0);
  gl.uniform1f(u.Background,1);gl.uniform1f(u.Opacity,1);gl.bindTexture(gl.TEXTURE_2D,this.background);gl.drawElements(gl.TRIANGLES,this.vertexCount,gl.UNSIGNED_SHORT,0);
  gl.enable(gl.DEPTH_TEST);gl.uniform1f(u.Background,0);gl.uniform1f(u.Opacity,1);gl.uniform1f(u.Progress,flight);
  const wave=fill.wave*Math.min(innerWidth,innerHeight);gl.uniform2fv(u.Origin,this.origin);gl.uniform2fv(u.Aspect,this.aspect);gl.uniform1f(u.Reach,this.reach);gl.uniform1f(u.Stagger,reduced?0:fill.stagger);gl.uniform1fv(u.Curve,fill.curve);gl.uniform1f(u.Waves,fill.waves);gl.uniform1f(u.Travel,fill.travel);gl.uniform1f(u.Lift,fill.lift);gl.uniform1f(u.Shading,fill.shading);gl.uniform1f(u.Motion,reduced?0:1);gl.uniform2f(u.Wave,2*wave/innerWidth,2*wave/innerHeight);
  gl.uniform4fv(u.Atlas,this.sourceAtlas);const cropProgress=t,boxHeight=this.sourceHeight+(innerHeight-this.sourceHeight)*cropProgress,boxWidth=this.sourceHeight*1.6+(innerWidth-this.sourceHeight*1.6)*cropProgress,aspect=boxWidth/boxHeight;gl.uniform2fv(u.SourceCrop,projectCover(1.6,aspect));const heroHeight=boxHeight+((this.heroHeight||innerHeight)-innerHeight)*t;gl.uniform2fv(u.Crop,projectCover(this.image.width/this.image.height,boxWidth/heroHeight));gl.uniform1f(u.HeroViewport,boxHeight/heroHeight);gl.uniform1f(u.HeroOffset,-(this.heroTop||0)*t/heroHeight);
  gl.bindTexture(gl.TEXTURE_2D,this.sourceTexture);gl.drawElements(gl.TRIANGLES,this.vertexCount,gl.UNSIGNED_SHORT,0);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
  if(holding)return;if(this.progress<1)requestRender();else if(this.returning){this.close();this.cancelReturn();}else{this.settled=true;if(this.previewing){const serial=this.serial;this.handoffTimer=setTimeout(()=>{if(serial===this.serial&&this.active&&!this.returning)this.returnToGallery()},400);return;}if(this.embedded){const serial=this.serial;this.handoffTimer=setTimeout(()=>{if(serial!==this.serial||!this.active||this.returning)return;window.parent.postMessage({type:'projects:open',href:this.href,hero:this.image.src,heroHeight:this.heroHeight,heroTop:this.heroTop,completed:true},location.origin)},100);return;}document.body.classList.add('project-arrived');this.page.querySelector('button').focus({preventScroll:true});}
 }
 dispose(){const gl=this.gl;if(this.program){for(const name of ['aStart','aUV']){const slot=gl.getAttribLocation(this.program,name);if(slot>=0)gl.disableVertexAttribArray(slot)}}for(const [type,item]of this.resources){if(type==='texture')gl.deleteTexture(item);else if(type==='buffer')gl.deleteBuffer(item);else gl.deleteProgram(item)}this.resources=[];this.program=null;}
 close(){clearTimeout(this.handoffTimer);++this.serial;this.previewing=false;this.scrubbing=null;this.pending=null;this.loading=false;this.active=false;this.settled=false;this.dispose();this.page.hidden=true;document.body.classList.remove('project-open','project-arrived');document.title='Projects — Joe Ben Taylor';for(const [el,inert]of this.savedInert)el.inert=inert;this.savedInert=[];canvas.removeAttribute('aria-busy');canvas.style.cursor='grab';idleMotion.reset();lastTime=performance.now();canvas.focus({preventScroll:true});resumeVideos();requestRender();}
 cancelReturn(){++this.fadeSerial;this.fadeAnimation?.cancel();this.fadeAnimation=null;this.fade.hidden=true;this.returning=false;}
 async returnToGallery(){
  if(this.returning)return;
  if(!this.active){if(this.loading)this.close();return;}
  if(this.program&&!reduced&&this.captureSize?.[0]===innerWidth&&this.captureSize?.[1]===innerHeight){
   this.returning=true;this.returnFrom=this.meshProgress??1;this.start=null;this.page.scrollTop=0;
   document.body.classList.remove('project-arrived');requestRender();return;
  }
  this.returning=true;const serial=++this.fadeSerial;this.fade.hidden=false;
  try{
   this.fadeAnimation=this.fade.animate([{opacity:0},{opacity:1}],{duration:reduced?100:260,easing:'ease-in-out',fill:'forwards'});
   await this.fadeAnimation.finished;if(serial!==this.fadeSerial)return;
   // Restore the saved gallery only while completely covered, then let it paint.
   this.close();
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   if(serial!==this.fadeSerial)return;
   this.fadeAnimation.cancel();
   this.fadeAnimation=this.fade.animate([{opacity:1},{opacity:0}],{duration:reduced?100:380,easing:'ease-out',fill:'forwards'});
   await this.fadeAnimation.finished;
  }catch(error){if(error.name!=='AbortError')console.error(error);}
  finally{if(serial===this.fadeSerial)this.cancelReturn();}
 }
 openRoute(slug){const project=allProjects.find(item=>this.slug(item)===slug);if(!project){const url=new URL(routeLocation.href);url.searchParams.delete('project');routeHistory.replaceState(null,'',url);this.returnToGallery();return;}this.cancelReturn();if(this.active||this.loading)this.close();introduction.finish();this.project=project;this.active=true;this.page.querySelector('img').src=this.hero(project);this.page.querySelector('img').alt=project.name;this.page.querySelector('h1').textContent=project.name;this.page.style.setProperty('--project-content','1');this.page.hidden=Boolean(this.embedded);this.page.scrollTop=0;this.lock();document.body.classList.add('project-arrived');this.page.querySelector('button').focus({preventScroll:true});}
}
