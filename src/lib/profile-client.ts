import type { CatalogCard } from './cards';
import { installViewerTilt } from './viewer-tilt';
const root = document.querySelector<HTMLElement>('.illustrator-profile');
const gallery = root?.querySelector<HTMLElement>('.card-gallery');
const dialog = root?.querySelector<HTMLDialogElement>('.card-viewer');
const viewerImage = dialog?.querySelector<HTMLImageElement>('.viewer-image');
const viewerPreview = dialog?.querySelector<HTMLImageElement>('.viewer-preview');
const imageURL = (card: CatalogCard, high=false) => high ? card.fullImage || `${card.image}/high.webp` : card.thumbnail || `${card.image}/low.webp`;
let lastTrigger: HTMLElement | null = null;
let openedWithKeyboard=false;
let previousOverflow = '';
function animateCards(parent: ParentNode) {
  parent.querySelectorAll<HTMLElement>('.gallery-card').forEach((card,index)=>{card.style.setProperty('--gallery-delay', `${Math.min(index,8)*90}ms`);});
}
if(gallery){animateCards(gallery);requestAnimationFrame(()=>requestAnimationFrame(()=>gallery.classList.add('is-ready')));}
function settleImages(parent: ParentNode) {
  parent.querySelectorAll<HTMLImageElement>('.artwork-thumb img').forEach(image => {
    const settle = () => {if(image.naturalWidth && image.parentElement)image.parentElement.style.aspectRatio=`${image.naturalWidth}/${image.naturalHeight}`;image.parentElement?.classList.add(image.naturalWidth ? 'is-loaded' : 'is-error');};
    if (image.complete) settle();
    else { image.addEventListener('load', settle, { once: true }); image.addEventListener('error', settle, { once: true }); }
  });
}
if (root) settleImages(root);
const social = root?.querySelector<HTMLElement>('.artist-socials');
const updateFade = () => { if (social) { social.dataset.before = String(social.scrollLeft > 2); social.dataset.more = String(social.scrollLeft + social.clientWidth < social.scrollWidth - 2); } };
social?.addEventListener('scroll', updateFade, { passive: true });
if (social) new ResizeObserver(updateFade).observe(social);
updateFade();
// Warm only the card the visitor is about to open, never the whole gallery.
const warmed = new Map<string, HTMLImageElement>();
function warmCard(event: Event) {
  if (event instanceof PointerEvent && event.pointerType === 'touch') return;
  const button=(event.target as HTMLElement).closest<HTMLElement>('[data-card]');
  if (!button?.dataset.card) return;
  if ((navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData) return;
  const card: CatalogCard=JSON.parse(button.dataset.card);const url=imageURL(card,true);
  if (warmed.has(url)) return;
  const image=new Image();image.decoding='async';image.fetchPriority='low';image.src=url;warmed.set(url,image);
  if (warmed.size>8) warmed.delete(warmed.keys().next().value!);
}
gallery?.addEventListener('pointerover',warmCard);
gallery?.addEventListener('focusin',warmCard);
const flightElement=dialog?.querySelector<HTMLElement>('.viewer-content');
const surface=dialog?.querySelector<HTMLElement>('.viewer-image-wrap');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let flight:Animation|null=null;
let sourceThumb:HTMLElement|null=null;
const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
let hoveredCard:HTMLButtonElement|null=null;
let hoveredSurface:HTMLElement|null=null;
let pointerFrame=0;let point={x:0,y:0};
function resetThumbnailTilt(){
 if(pointerFrame){cancelAnimationFrame(pointerFrame);pointerFrame=0;}
 hoveredSurface?.style.setProperty('--tilt-x','0deg');hoveredSurface?.style.setProperty('--tilt-y','0deg');hoveredSurface?.style.setProperty('--glare-opacity','0');
 hoveredCard?.classList.remove('is-tilting');hoveredCard=null;hoveredSurface=null;
}
// Keep the card tilt interaction delegated to the preview gallery.
gallery?.addEventListener('pointermove',event=>{
 if(event.pointerType==='touch'||reducedMotion.matches||!finePointer.matches||dialog?.open){resetThumbnailTilt();return;}
 const button=(event.target as HTMLElement).closest<HTMLButtonElement>('.gallery-card');
 if(!button||button.disabled){resetThumbnailTilt();return;}
 if(button!==hoveredCard){resetThumbnailTilt();hoveredCard=button;hoveredSurface=button.querySelector<HTMLElement>('.artwork-thumb');button.classList.add('is-tilting');}
 point={x:event.clientX,y:event.clientY};if(pointerFrame)return;
 pointerFrame=requestAnimationFrame(()=>{
  pointerFrame=0;if(!hoveredCard||!hoveredSurface||!hoveredCard.isConnected)return;
  const rect=hoveredCard.getBoundingClientRect();const x=Math.max(0,Math.min(1,(point.x-rect.left)/rect.width));const y=Math.max(0,Math.min(1,(point.y-rect.top)/rect.height));
  hoveredSurface.style.setProperty('--tilt-x',`${(.5-y)*12}deg`);hoveredSurface.style.setProperty('--tilt-y',`${(x-.5)*12}deg`);
  hoveredSurface.style.setProperty('--glare-x',`${x*100}%`);hoveredSurface.style.setProperty('--glare-y',`${y*100}%`);hoveredSurface.style.setProperty('--glare-opacity','.18');
 });
});
gallery?.addEventListener('pointerout',event=>{if(hoveredCard&&!hoveredCard.contains(event.relatedTarget as Node|null))resetThumbnailTilt();});
gallery?.addEventListener('pointerleave',resetThumbnailTilt);
const viewerTilt=dialog&&flightElement&&surface?installViewerTilt({
 dialog,frame:flightElement,surface,reducedMotion,finePointer,
 canTilt:()=>dialog.open&&!dialog.dataset.closing&&flight?.playState!=='running'
}):null;
function resetViewerTilt(){viewerTilt?.reset();}
function sourceTransform(){
 if(!sourceThumb||!flightElement)return 'none';
 const from=sourceThumb.getBoundingClientRect(),to=flightElement.getBoundingClientRect();
 return `translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`;
}
gallery?.addEventListener('click', event => {
 const button=(event.target as HTMLElement).closest<HTMLButtonElement>('.gallery-card');
 if(!button?.dataset.card || !dialog || !viewerImage || !viewerPreview || !surface || !flightElement)return;
 const card:CatalogCard=JSON.parse(button.dataset.card);if(!card.image)return;
 openedWithKeyboard=event.detail===0;lastTrigger=button;sourceThumb=button.querySelector<HTMLElement>('.artwork-thumb');
 const thumbnail=button.querySelector<HTMLImageElement>('img');
 const ratio=thumbnail?.naturalWidth?thumbnail.naturalWidth/thumbnail.naturalHeight:(card.imageWidth||600)/(card.imageHeight||825);
 surface.style.aspectRatio=String(ratio);dialog.style.setProperty('--viewer-ratio',String(ratio));
 resetThumbnailTilt();resetViewerTilt();
 viewerImage.classList.remove('is-loaded');viewerImage.alt=card.name;
 viewerPreview.src=thumbnail?.currentSrc || imageURL(card);
 viewerImage.onload=()=>viewerImage.classList.add('is-loaded');viewerImage.onerror=()=>viewerImage.classList.remove('is-loaded');
 viewerImage.fetchPriority='high';viewerImage.decoding='async';viewerImage.src=imageURL(card,true);
 if(viewerImage.complete&&viewerImage.naturalWidth)viewerImage.classList.add('is-loaded');
 previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();
 const from=sourceTransform();button.classList.add('is-expanded');
 if(!reducedMotion.matches){
  flight=flightElement.animate([{transform:from},{transform:'none'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});
 }
 dialog.focus({preventScroll:true});
});
const close=()=>{
 if(!dialog?.open||dialog.dataset.closing||!flightElement)return;
 dialog.dataset.closing='true';resetViewerTilt();
 const current=getComputedStyle(flightElement).transform;flight?.cancel();
 const finish=()=>{dialog.close();if(!openedWithKeyboard)lastTrigger?.blur();delete dialog.dataset.closing;};
 if(reducedMotion.matches){finish();return;}
 const rect=sourceThumb?.getBoundingClientRect();const visible=rect&&rect.bottom>0&&rect.top<innerHeight;
 flight=flightElement.animate(visible?[{transform:current},{transform:sourceTransform()}]:[{opacity:1},{opacity:0}],{duration:320,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
 void flight.finished.then(finish).catch(finish);
};
let pointerStart={x:0,y:0};
dialog?.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
dialog?.addEventListener('click',event=>{if(!viewerTilt?.consumeDragClick()&&Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)<8)close();});
dialog?.addEventListener('cancel',event=>{event.preventDefault();close();});
dialog?.addEventListener('close',()=>{
 flight?.cancel();flight=null;resetViewerTilt();document.body.style.overflow=previousOverflow;
 lastTrigger?.classList.remove('is-expanded');
 if(viewerImage){viewerImage.onload=null;viewerImage.onerror=null;viewerImage.removeAttribute('src');}viewerPreview?.removeAttribute('src');if(openedWithKeyboard)lastTrigger?.focus({preventScroll:true});else lastTrigger?.blur();
});

// Size the continuation fade to the final row at every responsive breakpoint.
function updatePreviewFade(){
 if(!gallery)return;
 const last=[...gallery.querySelectorAll<HTMLElement>('.gallery-card')].filter(card=>card.getClientRects().length).at(-1);
 if(last)gallery.parentElement?.style.setProperty('--preview-fade-height',`${last.getBoundingClientRect().height*.76}px`);
}
if(gallery){new ResizeObserver(updatePreviewFade).observe(gallery);updatePreviewFade();}
