import { suggestionsInbox } from '../../src/lib/suggestions-config';

interface Env {
  RESEND_API_KEY?: string;
  SUGGESTIONS_FROM_EMAIL?: string;
}

const result = (status: number, code: string) => new Response(JSON.stringify({ code }), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

const socialLink = (value: string, post: boolean) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(host)) {
      const match = url.pathname.match(post ? /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{15,20})\/?$/ : /^\/([A-Za-z0-9_]{1,15})\/?$/);
      if (!match) return null;
      return { platform: 'X', handle: match[1].toLowerCase(), url: `https://x.com/${match[1]}${post ? `/status/${match[2]}` : ''}` };
    }
    if (['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(host)) {
      if (post) {
        const match = url.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,30})\/?$/);
        return match ? { platform: 'Instagram', handle: '', url: `https://www.instagram.com/${match[1]}/${match[2]}/` } : null;
      }
      const match = url.pathname.match(/^\/((?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30})\/?$/);
      if (!match || ['p', 'reel', 'reels', 'tv'].includes(match[1].toLowerCase())) return null;
      return { platform: 'Instagram', handle: match[1].toLowerCase(), url: `https://www.instagram.com/${match[1].toLowerCase()}/` };
    }
    return null;
  } catch { return null; }
};

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return result(403, 'invalid');
    } catch { return result(403, 'invalid'); }
  }
  if (Number(request.headers.get('Content-Length') || 0) > 16_384) return result(413, 'invalid');

  let fields: FormData;
  try { fields = await request.formData(); }
  catch { return result(400, 'invalid'); }
  const read = (key: string) => {
    const value = fields.get(key);
    return typeof value === 'string' ? value.trim() : '';
  };
  if (read('website')) return result(200, 'sent');

  const name = read('name');
  const email = read('email');
  const illustratorName = read('illustratorName');
  const postUrl = read('postUrl') || read('tweetUrl');
  const post = socialLink(postUrl, true);
  if (name.length > 120 || email.length > 254 || !illustratorName || illustratorName.length > 120 || postUrl.length > 500 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !post) {
    return result(400, 'invalid');
  }

  const { RESEND_API_KEY: key, SUGGESTIONS_FROM_EMAIL: from } = env;
  if (!key && !from) return result(200, 'forward');
  if (!key || !from || /@[^@]+\.example(?:>|$)/i.test(from)) {
    return result(503, 'unavailable');
  }

  const text = [
    `Name: ${name || 'Not provided'}`,
    `Email: ${email || 'Not provided'}`,
    `Illustrator name: ${illustratorName}`,
    `Artwork ${post.platform} post: ${post.url}`
  ].join('\n');
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [suggestionsInbox], subject: `Pokira illustrator suggestion: ${illustratorName.replace(/[\r\n]/g, " ")}`, text })
    });
    return sent.ok ? result(200, 'sent') : result(502, 'failed');
  } catch { return result(502, 'failed'); }
}
