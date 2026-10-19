'use strict';
class VelocityShape {
 constructor(){this.tilt=0;this.curve=0;this.moving=false;}
 update(dt,velocity,settings,active,reduced){
  const speed=Math.min(1,Math.abs(velocity)/8);
  const strength=speed*speed*(3-2*speed);
  const tilt=active&&settings.velocityTilt?Math.sign(velocity)*strength*settings.velocityTiltAmount:0;
  const curve=active&&settings.velocityCurve?strength*settings.velocityCurveAmount:0;
  const ease=reduced?1:1-Math.exp(-dt*10);
  this.tilt+=(tilt-this.tilt)*ease;this.curve+=(curve-this.curve)*ease;
  if(Math.abs(tilt-this.tilt)<.001)this.tilt=tilt;
  if(Math.abs(curve-this.curve)<.001)this.curve=curve;
  this.moving=this.tilt!==tilt||this.curve!==curve;
 }
 view(base){return {...base,rotation:Math.max(-45,Math.min(45,base.rotation+this.tilt)),curve:Math.min(100,base.curve+this.curve)}}
}
