export const vertex = `
precision mediump float;
attribute vec4 a_drop;
attribute vec2 a_style;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dpr;
uniform float u_pass;
uniform float u_size;
uniform sampler2D u_portrait;
uniform float u_portraitSize;
uniform float u_aspect;
uniform float u_depth;
uniform float u_bend;
uniform float u_angle;
uniform vec2 u_cursor;
uniform vec2 u_tilt;
uniform float u_magnet;
uniform float u_reach;
uniform float u_ripple;
uniform vec4 u_waves[4];
uniform vec4 u_burst;
uniform vec2 u_chargeWave;
uniform mediump float u_chargeDetail;
varying float v_detail;
varying float v_glyph;
varying float v_light;
varying float v_y;
varying float v_surface;
varying float v_shade;
varying float v_wave;
varying float v_visibility;
varying float v_break;
varying float v_seed;
float portraitFeather(vec2 uv){
 // Retain all three numerals, including the outer edges of each four.
 vec2 edge=min(uv,1.0-uv);
 return smoothstep(0.0,0.025,min(edge.x,edge.y));
}
float surface(vec2 uv){
 float bounds=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
 vec2 texUV=clamp(uv,0.0,1.0);
 float value=texture2D(u_portrait,texUV).r*0.2;
 value+=texture2D(u_portrait,texUV+vec2(0.012,0.012)).r*0.2;
 value+=texture2D(u_portrait,texUV+vec2(-0.012,0.012)).r*0.2;
 value+=texture2D(u_portrait,texUV+vec2(0.012,-0.012)).r*0.2;
 value+=texture2D(u_portrait,texUV+vec2(-0.012,-0.012)).r*0.2;
 float mask=smoothstep(0.025,0.16,value)*bounds;
 vec2 p=(uv-vec2(0.50,0.46))/vec2(0.40,0.52);
 float dome=sqrt(max(0.0,1.0-dot(p,p)));
 return mask*value;
}
void main(){
 float height=u_resolution.y;
 float y=mod(a_drop.y+u_time*a_drop.z,height+160.0)-80.0;
 float x=a_drop.x;
 float portraitHeight=min(u_resolution.y*0.96,u_resolution.x/u_aspect*0.9)*u_portraitSize;
 vec2 extent=vec2(portraitHeight*u_aspect,portraitHeight);
 vec2 uv=(vec2(x,y)-vec2(u_resolution.x*0.5,u_resolution.y*0.43))/extent+0.5;
 float z=surface(uv);
 // Keep the relief smooth, but recover the original portrait's fine features on charge.
 float portraitBounds=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
 float rawDetail=texture2D(u_portrait,clamp(uv,0.0,1.0)).r;
 float surrounding=(texture2D(u_portrait,clamp(uv+vec2(0.006,0.0),0.0,1.0)).r+texture2D(u_portrait,clamp(uv-vec2(0.006,0.0),0.0,1.0)).r+texture2D(u_portrait,clamp(uv+vec2(0.0,0.006),0.0,1.0)).r+texture2D(u_portrait,clamp(uv-vec2(0.0,0.006),0.0,1.0)).r)*0.25;
 v_detail=clamp((rawDetail+(rawDetail-surrounding)*1.4-0.10)*1.35,0.0,1.0)*portraitBounds*portraitFeather(uv);
 float stepSize=0.018;
 vec2 slope=vec2(surface(uv+vec2(stepSize,0.0))-surface(uv-vec2(stepSize,0.0)),surface(uv+vec2(0.0,stepSize))-surface(uv-vec2(0.0,stepSize)))/(2.0*stepSize);
 // Flow around protruding ridges, then project the raised relief in 3D.
 x-=clamp(slope.x,-2.0,2.0)*portraitHeight*0.025*u_bend;
 y-=clamp(slope.y,-2.0,2.0)*portraitHeight*0.004*u_bend;
 float elevation=z*portraitHeight*0.20*u_depth;
 float perspective=1.0+elevation/(u_resolution.y*2.4);
 x=u_resolution.x*0.5+(x-u_resolution.x*0.5)*perspective+sin(u_angle)*elevation;
 y=u_resolution.y*0.43+(y-u_resolution.y*0.43)*perspective-elevation*0.13;
 // Virtual camera tilt uses its own shallow relief, even with Face depth at zero.
 float faceMask=smoothstep(0.025,0.22,z);
 float yaw=u_tilt.x*0.65,pitch=u_tilt.y;
 float virtualDepth=z*portraitHeight*0.24;
 vec2 local=vec2(x,y)-vec2(u_resolution.x*0.5,u_resolution.y*0.43);
 float rotatedX=local.x*cos(yaw)+virtualDepth*sin(yaw);
 float rotatedZ=virtualDepth*cos(yaw)-local.x*sin(yaw)*faceMask;
 float rotatedY=local.y*cos(pitch)+rotatedZ*sin(pitch);
 float cameraScale=1.0+(rotatedZ-virtualDepth)/(u_resolution.y*3.0);
 vec2 tilted=vec2(rotatedX,rotatedY)*cameraScale;
 vec2 layerDrift=u_tilt*mix(7.0,24.0,clamp(a_style.y,0.0,1.0));
 vec2 parallaxOffset=(tilted-local)*faceMask+layerDrift;
 x+=parallaxOffset.x;y+=parallaxOffset.y;
 // Evaluate in projected screen space: waves originate exactly at the click,
 // and displace every stream, regardless of the portrait mask or depth.
 vec2 waveDisplacement=vec2(0.0);float wave=0.0;
 for(int i=0;i<4;i++){
  vec2 offset=vec2(x,y)-u_waves[i].xy;
  float distanceToWave=length(offset);
  float age=u_waves[i].z;
  float front=distanceToWave-age*480.0;
  float envelope=exp(-pow(front/125.0,2.0))*exp(-age*0.32)*smoothstep(0.0,0.07,age);
  float pulse=sin(front*0.036)*envelope*u_waves[i].w*u_ripple;
  wave+=pulse;
  waveDisplacement+=offset/max(distanceToWave,1.0)*pulse*42.0;
 }
 // One broad inward pulse: no oscillating crests or repeated rings.
 vec2 inwardOffset=vec2(x,y)-u_cursor;
 float inwardDistance=length(inwardOffset);
 float outerRadius=length(max(u_cursor,u_resolution-u_cursor))+100.0;
 float inwardAge=u_chargeWave.x;
 float radius=outerRadius*(1.0-clamp(inwardAge/0.9,0.0,1.0));
 float bandWidth=180.0;
 float front=(inwardDistance-radius)/bandWidth;
 float envelope=exp(-front*front)*smoothstep(0.0,0.06,inwardAge)*(1.0-smoothstep(0.8,1.05,inwardAge));
 float inwardPulse=envelope*u_chargeWave.y;
 wave+=inwardPulse;
 waveDisplacement-=inwardOffset/max(inwardDistance,1.0)*inwardPulse*42.0;
 wave=clamp(wave,-2.0,2.0);
 x+=waveDisplacement.x;y+=waveDisplacement.y+wave*14.0;
 v_wave=wave;
 vec2 delta=u_cursor-vec2(x,y);
 float falloff=exp(-dot(delta,delta)/(u_reach*u_reach*0.5));
 vec2 attraction=delta*min(0.7,u_magnet*0.45)*falloff;
 x+=attraction.x;y+=attraction.y;
 vec3 normal=normalize(vec3(-slope.x*u_depth*0.35,-slope.y*u_depth*0.35,1.0));
 v_shade=0.25+0.75*max(0.0,dot(normal,normalize(vec3(-0.65,-0.4,1.0))));
 v_surface=z*mix(1.0,portraitFeather(uv),u_chargeDetail);
 float burstAge=u_burst.z;
 float burstOn=u_burst.w;
 float seed=fract(sin(a_drop.w*1.17+a_drop.x*0.03+a_drop.y*0.011)*437.58);
 float randomAngle=seed*6.28318;
 vec2 radial=vec2(x,y)-u_burst.xy;
 float distanceFromClick=length(radial);
 float arrival=distanceFromClick/max(length(u_resolution)*0.46,1.0);
 float sinceImpact=max(0.0,burstAge-arrival);
 float dissolved=smoothstep(0.0,1.25+seed*0.45,sinceImpact)*burstOn;
 // A soft front sweeps down the screen in the same direction as the rain.
 float returnArrival=4.5+clamp(y/height,0.0,1.0)*2.2;
 float reform=smoothstep(returnArrival,returnArrival+0.7,burstAge);
 float returnPhase=(burstAge-returnArrival-0.3)/0.23;
 float returnCrest=exp(-returnPhase*returnPhase)*burstOn;
 // Reset the debris while invisible so new code flows down, rather than rewinding.
 float breaking=dissolved*(1.0-smoothstep(3.8,4.5,burstAge));
 float frontDistance=(burstAge-arrival)/0.12;
 float crest=exp(-frontDistance*frontDistance)*burstOn*smoothstep(0.0,0.08,burstAge);
 vec2 kick=radial/max(distanceFromClick,1.0)*crest*32.0;
 x+=kick.x;y+=kick.y;v_wave+=crest*0.6;
 // The shock front fractures each glyph; debris stays close and dies away.
 x+=sin(randomAngle)*breaking*(12.0+seed*36.0)+sin(burstAge*2.0+randomAngle)*breaking*6.0;
 y+=breaking*(18.0+seed*48.0);
 v_break=breaking;v_seed=seed;
 v_visibility=mix(1.0-smoothstep(0.72,1.0,dissolved),1.0,reform);
 y+=returnCrest*10.0;
 v_wave+=returnCrest*0.18;
 v_wave+=sin(randomAngle+burstAge*2.0)*breaking*0.22;
 gl_Position=vec4(x/u_resolution.x*2.0-1.0,1.0-y/height*2.0,0.0,1.0);
 gl_PointSize=a_style.x*u_size*u_dpr*(1.0-u_chargeDetail*faceMask*0.16)*(1.0+abs(wave)*0.55)*(u_pass>0.5?2.8:1.0);
 v_glyph=mod(a_drop.w+floor(u_time*(1.5+a_style.y)),64.0);
 v_y=clamp(y/height,0.0,1.0);
 v_light=a_style.y;
}`;

