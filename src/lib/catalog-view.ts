import { compatibleFacts, type MatchFacts } from './card-identity';
import { compareCards, cardDate } from './card-order';
export type ImageDetails = { id: string; name: string; number: string; setName: string; releaseDate: string | null; language: 'en'|'ja' };
export type ViewCard = {kind?:'physical'|'pocket';pokemon?:{id:number;name:string}[];id:string;number:string;name:string;image:string|null;illustrator:string;rarity:string|null;language:'en'|'ja';setId:string;setName:string;releaseDate:string|null;matchingKey?:string|null;matchFacts?:MatchFacts;imageDetails?:ImageDetails;sortReleaseDate?:string|null;sortNumber?:string;editionIds?:string[];otherLanguageOnly?:boolean};
function counterparts(card: ViewCard, candidates: ViewCard[]): ViewCard[] {
  let matches=candidates.filter(c=>c.id===card.id&&c.illustrator===card.illustrator);
  if(!matches.length&&(card.matchingKey||card.matchFacts)){
    matches=candidates.filter(c=>((c.matchingKey===card.matchingKey&&Boolean(card.matchingKey))||(card.matchFacts&&c.matchFacts&&compatibleFacts(card.matchFacts,c.matchFacts)))&&c.illustrator===card.illustrator&&card.releaseDate&&c.releaseDate&&Math.abs(Date.parse(card.releaseDate)-Date.parse(c.releaseDate))<=366*86400000);
    if(matches.length>1){const numbered=matches.filter(c=>Number(c.number)===Number(card.number));if(numbered.length===1)matches=numbered;}
  }
  return matches;
}
// Build one deterministic union first, then localize its presentation. Language cannot change membership.
export function visibleCatalog(primary: ViewCard[], alternate: ViewCard[], requested?: 'en'|'ja'): ViewCard[] {
  const lang=requested||primary[0]?.language||(alternate[0]?.language==='en'?'ja':'en');
  const en=lang==='en'?primary:alternate, ja=lang==='ja'?primary:alternate;
  const used=new Set<string>();
  const groups: {en?:ViewCard;ja?:ViewCard}[]=[];
  for(const english of en){
    const matches=counterparts(english,ja);
    const japanese=matches.length===1&&counterparts(matches[0],en).length===1&&!used.has(matches[0].id)?matches[0]:undefined;
    if(japanese)used.add(japanese.id);
    groups.push({en:english,ja:japanese});
  }
  for(const japanese of ja)if(!used.has(japanese.id))groups.push({ja:japanese});
  return groups.flatMap(group=>{
    const canonical=group.en||group.ja!;
    const preferred=group[lang];
    const other=group[lang==='en'?'ja':'en'];
    const pictured=preferred?.image?preferred:other?.image?other:undefined;
    if(!pictured)return [];
    const localized=preferred||pictured;
    const {matchingKey:_key,matchFacts:_facts,...presentation}=localized;
    return [{...presentation,id:`${group.en?'en':'ja'}:${canonical.id}`,setId:canonical.setId,
      sortReleaseDate:canonical.releaseDate,sortNumber:canonical.number,
      editionIds:[group.en&&`en:${group.en.id}`,group.ja&&`ja:${group.ja.id}`].filter(Boolean) as string[],
      image:pictured.image,otherLanguageOnly:!preferred?.image,
      ...(pictured.language!==lang?{imageDetails:{id:pictured.id,name:pictured.name,number:pictured.number,setName:pictured.setName,releaseDate:pictured.releaseDate,language:pictured.language}}:{})
    }];
  }).sort(compareCards);
}
export function filterCards(cards: ViewCard[], query: string, setId: string, rarity: string, order: string, options:{pokemonId?:string;hidePocket?:boolean;hideTCG?:boolean;locale?:string}={}) {
  const q=query.normalize('NFKC').toLocaleLowerCase().trim();
  const filtered=cards.filter(c=>(!q||`${c.name} ${c.imageDetails?.name||''} ${c.number}`.normalize('NFKC').toLocaleLowerCase().includes(q))&&(!setId||c.setId===setId)&&(!rarity||c.rarity===rarity)&&(!options.pokemonId||c.pokemon?.some(p=>String(p.id)===options.pokemonId))&&(!options.hidePocket||c.kind!=='pocket')&&(!options.hideTCG||c.kind==='pocket'));
  return filtered.sort((a,b)=>order==='pokemon' ? Number(!a.pokemon?.length)-Number(!b.pokemon?.length)||(a.pokemon?.map(p=>p.name).join(' / ')||'').localeCompare(b.pokemon?.map(p=>p.name).join(' / ')||'',options.locale)||compareCards(a,b) : order==='oldest' ? (cardDate(a)||'9999').localeCompare(cardDate(b)||'9999')||a.number.localeCompare(b.number,'en',{numeric:true})||a.id.localeCompare(b.id) : order==='name' ? a.name.localeCompare(b.name)||compareCards(a,b) : order==='number' ? a.number.localeCompare(b.number,'en',{numeric:true})||compareCards(a,b):compareCards(a,b));
}
