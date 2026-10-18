'use strict';
// Decode -> WebGL texture -> GPU crop into the atlas. No 2D canvas readback.
class VideoAtlasUploader {
 constructor(gl){
  this.gl=gl;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader};
  this.program=gl.createProgram();
  const vs=compile(gl.VERTEX_SHADER,'attribute vec2 aPosition; varying vec2 vUV; void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}');
  const fs=compile(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 vUV; uniform sampler2D uVideo; uniform vec4 uCrop; void main(){gl_FragColor=texture2D(uVideo,uCrop.xy+vUV*uCrop.zw);}');
  gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  this.position=gl.getAttribLocation(this.program,'aPosition');this.crop=gl.getUniformLocation(this.program,'uCrop');
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  this.source=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.source);
  for(const [key,value]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);
  this.framebuffer=gl.createFramebuffer();
 }
 attach(texture){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);const valid=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(!valid)throw Error('Video atlas render target unavailable');}
 upload(video,index,width,height,columns){
  const gl=this.gl,sourceAspect=video.videoWidth/video.videoHeight,targetAspect=width/height;
  const cropX=Math.min(1,targetAspect/sourceAspect),cropY=Math.min(1,sourceAspect/targetAspect);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.source);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.viewport((index%columns)*width,Math.floor(index/columns)*height,width,height);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
  gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
  gl.uniform4f(this.crop,(1-cropX)/2,(1-cropY)/2,cropX,cropY);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 finish(){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,gl.canvas.width,gl.canvas.height);}
}
