import { compareCards } from './card-order';

export const PREVIEW_LIMIT=15;
// Editorial rarity tiers, not cross-expansion pull-rate estimates.
const tiers:Record<string,number>={MUR:120,BWR:115,UR:110,SAR:100,HR:95,CSR:90,SSR:85,SR:80,AR:70,CHR:65,S:60,RRR:50,RR:40,R:30,U:20,C:10};
export function rarityRank(rarity:string|null|undefined){
 if(!rarity)return 0;
 const value=rarity.trim().toLowerCase();
 const code=rarity.match(/\(([A-Z]{1,3})\)/)?.[1]||rarity.toUpperCase();
 if(tiers[code])return tiers[code];
 const aliases:Record<string,string>={
  'mega ultra rare':'MUR','black white rare':'BWR','ultra rare':'UR','hyper rare':'HR',
  'special illustration rare':'SAR','special art rare':'SAR','character super rare':'CSR',
  'shiny ultra rare':'SSR','shiny super rare':'SSR','super rare':'SR','secret rare':'SR',
  'illustration rare':'AR','art rare':'AR','character rare':'CHR','shiny rare':'S',
  'triple rare':'RRR','double rare':'RR','rare':'R','holo rare':'R','rare holo':'R',
  'uncommon':'U','common':'C'};
 return tiers[aliases[value]]||0;
}
export function isOfficialCardImage(value:string|null|undefined){
 if(!value)return false;
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.pokemon-card.com'&&!url.username&&!url.password&&!url.port&&url.pathname.startsWith('/assets/images/card_images/large/');}catch{return false;}
}
type PreviewCard={id:string;number:string;releaseDate:string|null;rarity:string|null;image:string|null;fullImage?:string};
// Official Japanese image filenames identify Trainer cards with the _T_ marker.
// Names alone are unreliable: some Trainers include a Pokémon's name.
export function isTrainerCard(card:Pick<PreviewCard,'image'|'fullImage'>){
 const image=card.fullImage||card.image;
 return Boolean(image&&isOfficialCardImage(image)&&/\/\d+_T_/.test(new URL(image).pathname));
}
export type PreviewSelection={featured?:string[];excluded?:string[];rarities?:string[]};
export function selectPreview<T extends PreviewCard>(cards:T[],identities:Record<string,string>={},selection:PreviewSelection={}){
 const seen=new Set<string>();
 const allowedRarities=selection.rarities?new Set(selection.rarities.map(rarityRank)):null;
 const excluded=new Set((selection.excluded||[]).map(image=>identities[image]||image));
 const featured=new Map((selection.featured||[]).map((image,index)=>[image,index]));
 const priority=(card:T)=>featured.get(card.fullImage||card.image||'')??Number.MAX_SAFE_INTEGER;
 return cards.filter(c=>(!allowedRarities||allowedRarities.has(rarityRank(c.rarity)))&&isOfficialCardImage(c.fullImage||c.image)&&!excluded.has(identities[c.fullImage||c.image!]||c.fullImage||c.image!))
  .sort((a,b)=>priority(a)-priority(b)||Number(isTrainerCard(a))-Number(isTrainerCard(b))||rarityRank(b.rarity)-rarityRank(a.rarity)||compareCards(a,b))
  .filter(card=>{const image=card.fullImage||card.image!;const key=identities[image]||image;if(seen.has(key))return false;seen.add(key);return true;})
  .slice(0,PREVIEW_LIMIT);
}
