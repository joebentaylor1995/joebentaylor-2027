export const vertex = `
attribute vec2 position;
uniform vec2 viewport;
uniform vec4 box;
varying vec2 uv;
void main(){
 uv=position;
 vec2 point=box.xy+box.zw*position;
 gl_Position=vec4(point.x/viewport.x*2.-1.,1.-point.y/viewport.y*2.,0.,1.);
}`;

export const fragment = `
precision highp float;
uniform sampler2D source;
uniform vec2 cover;
uniform vec2 tileSize;
uniform float progress;
// Clear Glass Aperture: strength 90%, softness 5%.
const float strength=.9;
const float softness=.05;
uniform float radius;
varying vec2 uv;
vec3 media(vec2 p){return texture2D(source,(clamp(p,0.,1.)-.5)*cover+.5).rgb;}
void main(){
 float t=progress;
 float envelope=sin(t*3.141593);
 float unit=min(tileSize.x,tileSize.y);
 vec2 p=(uv-.5)*tileSize/unit;
 vec2 halfSize=tileSize/unit*.5;
 vec2 opening=vec2(t);
 vec2 q=abs(p)-halfSize*opening;
 vec2 normal=q.x>q.y ? vec2(sign(p.x),0.) : vec2(0.,sign(p.y));
 float d=max(q.x,q.y);
 float bandWidth=mix(.018,.095,softness);
 float feather=mix(.001,.012,softness);
 float band=exp(-pow(d/bandWidth,2.))*envelope;
 vec2 offset=normal*band*.038*strength;
 vec2 sampleUV=uv-offset*unit/tileSize;
 vec3 colour=media(sampleUV);
 // A restrained highlight follows only the moving glass edge.
 colour+=vec3(.04,.05,.065)*band*strength;
 float mask=1.-smoothstep(-feather,feather,d);
 mask*=smoothstep(0.,.035,t);
 mask=mix(mask,1.,smoothstep(.96,1.,t));
 vec2 corner=abs((uv-.5)*tileSize)-(tileSize*.5-radius);
 float edge=length(max(corner,0.))+min(max(corner.x,corner.y),0.)-radius;
 float alpha=(1.-smoothstep(-.8,.8,edge))*mask;
 gl_FragColor=vec4(colour*alpha,alpha);
}`;
