import type { CatalogCard } from './cards';
const root = document.querySelector<HTMLElement>('.illustrator-profile');
const gallery = root?.querySelector<HTMLElement>('.card-gallery');
const more = root?.querySelector<HTMLButtonElement>('.load-more');
const status = root?.querySelector<HTMLElement>('.gallery-status');
const dialog = root?.querySelector<HTMLDialogElement>('.card-viewer');
const viewerImage = dialog?.querySelector<HTMLImageElement>('.viewer-image');
const viewerImageStatus = dialog?.querySelector<HTMLElement>('.viewer-image-status');
let lastTrigger: HTMLElement | null = null;
let previousOverflow = '';
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
more?.addEventListener('click', async () => {
  if (!root || !gallery || !status) return;
  more.disabled = true; more.textContent = more.dataset.loading || ''; status.textContent = ''; gallery.setAttribute('aria-busy','true');
  try {
    const response = await fetch(`/api/artists/${root.dataset.artist}/${root.dataset.lang}/${more.dataset.page}.json?v=${encodeURIComponent(root.dataset.version || "")}`);
    if (!response.ok) throw new Error('Could not load gallery');
    const data: { version: string; cards: CatalogCard[]; more: boolean } = await response.json();
    if (data.version !== root.dataset.version) throw new Error('Catalog changed; reload before loading more');
    const fragment = document.createDocumentFragment();
    for (const card of data.cards) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'gallery-card'; button.dataset.card = JSON.stringify(card); button.disabled = !card.image;
      button.setAttribute('aria-label', `${card.name} · ${card.setName} · ${card.number}`);
      const thumb = document.createElement('span'); thumb.className = `artwork-thumb${card.image ? '' : ' is-error'}`;
      if (card.image) { const image = document.createElement('img'); image.src = `${card.image}/low.webp`; image.width = 245; image.height = 337; image.alt = card.name; image.loading = 'lazy'; image.decoding = 'async'; thumb.append(image); }
      const unavailable = document.createElement('span'); unavailable.className = 'image-unavailable'; unavailable.textContent = more.dataset.unavailable || ''; thumb.append(unavailable);
      const name = document.createElement('span'); name.className = 'gallery-card-name'; name.textContent = card.name;
      const set = document.createElement('span'); set.className = 'gallery-card-set'; set.textContent = `${card.setName} · ${card.number}`;
      button.append(thumb, name, set); fragment.append(button);
    }
    gallery.append(fragment); settleImages(gallery);
    more.dataset.page = String(Number(more.dataset.page) + 1); more.hidden = !data.more;
    if (!data.more) gallery.querySelectorAll<HTMLButtonElement>('.gallery-card')[gallery.children.length - data.cards.length]?.focus();
  } catch { status.textContent = more.dataset.failed || ''; }
  finally { more.disabled = false; more.textContent = more.dataset.idle || ''; gallery.removeAttribute('aria-busy'); }
});
gallery?.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.gallery-card');
  if (!button?.dataset.card || !dialog || !viewerImage) return;
  const card: CatalogCard = JSON.parse(button.dataset.card);
  if (!card.image) return;
  lastTrigger = button; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  viewerImage.classList.remove('is-loaded'); viewerImage.alt = card.name;
  if (viewerImageStatus) viewerImageStatus.textContent = '';
  viewerImage.onload = () => viewerImage.classList.add('is-loaded');
  viewerImage.onerror = () => { viewerImage.classList.add('is-loaded'); if (viewerImageStatus) viewerImageStatus.textContent = dialog.dataset.error || ''; };
  viewerImage.src = `${card.image}/high.webp`;
  const text = (selector: string, value: string) => { const el = dialog.querySelector(selector); if (el) el.textContent = value; };
  text('#viewer-name', card.name); text('.viewer-set', `${card.setName} · ${card.number}`); text('.viewer-credit', card.illustrator);
  text('.viewer-date', card.releaseDate ? new Intl.DateTimeFormat(root?.dataset.lang || 'en', { dateStyle:'long', timeZone:'UTC' }).format(new Date(`${card.releaseDate}T00:00:00Z`)) : '');
  dialog.showModal();
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
