import type { CatalogCard } from './cards';
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
    const settle = () => image.parentElement?.classList.add(image.naturalWidth ? 'is-loaded' : 'is-error');
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
const setFilter = root?.querySelector<HTMLSelectElement>('#card-set');
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
  const button=document.createElement('button');button.type='button';button.className='gallery-card';button.dataset.card=JSON.stringify(card);button.setAttribute('aria-label',`${card.name} · ${card.setName} · ${card.number}`);
  const thumb=document.createElement('span');thumb.className='artwork-thumb';
  const image=document.createElement('img');image.src=imageURL(card);image.width=245;image.height=337;image.alt=card.name;image.loading='lazy';image.decoding='async';thumb.append(image);
  const name=document.createElement('span');name.className='gallery-card-name';name.textContent=card.name;
  const set=document.createElement('span');set.className='gallery-card-set';set.textContent=`${card.setName} · ${card.number}`;
  button.append(thumb,name,set);return button;
}
async function renderCards() {
  if(!gallery||!root||!status)return;
  const version=++renderVersion;
  if(more){more.disabled=true;more.textContent=more.dataset.loading||'';}
  gallery.setAttribute('aria-busy','true');status.textContent='';
  try {
    const cards=await loadCatalog();if(version!==renderVersion)return;
    const filtered=filterCards(cards,cardQuery?.value||'',setFilter?.value||'',rarityFilter?.value||'',orderFilter?.value||'newest',{pokemonId:pokemonFilter?.value,hidePocket:display.pocket===false,locale:root.dataset.lang});
    const fragment=document.createDocumentFragment();filtered.slice(0,visibleLimit).forEach(card=>fragment.append(makeCard(card)));
    gallery.replaceChildren(fragment);animateCards(gallery);settleImages(gallery);
    if(more)more.hidden=filtered.length<=visibleLimit;
    status.textContent=`${filtered.length.toLocaleString(root.dataset.lang)} ${filtered.length===1?root.dataset.countSingular:root.dataset.countLabel}`;
  }catch{status.textContent=more?.dataset.failed||root.dataset.failed||'';}
  finally{if(version===renderVersion){if(more){more.disabled=false;more.textContent=more.dataset.idle||'';}gallery.removeAttribute('aria-busy');}}
}
controls?.addEventListener('submit',event=>event.preventDefault());
let queryTimer: ReturnType<typeof setTimeout>;
cardQuery?.addEventListener('input',()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>{visibleLimit=24;void renderCards();},180);});
for(const select of [pokemonFilter,setFilter,rarityFilter,orderFilter])select?.addEventListener('change',()=>{visibleLimit=24;void renderCards();});
const display:{name:boolean;set:boolean;pocket:boolean}={name:true,set:true,pocket:true};
try{const saved=JSON.parse(localStorage.getItem('pokira-gallery-display')||'{}');for(const key of ['name','set','pocket'] as const)if(typeof saved[key]==='boolean')display[key]=saved[key];}catch{}
function updateDisplay(){
 if(gallery){gallery.dataset.showName=String(display.name);gallery.dataset.showSet=String(display.set);}
 root?.querySelectorAll<HTMLButtonElement>('[data-display]').forEach(button=>button.setAttribute('aria-pressed',String(display[button.dataset.display as keyof typeof display])));
}
updateDisplay();
root?.querySelectorAll<HTMLButtonElement>('[data-display]').forEach(button=>button.addEventListener('click',()=>{
 const key=button.dataset.display as keyof typeof display;display[key]=!display[key];updateDisplay();
 try{localStorage.setItem('pokira-gallery-display',JSON.stringify(display));}catch{}
 if(key==='pocket'){visibleLimit=24;void renderCards();}
}));
if(!display.pocket){gallery?.querySelectorAll<HTMLElement>('[data-card]').forEach(card=>{if(JSON.parse(card.dataset.card!).kind==='pocket')card.remove();});void renderCards();}
more?.addEventListener('click',()=>{visibleLimit+=24;void renderCards();});
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
gallery?.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.gallery-card');
  if (!button?.dataset.card || !dialog || !viewerImage || !viewerPreview) return;
  const card: CatalogCard = JSON.parse(button.dataset.card);
  if (!card.image) return;
  lastTrigger = button; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const wrap=viewerImage.parentElement!;
  wrap.style.aspectRatio=`${card.imageWidth || 600} / ${card.imageHeight || 825}`;
  viewerImage.classList.remove('is-loaded'); viewerImage.alt = card.name;
  // The already-loaded thumbnail remains visible while the full image arrives.
  viewerPreview.src=button.querySelector('img')?.currentSrc || imageURL(card);
  viewerImage.onload = () => viewerImage.classList.add('is-loaded');
  viewerImage.onerror = () => viewerImage.classList.remove('is-loaded');
  viewerImage.fetchPriority='high';viewerImage.decoding='async';viewerImage.src=imageURL(card,true);
  if (viewerImage.complete && viewerImage.naturalWidth) viewerImage.classList.add('is-loaded');
  const text = (selector: string, value: string) => { const el = dialog.querySelector(selector); if (el) el.textContent = value; };
  text('.viewer-set', `${card.setName} · ${card.number}`);text('.viewer-credit', card.illustrator);
  text('.viewer-date', card.releaseDate ? ' · '+new Intl.DateTimeFormat(root?.dataset.lang || 'en', {dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${card.releaseDate}T00:00:00Z`)) : '');
  dialog.showModal();dialog.focus({preventScroll:true});
});
const close = () => {
  if (!dialog || dialog.dataset.closing) return;
  dialog.dataset.closing = 'true';
  setTimeout(() => { dialog.close(); delete dialog.dataset.closing; }, 180);
};
dialog?.addEventListener('click', close);
dialog?.addEventListener('cancel', event => { event.preventDefault(); close(); });
dialog?.addEventListener('close', () => { document.body.style.overflow = previousOverflow; if(viewerImage){viewerImage.onload=null;viewerImage.onerror=null;viewerImage.removeAttribute('src');}viewerPreview?.removeAttribute('src'); lastTrigger?.focus(); });
const search = document.querySelector<HTMLInputElement>('#artist-search');
const clear = document.querySelector<HTMLButtonElement>('.search-clear');
search?.addEventListener('input', () => { if (clear) clear.hidden = !search.value; });
clear?.addEventListener('click', () => { if (search) { search.value = ''; clear.hidden = true; search.focus(); } });
