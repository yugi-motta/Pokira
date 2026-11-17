import type { Lang } from './i18n';
import { z } from 'zod';
import type { MatchFacts } from './card-identity';
import { visibleCatalog } from './catalog-view';
import { pokemonFor } from './pokemon';
import artworkIdentities from '../data/artwork-identities.json';
import { uniqueIllustrations } from './illustrations';
import { compareCards } from './card-order';
export const catalogCardSchema = z.object({
  kind:z.enum(['physical','pocket']).optional(),pokemon:z.array(z.object({id:z.number(),name:z.string()})).optional(),
  sortReleaseDate: z.string().nullable().optional(), sortNumber: z.string().optional(), editionIds: z.array(z.string()).optional(), otherLanguageOnly: z.boolean().optional(),
  matchFacts: z.custom<MatchFacts>().optional(),
  matchingKey: z.string().nullable().optional(),
  imageDetails: z.object({id:z.string(), name:z.string(), number:z.string(), setName:z.string(),releaseDate:z.string().nullable(),language:z.enum(['en','ja'])}).optional(),
  detailsCheckedAt: z.string().optional(),
  thumbnail: z.url().optional(), fullImage: z.url().optional(), source: z.url().optional(),imageSource:z.url().optional(),
  imageWidth: z.number().optional(), imageHeight: z.number().optional(),
  id: z.string(), number: z.string(), name: z.string(),
  image: z.url().refine(url => url.startsWith('https://assets.tcgdex.net/ja/') || url.startsWith('https://assets.tcgdex.net/en/') || url.startsWith('https://www.pokemon-card.com/') || url.startsWith('https://pbs.twimg.com/') || url.startsWith('https://usgmen.com/')).nullable(),
  illustrator: z.string(), rarity: z.string().nullable(), language: z.enum(['en','ja']),
  setId: z.string(), setName: z.string(), releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
});
export type CatalogCard = z.infer<typeof catalogCardSchema>;
const snapshotSchema = z.object({ artistId: z.string(), updatedAt: z.string(), catalogs: z.object({ ja: z.array(catalogCardSchema), en: z.array(catalogCardSchema) }) });
const files = import.meta.glob('../data/tcgdex/*.json', { eager: true, import: 'default' });
const snapshots = Object.entries(files).filter(([path]) => !path.endsWith('/coverage.json')).map(([,file]) => snapshotSchema.parse(file));
export const cardIndexes = new Map(snapshots.map(index => [index.artistId, index]));
export const PAGE_SIZE = 24;
const japaneseImageSchema=z.url().refine(url=>url.startsWith('https://assets.tcgdex.net/ja/') || url.startsWith('https://www.pokemon-card.com/assets/images/card_images/') || url.startsWith('https://pbs.twimg.com/media/') || url.startsWith('https://usgmen.com/wp-content/uploads/'));
const japaneseSchema = z.object({artistId:z.string(),updatedAt:z.string(),source:z.url(),cards:z.array(z.object({
  kind:z.enum(['physical','pocket']),source:z.url(), imageSource:z.url().optional(), high:japaneseImageSchema.nullable(), thumbnail:japaneseImageSchema.nullable(),
  width:z.number(),height:z.number(),en:z.string(),ja:z.string(),number:z.string(),setName:z.string(),setJapaneseName:z.string().nullable(),setId:z.string(),releaseDate:z.string().nullable()
}))});
const japaneseFiles = import.meta.glob('../data/japanese-catalog/*.json', {eager:true,import:'default'});
const artistFiles = import.meta.glob('../data/artists/*.json',{eager:true,import:'default'}) as Record<string,{id:string;name:string}>;
const artistNames = new Map(Object.values(artistFiles).map(a=>[a.id,a.name]));
const japaneseIndexes = new Map(Object.values(japaneseFiles).map(file=>{const index=japaneseSchema.parse(file);return [index.artistId,index] as const;}));
const normalizeName=(name:string)=>name.normalize('NFKC').replace(/\s|\([^)]*\)/g,'').toLocaleLowerCase();
const normalizeNumber=(number:string)=>number.split('/')[0].replace(/^0+(?=\d)/,'').toLocaleLowerCase();
export function catalogFor(id: string, lang: Lang) {
  const index = cardIndexes.get(id);
  const japanese = japaneseIndexes.get(id);
  // Membership and pictured editions always come from the Japanese catalog.
  // Locale only changes the text; it cannot add English-only printings.
  const cards: CatalogCard[] = japanese ? japanese.cards.filter(card=>card.high && card.thumbnail).map(card=>{
    const number=card.number.split('/')[0];
    const candidates=index?.catalogs.ja.filter(c=>c.name===card.ja && Number(c.number)===Number(number) && c.releaseDate===card.releaseDate) || [];
    const details=candidates.length===1?candidates[0]:undefined;
    return {id:card.source.replace('https://www.artofpkm.com/','ja:'),number:card.number,name:lang==='en'?card.en:card.ja,
      image:card.high!,thumbnail:card.thumbnail!,fullImage:card.high!,imageWidth:card.width,imageHeight:card.height,source:card.source,imageSource:card.imageSource,
      illustrator:artistNames.get(id) || details?.illustrator || id,rarity:details?.rarity || null,
      kind:card.kind,pokemon:pokemonFor(card.en,lang),language:'ja' as const,setId:`ja:${card.setId}`,setName:lang==='ja' ? card.setJapaneseName || details?.setName || card.setName : card.setName,releaseDate:card.releaseDate};
  }).sort(compareCards) : visibleCatalog(index?.catalogs.ja || [],index?.catalogs.en || [],'ja').filter(c=>c.image?.startsWith('https://assets.tcgdex.net/ja/'));
  // Preserve older Japanese scans that the reference catalog has not digitized.
  const japaneseFallback = visibleCatalog(index?.catalogs.ja || [],index?.catalogs.en || [],'ja').filter(c=>c.image?.startsWith('https://assets.tcgdex.net/ja/'));
  const englishText = visibleCatalog(index?.catalogs.en || [],index?.catalogs.ja || [],'en');
  if(japanese) for(const card of japaneseFallback){
    const number=card.number.split('/')[0];
    const equivalents=japanese.cards.filter(c=>normalizeName(c.ja)===normalizeName(card.name) && normalizeNumber(c.number)===normalizeNumber(number) && c.releaseDate===card.releaseDate);
    if(equivalents.some(c=>c.high)) continue;
    const translation=englishText.find(c=>c.id===card.id);
    const text=equivalents[0];
    cards.push({...card,kind:card.image?.includes('/tcgp/')?'pocket':'physical',pokemon:pokemonFor(text?.en || translation?.name || card.name,lang),imageDetails:undefined,otherLanguageOnly:undefined,...(lang==='en'?{name:text?.en || translation?.name || card.name,setName:text?.setName || card.setName}:{} )});
  }
  cards.sort(compareCards);
  return {cards:uniqueIllustrations(cards,artworkIdentities.images),language:'ja',source:japanese?.source,updatedAt:japanese?.updatedAt || index?.updatedAt || '',version:`illustrations-v1:${japanese?.updatedAt || index?.updatedAt || ''}`};
}
export const cardImage = (card: CatalogCard, quality: 'low' | 'high' = 'low') => quality === 'high' ? card.fullImage || (card.image ? `${card.image}/high.webp` : '') : card.thumbnail || (card.image ? `${card.image}/low.webp` : '');
export const artistPath = (lang: Lang, id: string) => `${lang === 'en' ? '/en' : ''}/${id}/`;
