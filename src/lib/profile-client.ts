import type { CatalogCard } from './cards';
import { responsiveCardImages } from './card-images';
import { filterCards } from './catalog-view';
const root = document.querySelector<HTMLElement>('.illustrator-profile');
const gallery = root?.querySelector<HTMLElement>('.card-gallery');
const more = root?.querySelector<HTMLButtonElement>('.load-more');
const status = root?.querySelector<HTMLElement>('.gallery-status');
const dialog = root?.querySelector<HTMLDialogElement>('.card-viewer');
const viewerImage = dialog?.querySelector<HTMLImageElement>('.viewer-image');
const viewerPreview = dialog?.querySelector<HTMLImageElement>('.viewer-preview');
const imageURL = (card: CatalogCard, high=false) => high ? card.fullImage || `${card.image}/high.webp` : card.thumbnail || `${card.image}/low.webp`;
let lastTrigger: HTMLElement | null = null;
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
const controls = root?.querySelector<HTMLFormElement>('.gallery-controls');
const cardQuery = root?.querySelector<HTMLInputElement>('#card-query');
const pokemonFilter=root?.querySelector<HTMLSelectElement>('#card-pokemon');
const rarityFilter = root?.querySelector<HTMLSelectElement>('#card-rarity');
const orderFilter = root?.querySelector<HTMLSelectElement>('#card-order');
let allCards: CatalogCard[] | null = more ? null : [...(gallery?.querySelectorAll<HTMLElement>('[data-card]') || [])].map(e=>JSON.parse(e.dataset.card!));
let catalogRequest: Promise<CatalogCard[]> | null = null;
let visibleLimit = 24;
let renderVersion = 0;
async function loadCatalog(): Promise<CatalogCard[]> {
  if (allCards) return allCards;
  if (!root) return [];
  if (!catalogRequest) catalogRequest = fetch(`/api/artists/${root.dataset.artist}/${root.dataset.lang}/all.json?v=${encodeURIComponent(root.dataset.version || '')}`).then(async response => {
    if (!response.ok) throw new Error('Could not load gallery');
    const data: {version:string;cards:CatalogCard[]} = await response.json();
    if (data.version !== root.dataset.version) throw new Error('Catalog changed; reload before filtering');
    allCards=data.cards; return data.cards;
  }).catch(error=>{catalogRequest=null;throw error;});
  return catalogRequest;
}
function makeCard(card: CatalogCard) {
  const button=document.createElement('button');button.type='button';button.className='gallery-card';button.dataset.card=JSON.stringify(card);button.setAttribute('aria-label',card.name);
  const thumb=document.createElement('span');thumb.className='artwork-thumb';thumb.style.aspectRatio=`${card.imageWidth || 600}/${card.imageHeight || 825}`;
  const image=document.createElement('img');const sources=responsiveCardImages(card);image.src=sources.src;if(sources.srcset)image.srcset=sources.srcset;image.sizes=sources.sizes;image.width=245;image.height=337;image.alt=card.name;image.loading='lazy';image.decoding='async';thumb.append(image);
  const glare=document.createElement('span');glare.className='artwork-glare';glare.setAttribute('aria-hidden','true');thumb.append(glare);
  button.append(thumb);return button;
}
async function renderCards(append = false) {
  if(!gallery||!root||!status)return;
  const version=++renderVersion;
  if(more){more.disabled=true;more.textContent=more.dataset.loading||'';}
  gallery.setAttribute('aria-busy','true');status.textContent='';
  try {
    const cards=await loadCatalog();if(version!==renderVersion)return;
    const filtered=filterCards(cards,cardQuery?.value||'','',rarityFilter?.value||'',orderFilter?.value||'newest',{pokemonId:pokemonFilter?.value,hidePocket:display.pocket===false,hideTCG:display.tcg===false,locale:root.dataset.lang});
    const fragment=document.createDocumentFragment();
    const start=append?gallery.children.length:0;
    filtered.slice(start,visibleLimit).forEach(card=>fragment.append(makeCard(card)));
    animateCards(fragment);settleImages(fragment);
    if(append)gallery.append(fragment);
    else{resetThumbnailTilt();gallery.replaceChildren(fragment);}
    if(more)more.hidden=filtered.length<=visibleLimit;
    status.textContent=`${filtered.length.toLocaleString(root.dataset.lang)} ${filtered.length===1?root.dataset.countSingular:root.dataset.countLabel}`;
  }catch{status.textContent=more?.dataset.failed||root.dataset.failed||'';}
  finally{if(version===renderVersion){if(more){more.disabled=false;more.textContent=more.dataset.idle||'';}gallery.removeAttribute('aria-busy');}}
}
controls?.addEventListener('submit',event=>{event.preventDefault();clearTimeout(queryTimer);visibleLimit=24;void renderCards();updateFilterCount();closeFilters();});
let queryTimer: ReturnType<typeof setTimeout>;
cardQuery?.addEventListener('input',()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>{visibleLimit=24;void renderCards();updateFilterCount();},180);});
for(const select of [pokemonFilter,rarityFilter,orderFilter])select?.addEventListener('change',()=>{visibleLimit=24;void renderCards();});
const display={pocket:true,tcg:true};
const displayKeys=['pocket','tcg'] as const;
try{const saved=root?.querySelector('.filter-switches')?JSON.parse(localStorage.getItem('pokira-gallery-display')||'{}'):{};for(const key of displayKeys)if(typeof saved[key]==='boolean')display[key]=saved[key];}catch{}
const filterDialog=root?.querySelector<HTMLDialogElement>('.filter-dialog');
const filterTrigger=root?.querySelector<HTMLButtonElement>('.filter-trigger');
let filterOverflow='';
function updateDisplay(){
 root?.querySelectorAll<HTMLInputElement>('[data-display]').forEach(input=>{input.checked=display[input.dataset.display as keyof typeof display];});
 updateFilterCount();
}
function updateFilterCount(){
 const count=Number(Boolean(cardQuery?.value.trim()))+Number(Boolean(pokemonFilter?.value))+Number(Boolean(rarityFilter?.value))+Number(orderFilter?.value!=='newest')+displayKeys.filter(key=>!display[key]).length;
 const badge=filterTrigger?.querySelector<HTMLElement>('.filter-count');if(badge){badge.textContent=String(count);badge.hidden=!count;}
}
function saveDisplay(){try{localStorage.setItem('pokira-gallery-display',JSON.stringify(display));}catch{}}
function closeFilters(){
 if(!filterDialog?.open || filterDialog.dataset.closing)return;
 filterDialog.dataset.closing='true';setTimeout(()=>{filterDialog.close();delete filterDialog.dataset.closing;},180);
}
filterTrigger?.addEventListener('click',()=>{if(!filterDialog)return;filterOverflow=document.body.style.overflow;document.body.style.overflow='hidden';filterDialog.showModal();});
filterDialog?.querySelector('.filter-close')?.addEventListener('click',closeFilters);
filterDialog?.addEventListener('click',event=>{if(event.target===filterDialog)closeFilters();});
filterDialog?.addEventListener('cancel',event=>{event.preventDefault();closeFilters();});
filterDialog?.addEventListener('close',()=>{document.body.style.overflow=filterOverflow;filterTrigger?.focus({preventScroll:true});});
filterDialog?.querySelector('.filter-reset')?.addEventListener('click',()=>{
 controls?.reset();if(cardQuery)cardQuery.value='';for(const key of displayKeys)display[key]=true;
 updateDisplay();saveDisplay();visibleLimit=24;void renderCards();
});
for(const select of [pokemonFilter,rarityFilter,orderFilter])select?.addEventListener('change',updateFilterCount);
updateDisplay();
root?.querySelectorAll<HTMLInputElement>('[data-display]').forEach(input=>input.addEventListener('change',()=>{
 const key=input.dataset.display as keyof typeof display;display[key]=input.checked;updateDisplay();saveDisplay();
 if(key==='pocket'||key==='tcg'){visibleLimit=24;void renderCards();}
}));
if(!display.pocket || !display.tcg){gallery?.querySelectorAll<HTMLElement>('[data-card]').forEach(card=>{const kind=JSON.parse(card.dataset.card!).kind;if(kind==='pocket'?!display.pocket:!display.tcg)card.remove();});void renderCards();}
more?.addEventListener('click',()=>{visibleLimit+=24;void renderCards(true);});
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
// Delegate to the gallery so filtered and newly loaded illustrations work too.
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
function resetViewerTilt(){
 surface?.style.setProperty('--tilt-x','0deg');surface?.style.setProperty('--tilt-y','0deg');surface?.style.setProperty('--glare-opacity','0');
}
flightElement?.addEventListener('pointermove',event=>{
 if(event.pointerType==='touch'||reducedMotion.matches||!finePointer.matches||!dialog?.open||dialog.dataset.closing||flight?.playState==='running'||!surface||!flightElement)return;
 const rect=flightElement.getBoundingClientRect();
 const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
 surface.style.setProperty('--tilt-x',`${(.5-y)*8}deg`);surface.style.setProperty('--tilt-y',`${(x-.5)*8}deg`);
 surface.style.setProperty('--glare-x',`${x*100}%`);surface.style.setProperty('--glare-y',`${y*100}%`);surface.style.setProperty('--glare-opacity','.18');
});
flightElement?.addEventListener('pointerleave',resetViewerTilt);
function sourceTransform(){
 if(!sourceThumb||!flightElement)return 'none';
 const from=sourceThumb.getBoundingClientRect(),to=flightElement.getBoundingClientRect();
 return `translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`;
}
gallery?.addEventListener('click', event => {
 const button=(event.target as HTMLElement).closest<HTMLButtonElement>('.gallery-card');
 if(!button?.dataset.card || !dialog || !viewerImage || !viewerPreview || !surface || !flightElement)return;
 const card:CatalogCard=JSON.parse(button.dataset.card);if(!card.image)return;
 lastTrigger=button;sourceThumb=button.querySelector<HTMLElement>('.artwork-thumb');
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
 const finish=()=>{dialog.close();delete dialog.dataset.closing;};
 if(reducedMotion.matches){finish();return;}
 const rect=sourceThumb?.getBoundingClientRect();const visible=rect&&rect.bottom>0&&rect.top<innerHeight;
 flight=flightElement.animate(visible?[{transform:current},{transform:sourceTransform()}]:[{opacity:1},{opacity:0}],{duration:320,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
 void flight.finished.then(finish).catch(finish);
};
let pointerStart={x:0,y:0};
dialog?.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
dialog?.addEventListener('click',event=>{if(Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)<8)close();});
dialog?.addEventListener('cancel',event=>{event.preventDefault();close();});
dialog?.addEventListener('close',()=>{
 flight?.cancel();flight=null;resetViewerTilt();document.body.style.overflow=previousOverflow;
 lastTrigger?.classList.remove('is-expanded');
 if(viewerImage){viewerImage.onload=null;viewerImage.onerror=null;viewerImage.removeAttribute('src');}viewerPreview?.removeAttribute('src');lastTrigger?.focus({preventScroll:true});
});
const infoButton=root?.querySelector<HTMLButtonElement>('.illustration-info');
const infoWrap=root?.querySelector<HTMLElement>('.illustration-count-wrap');
const info=root?.querySelector<HTMLElement>('.illustration-tooltip');let pinned=false;
function showInfo(){if(!info||!infoButton)return;info.hidden=false;info.style.left='0px';const rect=info.getBoundingClientRect();info.style.left=`${Math.min(0,innerWidth-16-rect.right)}px`;infoButton.setAttribute('aria-expanded','true');}
function hideInfo(){if(info)info.hidden=true;infoButton?.setAttribute('aria-expanded','false');}
infoWrap?.addEventListener('mouseenter',showInfo);infoWrap?.addEventListener('mouseleave',()=>{if(!pinned)hideInfo();});
infoButton?.addEventListener('focus',showInfo);infoButton?.addEventListener('blur',()=>{if(!pinned)hideInfo();});
infoButton?.addEventListener('click',()=>{pinned=!pinned;if(pinned)showInfo();else hideInfo();});
document.addEventListener('pointerdown',event=>{if(!infoWrap?.contains(event.target as Node)){pinned=false;hideInfo();}});
infoButton?.addEventListener('keydown',event=>{if(event.key==='Escape'){pinned=false;hideInfo();}});
const search = document.querySelector<HTMLInputElement>('#artist-search');
const clear = document.querySelector<HTMLButtonElement>('.search-clear');
search?.addEventListener('input', () => { if (clear) clear.hidden = !search.value; });
clear?.addEventListener('click', () => { if (search) { search.value = ''; clear.hidden = true; search.focus(); } });
