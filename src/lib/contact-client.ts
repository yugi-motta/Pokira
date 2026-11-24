import { contactTopics, readContactFields, validateContact, type ContactTopic } from './contact';
const dialog = document.querySelector<HTMLDialogElement>('#contact-dialog');
const trigger = document.querySelector<HTMLButtonElement>('.contact-trigger');
const form = document.querySelector<HTMLFormElement>('#contact-form');
const topic = form?.querySelector<HTMLSelectElement>('[name="topic"]');
const profile = form?.querySelector<HTMLInputElement>('[name="profileUrl"]');
const profileField = form?.querySelector<HTMLElement>('.contact-profile-field');
const profileOptional = form?.querySelector<HTMLElement>('.contact-profile-optional');
const removalNote = form?.querySelector<HTMLElement>('.contact-removal-note');
const status = form?.querySelector<HTMLElement>('#contact-status');
const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
let previousOverflow = '';
let previousScroll = { left: 0, top: 0 };
let openedWithKeyboard = false;
let announceOnClose = false;
let sending = false;
const announceSuccess = () => document.dispatchEvent(new Event('pokira:contact-sent'));
function syncTopic() {
  const showProfile = topic?.value === 'correction' || topic?.value === 'removal';
  const removal = topic?.value === 'removal';
  if (profileField) profileField.hidden = !showProfile;
  if (profileOptional) profileOptional.hidden = removal;
  if (profile) { profile.disabled = !showProfile; profile.required = removal; profile.setCustomValidity(''); }
  if (removalNote) removalNote.hidden = !removal;
}
topic?.addEventListener('change', syncTopic);
syncTopic();
trigger?.addEventListener('click', event => {
  if (!dialog || dialog.open) return;
  openedWithKeyboard = event.detail === 0;
  previousScroll = { left: window.scrollX, top: window.scrollY };
  document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus({ preventScroll: true });
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
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
  document.body.style.overflow = previousOverflow;
  const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
  menu?.focus({ preventScroll: true });
  if (!openedWithKeyboard) menu?.blur();
  window.scrollTo({ ...previousScroll, behavior: 'instant' });
  if (announceOnClose) { announceOnClose = false; announceSuccess(); }
});
form?.addEventListener('input', event => { const field = event.target; if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.setCustomValidity(''); });
form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!button || !status || sending) return;
  status.textContent = '';
  const fields = new FormData(form);
  const data = readContactFields(fields);
  const invalid = validateContact(data);
  if (invalid) {
    form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${invalid}"]`)?.setCustomValidity(invalid === 'profileUrl' ? form.dataset.invalidProfile || '' : form.dataset.invalid || '');
    form.reportValidity();
    return;
  }
  if (!form.reportValidity()) return;
  sending = true;
  button.disabled = true;
  status.textContent = form.dataset.sending || '';
  const controls = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')];
  controls.forEach(field => { field.disabled = true; });
  try {
    let response = await fetch(form.action, { method: 'POST', body: fields, headers: { Accept: 'application/json' } });
    let result: { code?: string } = await response.json();
    if (((response.ok && result.code === 'forward') || (response.status === 503 && result.code === 'unavailable')) && form.dataset.fallback) {
      fields.set('_honey', String(fields.get('website') || '')); fields.delete('website');
      fields.set('_subject', `Pokira contact: ${contactTopics[data.topic as ContactTopic]}`);
      fields.set('_template', 'table'); fields.set('_captcha', 'false');
      fields.set('_url', `${location.origin}${location.pathname}`);
      fields.set('topic', contactTopics[data.topic as ContactTopic]);
      response = await fetch(form.dataset.fallback, { method: 'POST', body: fields, headers: { Accept: 'application/json' } });
      const delivered: { success?: boolean | string; message?: string } = await response.json();
      const activation = /activat|confirm.*email|verify.*email/i.test(delivered.message || '');
      result = { code: activation ? 'unavailable' : response.ok && (delivered.success === true || delivered.success === 'true') ? 'sent' : 'failed' };
    }
    if (response.ok && result.code === 'sent') {
      status.textContent = '';
      form.reset();
      if (dialog?.open) { announceOnClose = true; close(); } else announceSuccess();
    } else {
      status.textContent = result.code === 'unavailable' ? form.dataset.unavailable || '' : form.dataset.failed || '';
    }
  } catch {
    status.textContent = form.dataset.failed || '';
  } finally {
    sending = false;
    button.disabled = false;
    controls.forEach(field => { field.disabled = false; });
    syncTopic();
  }
});
