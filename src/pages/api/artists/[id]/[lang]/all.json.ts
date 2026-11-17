import { artists } from '../../../../../lib/content';
import { catalogFor } from '../../../../../lib/cards';
import type { CatalogCard } from '../../../../../lib/cards';
export function getStaticPaths() {
  return artists.flatMap(artist => (['en','ja'] as const).map(lang => {
    const { cards, updatedAt } = catalogFor(artist.id, lang);
    return { params: { id: artist.id, lang }, props: { cards, version: updatedAt } };
  }));
}
export function GET({ props }: { props: {cards:CatalogCard[];version:string} }) {
  return new Response(JSON.stringify(props),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
