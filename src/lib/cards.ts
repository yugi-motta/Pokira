import type { Lang } from './i18n';
import { z } from 'zod';
import { visibleCatalog } from './catalog-view';
export const catalogCardSchema = z.object({
  sortReleaseDate: z.string().nullable().optional(), sortNumber: z.string().optional(), editionIds: z.array(z.string()).optional(), otherLanguageOnly: z.boolean().optional(),
  matchingKey: z.string().nullable().optional(),
  imageDetails: z.object({id:z.string(), name:z.string(), number:z.string(), setName:z.string(),releaseDate:z.string().nullable(),language:z.enum(['en','ja'])}).optional(),
  detailsCheckedAt: z.string().optional(),
  id: z.string(), number: z.string(), name: z.string(),
  image: z.string().startsWith('https://assets.tcgdex.net/').nullable(),
  illustrator: z.string(), rarity: z.string().nullable(), language: z.enum(['en','ja']),
  setId: z.string(), setName: z.string(), releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
});
export type CatalogCard = z.infer<typeof catalogCardSchema>;
const snapshotSchema = z.object({ artistId: z.string(), updatedAt: z.string(), catalogs: z.object({ ja: z.array(catalogCardSchema), en: z.array(catalogCardSchema) }) });
const files = import.meta.glob('../data/tcgdex/*.json', { eager: true, import: 'default' });
const snapshots = Object.entries(files).filter(([path]) => !path.endsWith('/coverage.json')).map(([,file]) => snapshotSchema.parse(file));
export const cardIndexes = new Map(snapshots.map(index => [index.artistId, index]));
export const PAGE_SIZE = 24;
export function catalogFor(id: string, lang: Lang) {
  const index = cardIndexes.get(id);
  return { cards: visibleCatalog(index?.catalogs[lang] || [], index?.catalogs[lang === 'ja' ? 'en' : 'ja'] || [], lang), language:lang, updatedAt: index?.updatedAt || '', version:`shared-v1:${index?.updatedAt || ''}` };
}
export const cardImage = (card: CatalogCard, quality: 'low' | 'high' = 'low') => card.image ? `${card.image}/${quality}.webp` : '';
export const artistPath = (lang: Lang, id: string) => `${lang === 'en' ? '/en' : ''}/${id}/`;
