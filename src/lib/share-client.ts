export {};
const dialog = document.querySelector<HTMLDialogElement>('#share-illustrator-dialog');
const trigger = document.querySelector<HTMLButtonElement>('.profile-share');
const input = dialog?.querySelector<HTMLInputElement>('.share-link-input');
const copyButton = dialog?.querySelector<HTMLButtonElement>('.share-copy');
const status = dialog?.querySelector<HTMLElement>('.share-status');
let previousOverflow = '';
let previousScroll = { left: 0, top: 0 };
let openedWithKeyboard = false;
let copyGeneration = 0;

trigger?.addEventListener('click', event => {
  if (!dialog || dialog.open) return;
  openedWithKeyboard = event.detail === 0;
  previousScroll = { left: window.scrollX, top: window.scrollY };
  trigger.focus({ preventScroll: true });
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  if (status) status.textContent = '';
  copyGeneration++;
  dialog.showModal();
});
function close() {
  if (!dialog?.open || dialog.dataset.closing) return;
  dialog.dataset.closing = 'true';
  setTimeout(() => { dialog.close(); delete dialog.dataset.closing; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
}
dialog?.querySelector('.suggestion-close')?.addEventListener('click', close);
dialog?.addEventListener('cancel', event => { event.preventDefault(); close(); });
dialog?.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
});
dialog?.addEventListener('close', () => {
  copyGeneration++;
  document.body.style.overflow = previousOverflow;
  trigger?.focus({ preventScroll: true });
  if (!openedWithKeyboard) trigger?.blur();
  window.scrollTo({ ...previousScroll, behavior: 'instant' });
});
input?.addEventListener('click', () => input.select());
copyButton?.addEventListener('click', async () => {
  if (!input || !status || !dialog?.open) return;
  const generation = ++copyGeneration;
  try {
    await navigator.clipboard.writeText(input.value);
    if (generation === copyGeneration && dialog.open) status.textContent = dialog.dataset.copied || '';
  } catch {
    if (generation !== copyGeneration || !dialog.open) return;
    input.focus({ preventScroll: true });
    input.select();
    status.textContent = dialog.dataset.copyFailed || '';
  }
});