export const fragment = `
precision mediump float;
uniform mediump float u_chargeDetail;
varying float v_detail;
uniform sampler2D u_atlas;
uniform sampler2D u_portrait;
uniform float u_face;
uniform vec3 u_blue;
uniform float u_portraitSize;
uniform float u_aspect;
uniform float u_brightness;
uniform float u_glow;
uniform float u_fade;
uniform float u_pass;
uniform vec2 u_resolution;
uniform float u_dpr;
varying float v_glyph;
varying float v_light;
varying float v_y;
varying float v_surface;
varying float v_shade;
varying float v_wave;
varying float v_visibility;
varying float v_break;
varying float v_seed;
void main(){
 float face=mix(v_surface,v_detail,u_chargeDetail)*u_face;
 float fade=pow(v_y,u_fade);
 float ink;
 if(u_pass>0.5){float d=length(gl_PointCoord-0.5);ink=exp(-d*d*24.0)*0.12*u_glow*(1.0-v_break);}
 else {
  vec2 q=(gl_PointCoord-0.5)*(1.0+abs(v_wave)*0.55);
  float angle=v_wave*0.65;float c=cos(angle),s=sin(angle);
  q=mat2(c,-s,s,c)*q;
  q.x/=1.0+abs(v_wave)*0.45;q.y*=1.0+abs(v_wave)*0.25;
  q.x+=sin(q.y*9.0)*v_wave*0.10;
  float band=floor((q.y+0.5)*7.0);
  float fracture=fract(sin(band*3.71+v_seed*19.0)*437.58);
  q.x+=(fracture-0.5)*v_break*0.38;
  vec2 glyphUV=q+0.5;
  float bounds=step(0.0,glyphUV.x)*step(glyphUV.x,1.0)*step(0.0,glyphUV.y)*step(glyphUV.y,1.0);
  vec2 tile=vec2(mod(v_glyph,8.0),floor(v_glyph/8.0));ink=texture2D(u_atlas,(tile+clamp(glyphUV,0.005,0.995))/8.0).a*bounds;
  vec2 cell=floor(gl_PointCoord*vec2(7.0,9.0));
  float fragmentLife=fract(sin(dot(cell,vec2(12.1,7.7))+v_seed*31.0)*437.58);
  ink*=smoothstep(v_break*1.08-0.07,v_break*1.08+0.07,fragmentLife+0.08);
 }
 vec3 blue=u_blue;
 vec3 color=mix(blue,vec3(0.38,0.70,1.0),clamp(face*v_shade,0.0,1.0));
 float portraitLight=mix(v_shade*(0.45+v_light*2.0),0.75+v_light*0.65,u_chargeDetail);
 float light=fade*v_light*0.5+face*portraitLight+abs(v_wave)*0.22;
 gl_FragColor=vec4(color,min(1.0,ink*light*u_brightness)*v_visibility);
}`;
