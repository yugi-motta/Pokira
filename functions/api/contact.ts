import { suggestionsInbox } from '../../src/lib/suggestions-config';
import { contactTopics, readContactFields, validateContact, type ContactTopic } from '../../src/lib/contact';
interface Env { RESEND_API_KEY?: string; SUGGESTIONS_FROM_EMAIL?: string; }
const result = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const origin = request.headers.get('Origin');
  if (origin) {
    try { if (new URL(origin).host !== new URL(request.url).host) return result(403, 'invalid'); }
    catch { return result(403, 'invalid'); }
  }
  if (Number(request.headers.get('Content-Length') || 0) > 32_768) return result(413, 'invalid');
  let form: FormData;
  try { form = await request.formData(); } catch { return result(400, 'invalid'); }
  if (form.get('website')) return result(200, 'sent');
  const fields = readContactFields(form);
  if (validateContact(fields)) return result(400, 'invalid');
  const { RESEND_API_KEY: key, SUGGESTIONS_FROM_EMAIL: from } = env;
  if (!key && !from) return result(200, 'forward');
  if (!key || !from || /@[^@]+\.example(?:>|$)/i.test(from)) return result(503, 'unavailable');
  const topic = contactTopics[fields.topic as ContactTopic];
  const text = [`Contact type: ${topic}`, `Name: ${fields.name || 'Not provided'}`, `Email: ${fields.email}`, `Pokira profile: ${fields.profileUrl || 'Not provided'}`, '', fields.message].join('\n');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [suggestionsInbox], reply_to: fields.email, subject: `Pokira contact: ${topic}`, text })
    });
    return response.ok ? result(200, 'sent') : result(502, 'failed');
  } catch { return result(502, 'failed'); }
}
