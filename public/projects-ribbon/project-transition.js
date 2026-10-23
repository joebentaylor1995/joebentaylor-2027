'use strict';
const projectEase=t=>t*t*(3-2*t);
const projectExpansion=t=>1-Math.pow(1-t,4);
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
 async open(project,hit){
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
   this.pending={project,hit,image,destination:this.upload(image)};requestRender();
  }catch(error){if(serial===this.serial){this.loading=false;canvas.removeAttribute('aria-busy');canvas.style.cursor='grab';showCatalogError(error)}}
 }
 // Upload the hero while the ribbon is at rest after the tap: on phones the upload alone outlasts a frame, and inside begin() it would stutter the expansion's first frame
 upload(image){
  const gl=this.gl,unit=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0);const bound=gl.getParameter(gl.TEXTURE_BINDING_2D);
  const t=this.texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
  gl.bindTexture(gl.TEXTURE_2D,bound);gl.activeTexture(unit);return t;
 }
 lock(){this.savedInert=[...document.body.children].filter(el=>el!==canvas&&el!==this.page&&el!==this.fade&&!['SCRIPT','HEADER'].includes(el.tagName)).map(el=>[el,el.inert]);for(const [el]of this.savedInert)el.inert=true;for(const item of videoSlides)item.video.pause();document.title=this.project.name+' — Joe Ben Taylor';document.body.classList.add('project-open');}
 begin(view){
  const {project,hit,image,destination}=this.pending;this.pending=null;this.project=project;this.image=image;this.active=true;this.loading=false;this.start=null;this.progress=0;
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
  this.captureSize=[innerWidth,innerHeight];this.makeMesh(source,view);this.compile();this.draw(performance.now());
 }
 texture(){const gl=this.gl,t=gl.createTexture();this.resources.push(['texture',t]);gl.bindTexture(gl.TEXTURE_2D,t);for(const [key,val]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,val);return t;}
 makeMesh(source,view){
  const gl=this.gl,vertices=[],indices=[],nx=64,ny=24;
  const top=projectSurface(.5,0,source,view,innerWidth,innerHeight),bottom=projectSurface(.5,1,source,view,innerWidth,innerHeight);
  this.sourceHeight=Math.max(1,Math.hypot((top[0]/top[2]-bottom[0]/bottom[2])*innerWidth/2,(top[1]/top[2]-bottom[1]/bottom[2])*innerHeight/2));
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const u=x/nx,v=y/ny;vertices.push(...projectSurface(u,v,source,view,innerWidth,innerHeight),u,v)}
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x,b=a+nx+1;indices.push(a,a+1,b,b,a+1,b+1)}
  this.vertices=gl.createBuffer();this.resources.push(['buffer',this.vertices]);gl.bindBuffer(gl.ARRAY_BUFFER,this.vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  this.indices=gl.createBuffer();this.resources.push(['buffer',this.indices]);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);this.vertexCount=indices.length;
 }
 // Link the expansion program in idle time: the first compile in a fresh WebKit process can stall the main thread for most of a second, which would swallow the whole animation on the first tap
 warm(){if(this.warmProgram)return;try{this.warmProgram=this.link()}catch{}}
 compile(){
  const gl=this.gl;this.program=this.warmProgram||this.link();this.warmProgram=null;this.resources.push(['program',this.program]);
  this.uniforms={};for(const key of ['Progress','Background','Source','Hero','Atlas','Crop','SourceCrop','Blend','Opacity','HeroViewport','HeroOffset'])this.uniforms[key]=gl.getUniformLocation(this.program,'u'+key);
 }
 link(){
  const gl=this.gl,program=gl.createProgram();
  const shaders=[
   [gl.VERTEX_SHADER,`attribute vec3 aStart;attribute vec2 aUV;uniform float uProgress,uBackground;varying vec2 vUV;void main(){vUV=aUV;vec3 end=vec3(aUV.x*2.-1.,1.-aUV.y*2.,1.);float depth=mix(max(.04,aStart.z),1.,uProgress);vec2 screen=mix(aStart.xy/max(.04,aStart.z),end.xy,uProgress);vec3 p=vec3(screen*depth,depth);if(uBackground>.5)p=end;gl_Position=vec4(p.xy,0.,p.z);}`],
   [gl.FRAGMENT_SHADER,`precision highp float;uniform sampler2D uSource,uHero;uniform vec4 uAtlas;uniform vec2 uCrop,uSourceCrop;uniform float uBlend,uBackground,uOpacity,uHeroViewport,uHeroOffset;varying vec2 vUV;void main(){vec2 uv=clamp(vUV,vec2(.001),vec2(.999));if(uBackground>.5){gl_FragColor=vec4(texture2D(uSource,vec2(vUV.x,1.-vUV.y)).rgb,uOpacity);return;}vec3 before=texture2D(uSource,uAtlas.xy+clamp((vUV-.5)*uSourceCrop+.5,vec2(.001),vec2(.999))*uAtlas.zw).rgb;vec3 after=texture2D(uHero,(vec2(vUV.x,vUV.y*uHeroViewport+uHeroOffset)-.5)*uCrop+.5).rgb;gl_FragColor=vec4(mix(before,after,uBlend),uOpacity);}`]
  ];
  for(const [type,src]of shaders){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);gl.deleteShader(s)}
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw Error(log)}
  return program;
 }
 draw(time){
  if(!this.program||this.settled&&!this.returning)return;if(this.start===null)this.start=time;
  const duration=reduced?200:this.returning?700:850;this.progress=Math.min(1,(time-this.start)/duration);
  const t=this.returning?this.returnFrom*(1-projectEase(this.progress)):projectExpansion(this.progress),gl=this.gl,u=this.uniforms;
  this.meshProgress=t;
  this.page.style.setProperty('--project-content',String(projectEase(Math.max(0,Math.min(1,(t-.65)/.35)))));
  const dpr=Math.min(devicePixelRatio||1,mobile?1.5:2),width=Math.round(innerWidth*dpr),height=Math.round(innerHeight*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}gl.viewport(0,0,canvas.width,canvas.height);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.vertices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);
  const a=gl.getAttribLocation(this.program,'aStart'),b=gl.getAttribLocation(this.program,'aUV');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(b);gl.vertexAttribPointer(b,2,gl.FLOAT,false,20,12);
  gl.uniform1i(u.Source,0);gl.uniform1i(u.Hero,1);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.destination);gl.activeTexture(gl.TEXTURE0);
  gl.uniform1f(u.Background,1);gl.uniform1f(u.Opacity,1);gl.bindTexture(gl.TEXTURE_2D,this.background);gl.drawElements(gl.TRIANGLES,this.vertexCount,gl.UNSIGNED_SHORT,0);
  gl.uniform1f(u.Background,0);gl.uniform1f(u.Opacity,1);gl.uniform1f(u.Progress,t);gl.uniform1f(u.Blend,projectEase(Math.max(0,Math.min(1,(t-.25)/.7))));
  gl.uniform4fv(u.Atlas,this.sourceAtlas);const cropProgress=t,boxHeight=this.sourceHeight+(innerHeight-this.sourceHeight)*cropProgress,boxWidth=this.sourceHeight*1.6+(innerWidth-this.sourceHeight*1.6)*cropProgress,aspect=boxWidth/boxHeight;gl.uniform2fv(u.SourceCrop,projectCover(1.6,aspect));const heroHeight=boxHeight+((this.heroHeight||innerHeight)-innerHeight)*t;gl.uniform2fv(u.Crop,projectCover(this.image.width/this.image.height,boxWidth/heroHeight));gl.uniform1f(u.HeroViewport,boxHeight/heroHeight);gl.uniform1f(u.HeroOffset,-(this.heroTop||0)*t/heroHeight);
  gl.bindTexture(gl.TEXTURE_2D,this.sourceTexture);gl.drawElements(gl.TRIANGLES,this.vertexCount,gl.UNSIGNED_SHORT,0);gl.disable(gl.BLEND);
  if(this.progress<1)requestRender();else if(this.returning){this.close();this.cancelReturn();}else{this.settled=true;if(this.embedded){const serial=this.serial;this.handoffTimer=setTimeout(()=>{if(serial!==this.serial||!this.active||this.returning)return;window.parent.postMessage({type:'projects:open',href:this.href,hero:this.image.src,heroHeight:this.heroHeight,heroTop:this.heroTop,completed:true},location.origin)},100);return;}document.body.classList.add('project-arrived');this.page.querySelector('button').focus({preventScroll:true});}
 }
 dispose(){const gl=this.gl;if(this.program){for(const name of ['aStart','aUV']){const slot=gl.getAttribLocation(this.program,name);if(slot>=0)gl.disableVertexAttribArray(slot)}}for(const [type,item]of this.resources){if(type==='texture')gl.deleteTexture(item);else if(type==='buffer')gl.deleteBuffer(item);else gl.deleteProgram(item)}this.resources=[];this.program=null;}
 close(){clearTimeout(this.handoffTimer);++this.serial;this.pending=null;this.loading=false;this.active=false;this.settled=false;this.dispose();this.page.hidden=true;document.body.classList.remove('project-open','project-arrived');document.title='Projects — Joe Ben Taylor';for(const [el,inert]of this.savedInert)el.inert=inert;this.savedInert=[];canvas.removeAttribute('aria-busy');canvas.style.cursor='grab';idleMotion.reset();lastTime=performance.now();canvas.focus({preventScroll:true});resumeVideos();requestRender();}
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
