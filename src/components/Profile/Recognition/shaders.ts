export const posterVertexShader = `
varying vec2 vUv;
void main(){
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}
`;

export const fragmentShader = `
uniform sampler2D poster;
uniform float depth;
uniform float fade;
uniform float glareAmount;
uniform vec2 lightPosition;
varying vec2 vUv;
void main(){
  vec2 q=abs((vUv-.5)*vec2(1.,1.416667))-vec2(.475,.683333);
  float sd=length(max(q,0.))+min(max(q.x,q.y),0.)-.025;
  float edge=1.-smoothstep(-.002,.001,sd);
  if(edge<.01)discard;
  vec2 uv=gl_FrontFacing?vUv:vec2(1.-vUv.x,vUv.y);
  vec3 c=texture2D(poster,uv).rgb*mix(.09,1.,pow(depth,1.8));
  float rim=1.-smoothstep(.001,.008,abs(sd+.004));
  vec2 lightUv=vec2(.5)+lightPosition*.3;
  vec2 delta=(vUv-lightUv)*vec2(1.,1.42);
  float reflection=exp(-dot(delta,delta)*7.);
  float sheen=exp(-pow((vUv.x+vUv.y*.55-lightUv.x-lightUv.y*.55)*5.,2.));
  c+=vec3(1.,.97,.90)*(reflection*.22+sheen*.07)*glareAmount;
  c+=rim*(.055*depth+.12*glareAmount);
  gl_FragColor=vec4(c,edge*fade);
  #include <colorspace_fragment>
}
`;
