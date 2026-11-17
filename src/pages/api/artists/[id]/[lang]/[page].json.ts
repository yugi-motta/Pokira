import { artists } from '../../../../../lib/content';
import { catalogFor, PAGE_SIZE } from '../../../../../lib/cards';
import type { CatalogCard } from '../../../../../lib/cards';
export function getStaticPaths() {
  return artists.flatMap(artist => (['en','ja'] as const).flatMap(lang => {
    const { cards, updatedAt } = catalogFor(artist.id, lang);
    return Array.from({ length: Math.ceil(cards.length / PAGE_SIZE) }, (_, i) => ({
      params: { id: artist.id, lang, page: String(i + 1) },
      props: { version: updatedAt, cards: cards.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE), more: (i + 1) * PAGE_SIZE < cards.length }
    }));
  }));
}
export function GET({ props }: { props: { version: string; cards: CatalogCard[]; more: boolean } }) {
  return new Response(JSON.stringify(props), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } });
}
