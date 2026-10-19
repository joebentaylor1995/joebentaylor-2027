'use strict';
// Keep the saved manual tilt separate from the animated presentation angle.
class MouseTilt {
 constructor(rotation){this.rotation=rotation;this.y=.5;this.moving=false;}
 update(dt,enabled,manual,reduced,min=-6,max=6){
  const y=Math.max(0,Math.min(1,this.y));
  // Independent limits retain a neutral centre even with asymmetric angles.
  const goal=enabled?(y<.5?min*(1-y*2):max*(y*2-1)):manual;
  this.rotation+= (goal-this.rotation)*(reduced?1:1-Math.exp(-dt*10));
  this.moving=Math.abs(goal-this.rotation)>.001;
  if(!this.moving)this.rotation=goal;
  return this.rotation;
 }
}
