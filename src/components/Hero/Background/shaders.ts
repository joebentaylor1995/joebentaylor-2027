export const vertex = `attribute vec2 position;varying vec2 v;void main(){v=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;

const pulseShader = `uniform vec2 pulseCentre;uniform float pulseAge,pulseStrength,pulseSize;
float pulseAt(vec2 q){
 float distanceToClick=length((q-pulseCentre)*vec2(resolution.x/resolution.y,1.));
 float ring=exp(-pow((distanceToClick/max(pulseSize,.25)-pulseAge*.70)/.13,2.));
 float envelope=smoothstep(0.,.10,pulseAge)*(1.-smoothstep(.55,1.8,pulseAge));
 return ring*envelope*pulseStrength;
}`;

export const fragment = `precision highp float;
varying vec2 v;uniform sampler2D photo;uniform sampler2D depthMask;uniform vec2 resolution;uniform vec2 motion;uniform float intensity;uniform float lift;uniform float debug;uniform vec2 positionShift;uniform float rotation;uniform float zoom;
${pulseShader}
uniform vec2 cursorPos;uniform float cursorOn;uniform float cursorSpeed;
uniform float chromaFX;uniform float glowFX;
uniform float scrollFX[6];uniform float scrollVelocity;
vec4 portrait(vec2 uv){float ok=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);return texture2D(photo,clamp(uv,vec2(.001),vec2(.999)))*ok;}
vec4 premultSample(vec2 uv){vec4 t=portrait(uv);return vec4(t.rgb*t.a,t.a);}
float tipLight(vec2 uv,vec2 cursorUV,vec2 tip){return exp(-dot((uv-tip)*vec2(1.4455,1.),(uv-tip)*vec2(1.4455,1.))*2100.)*(1.-smoothstep(.025,.10,length((cursorUV-tip)*vec2(1.4455,1.))));}

