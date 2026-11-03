import { artists } from '../lib/content';
import { pathFor } from '../lib/i18n';
export function GET({ site }: { site: URL }) {
  const paths = [pathFor('ja'), pathFor('en'), ...artists.flatMap((artist) => [pathFor('ja', artist.id), pathFor('en', artist.id)])];
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${new URL(path, site)}</loc></url>`).join('')}</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
