type Preference = { readonly matches: boolean };
interface ViewerTiltOptions {
 dialog: HTMLDialogElement;
 frame: HTMLElement;
 surface: HTMLElement;
 reducedMotion: Preference;
 finePointer: Preference;
 canTilt: () => boolean;
}

// Only the enlarged card installs touch handlers. Gallery scrolling stays native.
export function installViewerTilt({dialog,frame,surface,reducedMotion,finePointer,canTilt}:ViewerTiltOptions){
 let drag:{id:number;x:number;y:number;moved:boolean}|null=null;
 let suppressClick=false;
 let animationFrame=0;
 let point={x:0,y:0,touch:false};
 const resetSurface=()=>{
  if(animationFrame){cancelAnimationFrame(animationFrame);animationFrame=0;}
  delete surface.dataset.dragging;
  surface.style.setProperty('--tilt-x','0deg');
  surface.style.setProperty('--tilt-y','0deg');
  surface.style.setProperty('--glare-opacity','0');
 };
 const finishDrag=(event:PointerEvent,cancelled=false)=>{
  if(!drag||event.pointerId!==drag.id)return;
  suppressClick=drag.moved||cancelled||Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>=8;
  const id=drag.id;drag=null;
  if(frame.hasPointerCapture(id))frame.releasePointerCapture(id);
  resetSurface();
 };
 dialog.addEventListener('pointerdown',event=>{if(event.isPrimary)suppressClick=false;});
 frame.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='touch'||!event.isPrimary||!dialog.open||dialog.dataset.closing||drag)return;
  suppressClick=false;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  frame.setPointerCapture(event.pointerId);
 });
 frame.addEventListener('pointermove',event=>{
  const touch=event.pointerType==='touch';
  if(touch){
   if(!drag||event.pointerId!==drag.id)return;
   drag.moved ||= Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>=8;
   if(!drag.moved)return;
  }else if(drag||!finePointer.matches)return;
  if(reducedMotion.matches||!canTilt())return;
  point={x:event.clientX,y:event.clientY,touch};
  if(animationFrame)return;
  animationFrame=requestAnimationFrame(()=>{
   animationFrame=0;
   if(reducedMotion.matches||!canTilt())return;
   const rect=frame.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   const x=Math.max(0,Math.min(1,(point.x-rect.left)/rect.width));
   const y=Math.max(0,Math.min(1,(point.y-rect.top)/rect.height));
   const extent=point.touch?30:8;
   if(point.touch)surface.dataset.dragging='true';
   surface.style.setProperty('--tilt-x',`${(.5-y)*extent}deg`);
   surface.style.setProperty('--tilt-y',`${(x-.5)*extent}deg`);
   surface.style.setProperty('--glare-x',`${x*100}%`);
   surface.style.setProperty('--glare-y',`${y*100}%`);
   surface.style.setProperty('--glare-opacity',point.touch?'.22':'.18');
  });
 });
 frame.addEventListener('pointerup',event=>finishDrag(event));
 frame.addEventListener('pointercancel',event=>finishDrag(event,true));
 frame.addEventListener('lostpointercapture',event=>finishDrag(event,true));
 frame.addEventListener('pointerleave',()=>{if(!drag)resetSurface();});
 return {
  reset(){
   if(drag){const id=drag.id;drag=null;if(frame.hasPointerCapture(id))frame.releasePointerCapture(id);}
   suppressClick=false;
   resetSurface();
  },
  consumeDragClick(){const suppressed=suppressClick;suppressClick=false;return suppressed;}
 };
}
