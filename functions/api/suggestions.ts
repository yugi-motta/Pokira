interface Env {
  RESEND_API_KEY?: string;
  SUGGESTIONS_TO_EMAIL?: string;
  SUGGESTIONS_FROM_EMAIL?: string;
}

const result = (status: number, code: string) => new Response(JSON.stringify({ code }), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

const xLink = (value: string, post: boolean) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(post ? /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{15,20})\/?$/ : /^\/([A-Za-z0-9_]{1,15})\/?$/);
    if (!match) return null;
    return { handle: match[1].toLowerCase(), url: `https://x.com/${match[1]}${post ? `/status/${match[2]}` : ''}` };
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
  const artistUrl = read('artistUrl');
  const tweetUrl = read('tweetUrl');
  const artist = xLink(artistUrl, false);
  const tweet = xLink(tweetUrl, true);
  if (name.length > 120 || email.length > 254 || artistUrl.length > 500 || tweetUrl.length > 500 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !artist || !tweet || artist.handle !== tweet.handle) {
    return result(400, 'invalid');
  }

  const { RESEND_API_KEY: key, SUGGESTIONS_TO_EMAIL: to, SUGGESTIONS_FROM_EMAIL: from } = env;
  if (!key || !to || !from || /@[^@]+\.example$/i.test(to) || /@[^@]+\.example(?:>|$)/i.test(from)) {
    return result(503, 'unavailable');
  }

  const text = [
    `Name: ${name || 'Not provided'}`,
    `Email: ${email || 'Not provided'}`,
    `Artist X profile: ${artist.url}`,
    `Artwork announcement: ${tweet.url}`
  ].join('\n');
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `Pokira artist suggestion: @${artist.handle}`, text })
    });
    return sent.ok ? result(200, 'sent') : result(502, 'failed');
  } catch { return result(502, 'failed'); }
}
