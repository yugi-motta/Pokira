import { compareCards } from './card-order';
export type ImageDetails = { id: string; name: string; number: string; setName: string; releaseDate: string | null; language: 'en'|'ja' };
export type ViewCard = {id:string;number:string;name:string;image:string|null;illustrator:string;rarity:string|null;language:'en'|'ja';setId:string;setName:string;releaseDate:string|null;matchingKey?:string|null;imageDetails?:ImageDetails};
export function visibleCatalog(primary: ViewCard[], alternate: ViewCard[]): ViewCard[] {
  const groups = new Map<string, ViewCard[]>();
  for (const card of alternate) if (card.image && card.matchingKey) groups.set(card.matchingKey, [...(groups.get(card.matchingKey)||[]), card]);
  return primary.flatMap(card => {
    if (card.image) return [card];
    let matches = alternate.filter(c => c.image && c.id === card.id && c.illustrator === card.illustrator);
    if (!matches.length && card.matchingKey) {
      matches = (groups.get(card.matchingKey)||[]).filter(c => c.illustrator === card.illustrator && card.releaseDate && c.releaseDate && Math.abs(Date.parse(card.releaseDate)-Date.parse(c.releaseDate)) <= 366*86400000);
      if (matches.length > 1) { const numbered = matches.filter(c=>Number(c.number)===Number(card.number)); if(numbered.length===1) matches=numbered; }
    }
    if(matches.length !== 1) return [];
    const match=matches[0];
    return [{...card,image:match.image,imageDetails:{id:match.id,name:match.name,number:match.number,setName:match.setName,releaseDate:match.releaseDate,language:match.language}}];
  }).sort(compareCards);
}
export function filterCards(cards: ViewCard[], query: string, setId: string, rarity: string, order: string) {
  const q=query.normalize('NFKC').toLocaleLowerCase().trim();
  const filtered=cards.filter(c=>(!q||`${c.name} ${c.imageDetails?.name||''} ${c.number}`.normalize('NFKC').toLocaleLowerCase().includes(q))&&(!setId||c.setId===setId)&&(!rarity||c.rarity===rarity));
  return filtered.sort((a,b)=>order==='oldest' ? (a.releaseDate||'9999').localeCompare(b.releaseDate||'9999')||a.number.localeCompare(b.number,'en',{numeric:true})||a.id.localeCompare(b.id) : order==='name' ? a.name.localeCompare(b.name)||compareCards(a,b) : order==='number' ? a.number.localeCompare(b.number,'en',{numeric:true})||compareCards(a,b):compareCards(a,b));
}
