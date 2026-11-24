import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {installViewerTilt} from '../src/lib/viewer-tilt';

function fixture(t:TestContext){
 const callbacks=new Map<number,FrameRequestCallback>();let nextId=0;
 const oldRequest=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame');
 const oldCancel=Object.getOwnPropertyDescriptor(globalThis,'cancelAnimationFrame');
 Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(cb:FrameRequestCallback)=>{callbacks.set(++nextId,cb);return nextId;}});
 Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:(id:number)=>callbacks.delete(id)});
 t.after(()=>{
  if(oldRequest)Object.defineProperty(globalThis,'requestAnimationFrame',oldRequest);else Reflect.deleteProperty(globalThis,'requestAnimationFrame');
  if(oldCancel)Object.defineProperty(globalThis,'cancelAnimationFrame',oldCancel);else Reflect.deleteProperty(globalThis,'cancelAnimationFrame');
 });
 const captures=new Set<number>();const properties=new Map<string,string>();
 const frame=Object.assign(new EventTarget(),{
  getBoundingClientRect:()=>({left:100,top:100,width:200,height:300}),
  setPointerCapture:(id:number)=>captures.add(id),hasPointerCapture:(id:number)=>captures.has(id),releasePointerCapture:(id:number)=>captures.delete(id)
 });
 const dialog=Object.assign(new EventTarget(),{open:true,dataset:{} as Record<string,string>});
 const surface={dataset:{} as Record<string,string>,style:{setProperty:(key:string,value:string)=>properties.set(key,value)}};
 const reducedMotion={matches:false},finePointer={matches:false};let animating=false;
 const tilt=installViewerTilt({dialog:dialog as unknown as HTMLDialogElement,frame:frame as unknown as HTMLElement,surface:surface as unknown as HTMLElement,reducedMotion,finePointer,canTilt:()=>dialog.open&&!dialog.dataset.closing&&!animating});
 const event=(type:string,x=200,y=250,pointerType='touch',pointerId=1,isPrimary=true)=>Object.assign(new Event(type),{clientX:x,clientY:y,pointerType,pointerId,isPrimary});
 const emit=(type:string,x=200,y=250,pointerType='touch',pointerId=1,isPrimary=true)=>{
  if(type==='pointerdown')dialog.dispatchEvent(event(type,x,y,pointerType,pointerId,isPrimary));
  frame.dispatchEvent(event(type,x,y,pointerType,pointerId,isPrimary));
 };
 const flush=()=>{for(const [id,cb] of [...callbacks]){callbacks.delete(id);cb(0);}};
 return {tilt,emit,flush,properties,surface,captures,dialog,reducedMotion,finePointer,callbacks,setAnimating:(value:boolean)=>{animating=value;}};
}

test('touch dragging tilts the enlarged card and follows the finger with glare',t=>{
 const f=fixture(t);
 f.emit('pointermove',300,100);f.flush();assert.equal(f.properties.size,0);
 f.emit('pointerdown');assert.ok(f.captures.has(1));
 f.emit('pointermove',300,100);assert.equal(f.callbacks.size,1);
 f.emit('pointermove',999,-100);assert.equal(f.callbacks.size,1);f.flush();
 assert.equal(f.properties.get('--tilt-x'),'7deg');assert.equal(f.properties.get('--tilt-y'),'7deg');
 assert.equal(f.properties.get('--glare-x'),'100%');assert.equal(f.properties.get('--glare-y'),'0%');
 assert.equal(f.properties.get('--glare-opacity'),'.22');assert.equal(f.surface.dataset.dragging,'true');
 f.emit('pointerup',999,-100);
 assert.equal(f.properties.get('--tilt-x'),'0deg');assert.equal(f.properties.get('--glare-opacity'),'0');
 assert.equal(f.surface.dataset.dragging,undefined);assert.equal(f.captures.size,0);assert.equal(f.tilt.consumeDragClick(),true);
});

test('a drag returning to its starting point still cannot dismiss the viewer',t=>{
 const f=fixture(t);f.emit('pointerdown');f.emit('pointermove',290,150);f.flush();
 f.emit('pointermove',200,250);f.flush();f.emit('pointerup');
 assert.equal(f.tilt.consumeDragClick(),true);assert.equal(f.tilt.consumeDragClick(),false);
 f.emit('pointerdown');f.emit('pointermove',202,251);f.emit('pointerup',202,251);
 assert.equal(f.tilt.consumeDragClick(),false);
});

test('cancelled gestures and lost capture reset the surface and cancel pending paints',t=>{
 const f=fixture(t);
 for(const cancelled of ['pointercancel','lostpointercapture']){
  f.emit('pointerdown');f.emit('pointermove',300,100);
  f.emit(cancelled);f.flush();assert.equal(f.callbacks.size,0);assert.equal(f.captures.size,0);
  assert.equal(f.properties.get('--tilt-y'),'0deg');assert.equal(f.properties.get('--glare-opacity'),'0');
  assert.equal(f.tilt.consumeDragClick(),true);
 }
});

test('touch motion respects reduced motion, opening animations and closed viewers',t=>{
 const f=fixture(t);f.setAnimating(true);f.emit('pointerdown');f.emit('pointermove',300,100);f.flush();assert.equal(f.properties.size,0);
 f.setAnimating(false);f.reducedMotion.matches=true;f.emit('pointermove',300,100);f.flush();assert.equal(f.properties.size,0);
 f.reducedMotion.matches=false;f.emit('pointermove',300,100);f.flush();assert.equal(f.properties.get('--tilt-y'),'7deg');
 f.tilt.reset();assert.equal(f.captures.size,0);assert.equal(f.properties.get('--tilt-y'),'0deg');
 f.dialog.open=false;f.emit('pointerdown');f.emit('pointermove',300,100);f.flush();assert.equal(f.captures.size,0);assert.equal(f.properties.get('--tilt-y'),'0deg');
});

test('secondary fingers do not take over the gesture',t=>{
 const f=fixture(t);f.emit('pointerdown');f.emit('pointerdown',300,100,'touch',2,false);
 f.emit('pointermove',300,100,'touch',2,false);f.flush();assert.equal(f.properties.size,0);assert.deepEqual([...f.captures],[1]);
 f.emit('pointermove',300,100);f.flush();assert.equal(f.properties.get('--tilt-y'),'7deg');f.tilt.reset();
});

test('desktop hover tilt remains available without capturing the pointer',t=>{
 const f=fixture(t);f.finePointer.matches=true;
 f.emit('pointermove',300,100,'mouse');f.flush();assert.equal(f.properties.get('--tilt-y'),'4deg');assert.equal(f.properties.get('--glare-opacity'),'.18');assert.equal(f.captures.size,0);
 f.emit('pointerleave',300,100,'mouse');assert.equal(f.properties.get('--tilt-y'),'0deg');assert.equal(f.tilt.consumeDragClick(),false);
});
