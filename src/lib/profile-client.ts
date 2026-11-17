import type { CatalogCard } from './cards';
import { filterCards } from './catalog-view';
const root = document.querySelector<HTMLElement>('.illustrator-profile');
const gallery = root?.querySelector<HTMLElement>('.card-gallery');
const more = root?.querySelector<HTMLButtonElement>('.load-more');
const status = root?.querySelector<HTMLElement>('.gallery-status');
const dialog = root?.querySelector<HTMLDialogElement>('.card-viewer');
const viewerImage = dialog?.querySelector<HTMLImageElement>('.viewer-image');
const viewerImageStatus = dialog?.querySelector<HTMLElement>('.viewer-image-status');
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
const setFilter = root?.querySelector<HTMLSelectElement>('#card-set');
const rarityFilter = root?.querySelector<HTMLSelectElement>('#card-rarity');
const includeOther = root?.querySelector<HTMLInputElement>('#include-other-language');
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
  const image=document.createElement('img');image.src=`${card.image}/low.webp`;image.width=245;image.height=337;image.alt=card.name;image.loading='lazy';image.decoding='async';thumb.append(image);
  if(card.imageDetails){const badge=document.createElement('span');badge.className='card-language';badge.textContent=card.imageDetails.language==='en'?(root?.dataset.lang==='ja'?'英語':'ENG'):(root?.dataset.lang==='en'?'JP':'日本語');thumb.append(badge);}
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
    const filtered=filterCards(includeOther?.checked === false ? cards.filter(card=>!card.otherLanguageOnly) : cards,cardQuery?.value||'',setFilter?.value||'',rarityFilter?.value||'',orderFilter?.value||'newest');
    const fragment=document.createDocumentFragment();filtered.slice(0,visibleLimit).forEach(card=>fragment.append(makeCard(card)));
    gallery.replaceChildren(fragment);animateCards(gallery);settleImages(gallery);
    if(more)more.hidden=filtered.length<=visibleLimit;
    status.textContent=`${filtered.length.toLocaleString(root.dataset.lang)} ${root.dataset.countLabel}`;
  }catch{status.textContent=more?.dataset.failed||root.dataset.failed||'';}
  finally{if(version===renderVersion){if(more){more.disabled=false;more.textContent=more.dataset.idle||'';}gallery.removeAttribute('aria-busy');}}
}
includeOther?.addEventListener('change',()=>{visibleLimit=24;void renderCards();});
controls?.addEventListener('submit',event=>event.preventDefault());
let queryTimer: ReturnType<typeof setTimeout>;
cardQuery?.addEventListener('input',()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>{visibleLimit=24;void renderCards();},180);});
for(const select of [setFilter,rarityFilter,orderFilter])select?.addEventListener('change',()=>{visibleLimit=24;void renderCards();});
more?.addEventListener('click',()=>{visibleLimit+=24;void renderCards();});
gallery?.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.gallery-card');
  if (!button?.dataset.card || !dialog || !viewerImage) return;
  const card: CatalogCard = JSON.parse(button.dataset.card);
  if (!card.image) return;
  lastTrigger = button; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  viewerImage.classList.remove('is-loaded'); viewerImage.alt = card.name;
  if (viewerImageStatus) viewerImageStatus.textContent = '';
  let triedLossless = false;
  viewerImage.onload = () => {
    if (!triedLossless && viewerImage.naturalWidth < 500 && viewerImage.src.endsWith('/high.webp')) { triedLossless = true; viewerImage.src = `${card.image}/high.png`; return; }
    viewerImage.classList.add('is-loaded');
  };
  viewerImage.onerror = () => { if (viewerImage.src.endsWith('/high.png')) { viewerImage.src = `${card.image}/high.webp`; return; } viewerImage.classList.add('is-loaded'); if (viewerImageStatus) viewerImageStatus.textContent = dialog.dataset.error || ''; };
  viewerImage.src = `${card.image}/high.webp`;
  const displayed = card.imageDetails || card;
  const text = (selector: string, value: string) => { const el = dialog.querySelector(selector); if (el) el.textContent = value; };
  text('#viewer-name', displayed.name); text('.viewer-set', `${displayed.setName} · ${displayed.number}`); text('.viewer-credit', card.illustrator);
  text('.viewer-date', displayed.releaseDate ? new Intl.DateTimeFormat(root?.dataset.lang || 'en', { dateStyle:'long', timeZone:'UTC' }).format(new Date(`${displayed.releaseDate}T00:00:00Z`)) : '');
  dialog.showModal();
  dialog.focus({preventScroll:true});
});
const close = () => {
  if (!dialog || dialog.dataset.closing) return;
  dialog.dataset.closing = 'true';
  setTimeout(() => { dialog.close(); delete dialog.dataset.closing; }, 180);
};
dialog?.querySelector('.viewer-close')?.addEventListener('click', close);
dialog?.addEventListener('click', event => { if (event.target === dialog) close(); });
dialog?.addEventListener('cancel', event => { event.preventDefault(); close(); });
dialog?.addEventListener('close', () => { document.body.style.overflow = previousOverflow; viewerImage?.removeAttribute('src'); lastTrigger?.focus(); });
const search = document.querySelector<HTMLInputElement>('#artist-search');
const clear = document.querySelector<HTMLButtonElement>('.search-clear');
search?.addEventListener('input', () => { if (clear) clear.hidden = !search.value; });
clear?.addEventListener('click', () => { if (search) { search.value = ''; clear.hidden = true; search.focus(); } });
