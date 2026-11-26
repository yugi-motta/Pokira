import type { Lang } from './i18n';
import { z } from 'zod';
import type { MatchFacts } from './card-identity';
import { pokemonFor } from './pokemon';
import artworkIdentities from '../data/artwork-identities.json';
import previewRarities from '../data/preview-rarities.json';
import previewSelections from '../data/preview-selections.json';
import { isOfficialCardImage, PREVIEW_LIMIT, selectPreview, type PreviewSelection } from './card-preview';
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
  image: z.url().refine(url => url.startsWith('https://pokira.pages.dev/images/cards/ja/') || url.startsWith('https://assets.tcgdex.net/ja/') || url.startsWith('https://assets.tcgdex.net/en/') || url.startsWith('https://www.pokemon-card.com/') || url.startsWith('https://pbs.twimg.com/') || url.startsWith('https://usgmen.com/')).nullable(),
  illustrator: z.string(), rarity: z.string().nullable(), language: z.enum(['en','ja']),
  setId: z.string(), setName: z.string(), releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
});
export type CatalogCard = z.infer<typeof catalogCardSchema>;
const snapshotSchema = z.object({ artistId: z.string(), updatedAt: z.string(), catalogs: z.object({ ja: z.array(catalogCardSchema), en: z.array(catalogCardSchema) }) });
const files = import.meta.glob('../data/tcgdex/*.json', { eager: true, import: 'default' });
const snapshots = Object.entries(files).filter(([path]) => !path.endsWith('/coverage.json')).map(([,file]) => snapshotSchema.parse(file));
export const cardIndexes = new Map(snapshots.map(index => [index.artistId, index]));
export const PAGE_SIZE = PREVIEW_LIMIT;
const japaneseImageSchema=z.url().refine(url=>url.startsWith('https://pokira.pages.dev/images/cards/ja/') || url.startsWith('https://assets.tcgdex.net/ja/') || url.startsWith('https://www.pokemon-card.com/assets/images/card_images/') || url.startsWith('https://pbs.twimg.com/media/') || url.startsWith('https://usgmen.com/wp-content/uploads/'));
const japaneseSchema = z.object({artistId:z.string(),updatedAt:z.string(),source:z.url(),cards:z.array(z.object({
  kind:z.enum(['physical','pocket']),source:z.url(), imageSource:z.url().optional(), high:japaneseImageSchema.nullable(), thumbnail:japaneseImageSchema.nullable(),
  width:z.number(),height:z.number(),en:z.string(),ja:z.string(),number:z.string(),setName:z.string(),setJapaneseName:z.string().nullable(),setId:z.string(),releaseDate:z.string().nullable()
}))});
const japaneseFiles = import.meta.glob('../data/japanese-catalog/*.json', {eager:true,import:'default'});
const artistFiles = import.meta.glob('../data/artists/*.json',{eager:true,import:'default'}) as Record<string,{id:string;name:string}>;
const artistNames = new Map(Object.values(artistFiles).map(a=>[a.id,a.name]));
const japaneseIndexes = new Map(Object.values(japaneseFiles).map(file=>{const index=japaneseSchema.parse(file);return [index.artistId,index] as const;}));
export function catalogFor(id: string, lang: Lang) {
  const index=cardIndexes.get(id);
  const japanese=japaneseIndexes.get(id);
  const rarityIndex=previewRarities as Record<string,{rarity:string|null;source:string|null}>;
  const eligible:CatalogCard[]=(japanese?.cards||[]).filter(card=>isOfficialCardImage(card.high)).map<CatalogCard>(card=>{
    const number=card.number.split('/')[0];
    const matches=index?.catalogs.ja.filter(c=>c.name===card.ja && Number(c.number)===Number(number) && c.releaseDate===card.releaseDate)||[];
    const details=matches.length===1?matches[0]:undefined;
    const high=card.high!;
    const knownRarity=rarityIndex[high];
    const rarity=knownRarity?.source?.startsWith('https://www.pokemon-card.com/')?knownRarity.rarity:knownRarity?.rarity??details?.rarity??null;
    return {id:card.source.replace('https://www.artofpkm.com/','ja:'),number:card.number,
      name:lang==='en'?card.en:card.ja,image:high,thumbnail:high,fullImage:high,
      imageWidth:card.width,imageHeight:card.height,source:card.source,imageSource:card.imageSource,
      illustrator:artistNames.get(id)||id,rarity,
      kind:'physical',pokemon:pokemonFor(card.en,lang),language:'ja',
      setId:`ja:${card.setId}`,setName:lang==='ja'?card.setJapaneseName||details?.setName||card.setName:card.setName,
      releaseDate:card.releaseDate};
  });
  return {cards:selectPreview(eligible,artworkIdentities.images,(previewSelections as Record<string,PreviewSelection>)[id]),language:'ja',
    source:japanese?.source||`https://www.artofpkm.com/illustrators/${id}`,
    updatedAt:japanese?.updatedAt||'',version:`previews-v2:${japanese?.updatedAt||''}`};
}
export const cardImage = (card: CatalogCard, quality: 'low' | 'high' = 'low') => quality === 'high' ? card.fullImage || (card.image ? `${card.image}/high.webp` : '') : card.thumbnail || (card.image ? `${card.image}/low.webp` : '');
export const artistPath = (lang: Lang, id: string) => `${lang === 'en' ? '/en' : ''}/${id}/`;
