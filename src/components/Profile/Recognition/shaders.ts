// Shaders
// ------------
// Poster card: a rounded-rectangle sprite that dims with depth and catches a soft glare from lightPosition
export const posterVertexShader = `
varying vec2 vUv;
void main(){
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}
`;

// uniforms: poster = artwork texture, depth = 0 (far) to 1 (front) brightness ramp,
// fade = overall opacity, glareAmount = glare strength, lightPosition = glare centre (about -1..1)
export const fragmentShader = `
uniform sampler2D poster;
uniform float depth;
uniform float fade;
uniform float glareAmount;
uniform vec2 lightPosition;
varying vec2 vUv;
void main(){
  // Signed distance to a rounded rectangle; edge is its anti-aliased mask
  vec2 q=abs((vUv-.5)*vec2(1.,1.416667))-vec2(.475,.683333);
  float sd=length(max(q,0.))+min(max(q.x,q.y),0.)-.025;
  float edge=1.-smoothstep(-.002,.001,sd);
  if(edge<.01)discard;
  // Both faces sample the same uv, so a back face shows the artwork as seen through the card.
  // NOTE • This is how the cards have always rendered: three.js used to draw this transparent
  // double-sided material in two culled passes, and its back-face pass flips the GL front face,
  // so gl_FrontFacing was true there too and the old mirrored branch never ran.
  vec3 c=texture2D(poster,vUv).rgb*mix(.09,1.,pow(depth,1.8));
  // Thin highlight just inside the border
  float rim=1.-smoothstep(.001,.008,abs(sd+.004));
  // Glare: a soft radial reflection plus a diagonal sheen band
  vec2 lightUv=vec2(.5)+lightPosition*.3;
  vec2 delta=(vUv-lightUv)*vec2(1.,1.42);
  float reflection=exp(-dot(delta,delta)*7.);
  float sheen=exp(-pow((vUv.x+vUv.y*.55-lightUv.x-lightUv.y*.55)*5.,2.));
  c+=vec3(1.,.97,.90)*(reflection*.22+sheen*.07)*glareAmount;
  // Rim light, then output with fade as alpha
  c+=rim*(.055*depth+.12*glareAmount);
  gl_FragColor=vec4(c,edge*fade);
  #include <colorspace_fragment>
}
`;
