// Full-screen passes, compatible with the existing WebGL 1 portrait renderer.
// ------------
export const liquidVertex = `attribute vec2 position;varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
export const header = `precision highp float;varying vec2 uv;
uniform vec2 px;uniform sampler2D source;`;
export const advect = `uniform sampler2D flow;uniform float dt,decay;
void main(){gl_FragColor=texture2D(source,uv-dt*texture2D(flow,uv).xy*px)*decay;}`;
export const splat = `uniform vec2 point,previous,aspect;uniform vec3 amount;uniform float radius;
void main(){vec2 p=uv*aspect,a=previous*aspect,b=point*aspect,d=b-a;
float t=clamp(dot(p-a,d)/(dot(d,d)+.000001),0.,1.);
float r=length(p-a-t*d);gl_FragColor=texture2D(source,uv)+vec4(amount*exp(-r*r/radius),0.);}`;
export const divergence = `void main(){
float l=texture2D(source,uv-vec2(px.x,0.)).x,r=texture2D(source,uv+vec2(px.x,0.)).x;
float b=texture2D(source,uv-vec2(0.,px.y)).y,t=texture2D(source,uv+vec2(0.,px.y)).y;
gl_FragColor=vec4(.5*(r-l+t-b),0.,0.,1.);}`;
export const curl = `void main(){
float l=texture2D(source,uv-vec2(px.x,0.)).y,r=texture2D(source,uv+vec2(px.x,0.)).y;
float b=texture2D(source,uv-vec2(0.,px.y)).x,t=texture2D(source,uv+vec2(0.,px.y)).x;
gl_FragColor=vec4(.5*(r-l-t+b),0.,0.,1.);}`;
export const vorticity = `uniform sampler2D rotation;uniform float dt,swirl;
void main(){float l=texture2D(rotation,uv-vec2(px.x,0.)).x,r=texture2D(rotation,uv+vec2(px.x,0.)).x;
float b=texture2D(rotation,uv-vec2(0.,px.y)).x,t=texture2D(rotation,uv+vec2(0.,px.y)).x;
vec2 f=.5*vec2(abs(t)-abs(b),abs(r)-abs(l));f/=length(f)+.0001;
f*=swirl*texture2D(rotation,uv).x;f.y*=-1.;
gl_FragColor=vec4(clamp(texture2D(source,uv).xy+f*dt,vec2(-700.),vec2(700.)),0.,1.);}`;
export const pressure = `uniform sampler2D divergence;
void main(){float l=texture2D(source,uv-vec2(px.x,0.)).x,r=texture2D(source,uv+vec2(px.x,0.)).x;
float b=texture2D(source,uv-vec2(0.,px.y)).x,t=texture2D(source,uv+vec2(0.,px.y)).x;
gl_FragColor=vec4((l+r+b+t-texture2D(divergence,uv).x)*.25,0.,0.,1.);}`;
export const gradient = `uniform sampler2D pressure;
void main(){float l=texture2D(pressure,uv-vec2(px.x,0.)).x,r=texture2D(pressure,uv+vec2(px.x,0.)).x;
float b=texture2D(pressure,uv-vec2(0.,px.y)).x,t=texture2D(pressure,uv+vec2(0.,px.y)).x;
gl_FragColor=vec4(texture2D(source,uv).xy-vec2(r-l,t-b)*.5,0.,1.);}`;
// In front mode the portrait joins the scene before refraction.
export const composite = `uniform sampler2D logos,decoration,content;uniform vec3 background;
uniform vec2 screen,strip;uniform float bottom,phase,inFront;
uniform float logoBlur,mobile;
void main(){vec2 p=uv*screen;float y=(p.y-bottom)/strip.y;
vec2 logoUV=vec2(p.x/strip.x+phase,clamp(y,0.,1.));
vec4 logo=texture2D(logos,vec2(fract(logoUV.x),logoUV.y));
// Average premultiplied samples so transparent logos blur without dark halos.
if(logoBlur>.00001){logo=vec4(0.);
for(int i=0;i<9;i++){vec4 tap=texture2D(logos,vec2(fract(logoUV.x+(float(i)-4.)*.25*logoBlur),logoUV.y));logo+=vec4(tap.rgb*tap.a,tap.a)/9.;}
logo.rgb/=max(logo.a,.0001);}
logo*=step(0.,y)*step(y,1.);vec3 col=mix(background,logo.rgb,logo.a);
vec4 detail=texture2D(decoration,uv);col=mix(col,detail.rgb,detail.a);
if(mobile>.5)col=background;
if(inFront>.5){vec4 person=texture2D(source,uv);col=person.rgb+col*(1.-person.a);
// Mobile overlays belong above the portrait and its readability scrim.
if(mobile>.5){col*=1.-.96*smoothstep(0.,1.,(.65-uv.y)/.65);col=mix(col,logo.rgb,logo.a);col=mix(col,detail.rgb,detail.a);}
vec4 text=texture2D(content,uv);col=mix(col,text.rgb,text.a);}
gl_FragColor=vec4(col,1.);}`;
// Behind mode composites the premultiplied portrait after water shading,
// retaining its translucent scroll trails and soft edges.
export const display = `uniform sampler2D scene,portrait,content;uniform float strength,refraction,dispersion,iridescence,inFront;
uniform float waterReveal,revealAspect,fluidActive;
uniform vec3 revealDark;
uniform float rippleStrength,rippleWidth;
float field(vec2 p){return texture2D(source,p).r*.4+(texture2D(source,p+vec2(px.x,0.)).r+texture2D(source,p-vec2(px.x,0.)).r+texture2D(source,p+vec2(0.,px.y)).r+texture2D(source,p-vec2(0.,px.y)).r)*.15;}
void main(){float l=0.,r=0.,b=0.,t=0.;
// The intro wave is analytical; only pointer-driven fluid needs height sampling.
if(fluidActive>.5){l=field(uv-vec2(px.x,0.));r=field(uv+vec2(px.x,0.));
b=field(uv-vec2(0.,px.y));t=field(uv+vec2(0.,px.y));}
// A single rounded water meniscus reveals the scene in this same optical pass.
vec2 radial=(uv-vec2(.5,.52))*vec2(revealAspect,1.);
float distanceFromCentre=length(radial);
float envelope=smoothstep(0.,.06,waterReveal)*(1.-smoothstep(.88,1.,waterReveal));
float radius=mix(-.22*rippleWidth,length(vec2(revealAspect*.5,.52))+.28*rippleWidth,waterReveal);
float edge=(distanceFromCentre-radius)/(.13*rippleWidth);
float meniscus=exp(-edge*edge)*envelope*rippleStrength;
float lens=edge*meniscus*3.2;
vec2 lensNormal=radial/max(distanceFromCentre,.001)*lens;
vec2 revealBend=lensNormal/vec2(revealAspect,1.)*.095;
vec2 slope=vec2(r-l,t-b)*3.4+lensNormal*.35,bend=(slope-lensNormal*.35)*refraction+revealBend;vec3 n=normalize(vec3(-slope,1.));
vec3 col=texture2D(scene,uv+bend).rgb;
col.r=texture2D(scene,uv+bend*(1.+dispersion)).r;col.b=texture2D(scene,uv+bend*(1.-dispersion)).b;
float ridge=clamp(length(slope)*2.6,0.,1.),light=dot(n,normalize(vec3(-.45,.65,.7)));
float shine=pow(max(0.,dot(n,normalize(vec3(-.35,.5,1.)))),28.);
float opposite=pow(max(0.,dot(n,normalize(vec3(.5,-.35,1.)))),22.);
vec3 pearl=mix(vec3(.52,.69,.96),vec3(1.,.76,.52),smoothstep(-.18,.2,slope.x+slope.y*.65));
col+=ridge*strength*((pearl-.78)*iridescence+vec3((light-.76)*.10));
col=mix(col,vec3(1.),clamp(shine*ridge*.78*strength,0.,.95));
col+=vec3(.035,.065,.08)*opposite*ridge*strength;col-=vec3(.015,.012,.008)*ridge*strength;
col=clamp(col,0.,1.);
if(inFront<.5){vec4 person=texture2D(portrait,uv+revealBend);col=person.rgb+col*(1.-person.a);vec4 text=texture2D(content,uv+bend);col=mix(col,text.rgb,text.a);}
// Refract the dark/light boundary too: it belongs to the glass, not a CSS cutout.
float revealed=1.-smoothstep(-.045,.025,distanceFromCentre-radius+ lens*.028);
if(waterReveal>=1.) revealed=1.;
col=mix(revealDark,col,revealed);
vec3 waveNormal=normalize(vec3(-lensNormal*1.8,1.));
float fresnel=pow(1.-waveNormal.z,3.);
float reflection=pow(max(0.,dot(waveNormal,normalize(vec3(-.45,.65,1.)))),32.);
float caustic=exp(-pow((edge+.65)*5.,2.))*envelope*rippleStrength;
col*=1.-meniscus*.24;
col+=meniscus*(vec3(.72,.84,.9)*fresnel*.5+vec3(1.)*reflection*.65);
col+=vec3(.8,.91,1.)*caustic*.22;
gl_FragColor=vec4(col,1.);}`;