float box(vec2 p,vec2 lo,vec2 hi){vec2 d=max(lo-p,p-hi);return max(d.x,d.y);}
// Locally flatten the nose toward the surrounding face depth.
float adjustedDepth(vec2 uv){
 float z=texture2D(depthMask,uv).r;
 vec2 nose=(uv-vec2(.460,.322))/vec2(.026,.052);
 float weight=(1.-smoothstep(.35,1.,length(nose)))*.85;
 float face=(texture2D(depthMask,vec2(.426,uv.y)).r+texture2D(depthMask,vec2(.493,uv.y)).r)*.5;
 return z-max(z-face,0.)*weight;
}
float depthAt(vec2 uv){float z=adjustedDepth(uv);return (z*.42+smoothstep(.55,.94,z)*lift*.27)*texture2D(photo,uv).a;}
void main(){
vec2 q=vec2(v.x,1.-v.y);float aspect=resolution.x/resolution.y;vec2 size=vec2(1.,aspect/1.4455);if(size.y<1.)size=vec2(1.4455/aspect,1.);size*=zoom;
// Rotate in aspect-correct screen coordinates around the positioned centre.
vec2 centred=(q-.5-positionShift)*vec2(aspect,1.);
float c=cos(rotation),s=sin(rotation);
vec2 rotated=vec2(c*centred.x+s*centred.y,-s*centred.x+c*centred.y);
vec2 p=rotated/vec2(aspect,1.)/size+.5;
vec2 debugP=p;
float scrollSigned=scrollVelocity;float scrollSpeed=abs(scrollSigned);
vec2 cp=(cursorPos-.5-positionShift)*vec2(aspect,1.);
vec2 cursorUV=vec2(c*cp.x+s*cp.y,-s*cp.x+c*cp.y)/vec2(aspect,1.)/size+.5;
// A small projective tilt establishes a stable screen plane behind the hands.
vec2 rel=p-.5;float perspective=1.+dot(rel,motion)*intensity*.027;
vec2 plane=rel*perspective+.5+motion*intensity*.004;
vec2 offset=clamp(motion*intensity*.023,vec2(-.035),vec2(.035));
offset.y+=scrollSigned*scrollFX[1]*.018;
float scrollDepthScale=clamp(scrollSigned*scrollFX[1]*.18,-.65,.65);
vec2 uv=plane;
// Front-to-back ray intersection preserves sharp occlusion boundaries.
float nearZ=1.02;float farZ=0.;bool hit=false;
for(int i=0;i<48;i++){
 float z=1.02-float(i)*(1.02/47.);
 vec2 sampleUV=(plane-offset*z-.5)/(1.+scrollDepthScale*z)+.5;
 if(!hit && depthAt(sampleUV)>=z){farZ=z;nearZ=z+1.02/47.;hit=true;}
}
for(int i=0;i<5;i++){float z=(nearZ+farZ)*.5;vec2 trial=(plane-offset*z-.5)/(1.+scrollDepthScale*z)+.5;if(depthAt(trial)>=z)farZ=z;else nearZ=z;}
uv=(plane-offset*farZ-.5)/(1.+scrollDepthScale*farZ)+.5;
float rawDepth=adjustedDepth(uv);
vec4 texel=portrait(uv);
// Downward scrolling focuses the hands. Premultiplied blur preserves transparent edges.
float focalDepth=.91;
float blur=scrollFX[3]*scrollSpeed*smoothstep(.08,.36,abs(rawDepth-focalDepth))*.012;
if(blur>.00001){
 vec2 radius=vec2(blur/1.4455,blur);vec4 sum=premultSample(uv)*.2;
 sum+=premultSample(uv+radius*vec2(1.,0.))*.1;sum+=premultSample(uv-radius*vec2(1.,0.))*.1;
 sum+=premultSample(uv+radius*vec2(0.,1.))*.1;sum+=premultSample(uv-radius*vec2(0.,1.))*.1;
 sum+=premultSample(uv+radius*vec2(.707,.707))*.1;sum+=premultSample(uv-radius*vec2(.707,.707))*.1;
 sum+=premultSample(uv+radius*vec2(.707,-.707))*.1;sum+=premultSample(uv-radius*vec2(.707,-.707))*.1;
 texel=vec4(sum.rgb/max(sum.a,.0001),sum.a);
}
vec3 col=texel.rgb;
// Edge-to-edge webpage image. No inset frame, rim, or cutout box.
float aa=1.4/(resolution.y*size.y);
float valid=1.-smoothstep(-aa,aa,box(uv,vec2(.001),vec2(.999)));
vec3 bg=vec3(.97);
float alpha=texel.a*valid;vec3 result=col;
// Only foreground edges briefly split into colour when the pointer accelerates.
vec2 channelShift=vec2(.004,0.)*chromaFX*cursorSpeed*smoothstep(.60,.90,rawDepth);
channelShift.y+=scrollSigned*scrollFX[0]*.014;

vec4 blueSample=texture2D(photo,clamp(uv-channelShift,vec2(.001),vec2(.999)));
// Add only the displaced blue highlight. Never subtract blue: that creates a yellow fringe.
if(dot(channelShift,channelShift)>.000000001){result.b=max(col.b,mix(col.b,blueSample.b,blueSample.a));}


float contact=tipLight(uv,cursorUV,vec2(.574,.065))+tipLight(uv,cursorUV,vec2(.651,.035))+tipLight(uv,cursorUV,vec2(.764,.114))+tipLight(uv,cursorUV,vec2(.531,.156))+tipLight(uv,cursorUV,vec2(.581,.514))+tipLight(uv,cursorUV,vec2(.225,.836))+tipLight(uv,cursorUV,vec2(.300,.850))+tipLight(uv,cursorUV,vec2(.369,.811))+tipLight(uv,cursorUV,vec2(.461,.705));
float glow=contact*glowFX*cursorOn;
result+=vec3(.25,.60,1.)*glow*.7;
vec3 premul=result*alpha;
// Foreground ghosts can cross the torso, but stay behind the current hands.
if(scrollFX[2]*scrollSpeed>.0001){
 for(int i=3;i>=1;i--){float n=float(i);vec2 ghostUV=uv+vec2(0.,scrollSigned*.025*n);
 vec4 ghost=portrait(ghostUV);float ghostDepth=adjustedDepth(ghostUV);
 float ghostAlpha=ghost.a*smoothstep(.62,.84,ghostDepth)*(1.-smoothstep(.60,.85,rawDepth)*alpha)*scrollSpeed*scrollFX[2]*(.24/n);
 ghostAlpha=clamp(ghostAlpha,0.,.55);premul=premul*(1.-ghostAlpha)+ghost.rgb*vec3(.75,.9,1.)*ghostAlpha;alpha=ghostAlpha+alpha*(1.-ghostAlpha);
 }
}
float halo=clamp(glow*.20,0.,.65)*(1.-alpha);
premul+=vec3(.20,.55,1.)*halo;alpha+=halo;
result=alpha>.0001?premul/alpha:vec3(0.);
// The triangular lattice is attached to the reprojected depth surface.
float wireAmount=smoothstep(0.,.42,scrollSpeed*scrollFX[4]);
if(wireAmount>.0001){
 vec2 mesh=(uv+vec2(.035,-.10)*rawDepth)*vec2(100.,69.);vec2 cell=fract(mesh);
 float lineDistance=min(min(min(cell.x,1.-cell.x),min(cell.y,1.-cell.y)),abs(cell.x-cell.y)*.7071);
 float lineWidth=clamp(70./(resolution.y*size.y),.022,.13);
 float line=1.-smoothstep(lineWidth*.30,lineWidth,lineDistance);
 float surface=texel.a*valid;
 float shading=dot(texel.rgb,vec3(.299,.587,.114));
 vec3 blue=mix(vec3(.008,.07,.28),vec3(.05,.53,1.),clamp(rawDepth*.35+shading*.75,0.,1.));
 float meshAlpha=surface*line;
 vec3 blended=mix(result*alpha,blue*meshAlpha,wireAmount);
 alpha=mix(alpha,meshAlpha,wireAmount);result=blended/max(alpha,.0001);
}
// Crossfade the continuous photograph into the actual point-cloud pass.
float particleFade=max(smoothstep(.003,.09,scrollSpeed*scrollFX[5]),smoothstep(.003,.09,pulseAt(q)));
alpha*=1.-particleFade;

if(debug>.5){float z=adjustedDepth(debugP);float mapBounds=1.-smoothstep(-aa,aa,box(debugP,vec2(0.),vec2(1.)));result=vec3(z);alpha=mapBounds;}
gl_FragColor=vec4(result*alpha,alpha);
}`;

export const particleVertex = `precision highp float;
attribute vec3 samplePoint;attribute vec4 sampleColour;
uniform vec2 resolution,motion,positionShift;
uniform float intensity,lift,zoom,rotation,amount,push,pointLimit,opacity,particleSize;
${pulseShader}
varying vec4 colour;varying float visibility,dispersion;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 uv=samplePoint.xy;float raw=samplePoint.z;
 float z=(raw*.42+smoothstep(.55,.94,raw)*lift*.27)*sampleColour.a;
 vec2 offset=clamp(motion*intensity*.023,vec2(-.035),vec2(.035));offset.y+=push*.018;
 vec2 rel=(uv-.5)*(1.+clamp(push*.18,-.65,.65)*z)+offset*z-motion*intensity*.004;
 vec2 base=rel;for(int i=0;i<4;i++)rel=base/(1.+dot(rel,motion)*intensity*.027);
 float seed=hash(uv),angle=hash(uv.yx+vec2(.71,.23))*6.2831853;
 float spread=amount*(.025+seed*.14)*(.55+raw);
 vec2 radial=normalize((uv-vec2(.5,.45))*vec2(1.4455,1.)+vec2(.0001));
 rel+=(vec2(cos(angle),sin(angle))+radial*.7)*spread/vec2(1.4455,1.);
 rel.y-=amount*amount*(.015+seed*.04);
 float aspect=resolution.x/resolution.y;
 vec2 size=vec2(1.,aspect/1.4455);if(size.y<1.)size=vec2(1.4455/aspect,1.);size*=zoom;
 vec2 p=rel*size*vec2(aspect,1.);float c=cos(rotation),s=sin(rotation);
 vec2 q=vec2(c*p.x-s*p.y,s*p.x+c*p.y)/vec2(aspect,1.)+.5+positionShift;
 float wave=pulseAt(q);
 vec2 fromClick=(q-pulseCentre)*vec2(aspect,1.);
 vec2 direction=normalize(fromClick+vec2(.0001));
 q+=(direction*(.06+seed*.09)+vec2(cos(angle),sin(angle))*.035)*wave/vec2(aspect,1.);
 visibility=max(opacity,smoothstep(.003,.09,wave));dispersion=max(amount,wave);
 gl_Position=vec4(q.x*2.-1.,1.-q.y*2.,0.,1.);
 gl_PointSize=clamp(resolution.x*size.x/720.*mix(1.45,.7,smoothstep(0.,.65,dispersion))*particleSize,1.,pointLimit);
 colour=sampleColour;
}`;

export const particleFragment = `precision highp float;varying vec4 colour;varying float visibility,dispersion;
void main(){vec2 p=gl_PointCoord-.5;float circle=1.-smoothstep(.34,.5,length(p));float shape=mix(1.,circle,smoothstep(.02,.25,dispersion));float a=colour.a*visibility*shape;if(a<.002)discard;gl_FragColor=vec4(colour.rgb*a,a);}`;
