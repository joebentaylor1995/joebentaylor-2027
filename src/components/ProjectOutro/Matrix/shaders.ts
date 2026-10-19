export const vertex = `attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
export const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D atlas;
uniform vec2 size;
uniform float time, codeTime, hover, cellSize, intensity;
uniform float hoverGlow, hoverSize, hoverDrift, hoverPulse;
uniform float glyphCount;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float letter(float index,vec2 p){
 float bounds=step(0.,p.x)*step(p.x,1.)*step(0.,p.y)*step(p.y,1.);
 return texture2D(atlas,vec2((index+clamp(p.x,.001,.999))/glyphCount,clamp(p.y,.001,.999))).a*bounds;
}
void main(){
 float centreHover=hover*smoothstep(0.,.3,min(uv.x,1.-uv.x));
 vec2 counts=max(vec2(1.),floor(size/cellSize));
 vec2 p=uv;
 p.x+=hoverDrift*hover*((uv.y-.5)*.09+sin(uv.y*5.+time)*.014);
 vec2 cell=floor(p*counts);
 float seed=hash(vec2(cell.x,1.));
 float fall=fract(cell.y/counts.y+time*(.08+seed*.12)+seed);
 float rain=pow(fall,7.)*.55+.04;
 float index=mod(floor(counts.y-cell.y)+floor(codeTime*7.)+floor(seed*glyphCount),glyphCount);
 vec2 local=fract(p*counts);
 local=(local-.5)/mix(1.,hoverSize,hover)+.5;
 float glyph=letter(index,local);
 float glow=0.;
 if(hoverGlow>0.){
   glow=(letter(index,local+vec2(.07,0.))+letter(index,local-vec2(.07,0.))+letter(index,local+vec2(0.,.07))+letter(index,local-vec2(0.,.07)))*.25*centreHover*hoverGlow;
 }
 float pulse=1.;
 pulse+=centreHover*(.5+.5*sin(codeTime*2.5))*hoverPulse;
 float light=(glyph+glow*.75)*rain*intensity*pulse;
 vec3 colour=mix(vec3(.38,.62,1.),vec3(.8,.9,1.),clamp(glow,0.,1.));
 float alpha=clamp(light,0.,1.);
 gl_FragColor=vec4(colour*alpha,alpha);
}`;
