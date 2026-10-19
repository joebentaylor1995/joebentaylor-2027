'use strict';
const exportControls=document.createElement('div');
exportControls.innerHTML='<label class="switch-row">Hide UI <input id="hide-ui" type="checkbox"></label><p class="grid-note">Press H or tap with two fingers to restore UI.</p><div class="panel-actions"><button id="export-retina" type="button">Export 3× PNG</button></div><p class="grid-note" id="export-status">Exports the canvas only, without UI.</p>';
document.querySelector('#settings .panel-actions').before(exportControls);
const hideUIControl=document.querySelector('#hide-ui');
function hideInterface(hidden){document.body.classList.toggle('hide-interface',hidden);hideUIControl.checked=hidden;}
hideUIControl.onchange=()=>hideInterface(hideUIControl.checked);
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='h'&&!e.metaKey&&!e.ctrlKey&&!['INPUT','TEXTAREA'].includes(e.target.tagName))hideInterface(!hideUIControl.checked);if(e.key==='Escape'&&hideUIControl.checked)hideInterface(false)});
canvas.addEventListener('touchstart',e=>{if(e.touches.length===2&&hideUIControl.checked)hideInterface(false)},{passive:true});
document.querySelector('#export-retina').onclick=()=>{
 const status=document.querySelector('#export-status');
 if(!ready){status.textContent='Wait for projects to finish loading.';return;}
 try{
  cancelAnimationFrame(raf);raf=0;exportPixelRatio=3;
  render(performance.now());
  const link=document.createElement('a');link.download=`${gridView?.target?'all-projects':'featured'}-${innerWidth*3}x${innerHeight*3}.png`;
  link.href=canvas.toDataURL('image/png');link.click();
  status.textContent=`Exported ${canvas.width} × ${canvas.height} PNG.`;
 }catch(error){status.textContent='Could not export: '+error.message;}
 finally{exportPixelRatio=0;requestRender();}
};
const exportStyle=document.createElement('style');exportStyle.textContent='body.hide-interface > :not(canvas):not(script):not(style){visibility:hidden!important}';document.head.append(exportStyle);
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='e'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!['INPUT','TEXTAREA'].includes(e.target.tagName))document.querySelector('#export-retina').click()});
