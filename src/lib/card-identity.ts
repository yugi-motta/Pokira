import translations from '../data/card-translations.json';
export type MatchFacts={version:1;category:string;name:string|null;dex:number[];hp:number|null;types:string[];stage:string;suffix:string;rarity:string|null;regulation:string|null;retreat:number|null;attacks:{cost:string[];damage:string}[]};
const normalize=(value:unknown)=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s’']/g,'');
export function matchFacts(card:any,language:string):MatchFacts {
  const translated=language==='en'?card.name:(translations as Record<string,string>)[card.name];
  return {version:1,category:normalize(card.category),name:translated?normalize(translated):null,dex:[...(card.dexId||[])].sort((a,b)=>a-b),hp:card.hp??null,
    types:(card.types||[]).map(normalize).sort(),stage:normalize(card.stage),suffix:normalize(card.suffix||String(card.name||'').match(/(?:vmax|vstar|gx|ex|v)$/i)?.[0]),
    rarity:card.rarity&&normalize(card.rarity)!=='none'?normalize(card.rarity):null,regulation:card.regulationMark?normalize(card.regulationMark):null,
    retreat:card.retreat??null,attacks:(card.attacks||[]).map((a:any)=>({cost:(a.cost||[]).map(normalize).sort(),damage:normalize(a.damage).replace(/[x*]/g,'×')}))};
}
export function compatibleFacts(a:MatchFacts,b:MatchFacts):boolean {
  if(a.category!==b.category)return false;
  if(a.rarity&&b.rarity&&a.rarity!==b.rarity)return false;
  if(a.regulation&&b.regulation&&a.regulation!==b.regulation)return false;
  if(a.category!=='pokemon')return Boolean(a.name&&a.name===b.name);
  if(a.dex.length&&b.dex.length&&JSON.stringify(a.dex)!==JSON.stringify(b.dex))return false;
  if(a.name&&b.name&&a.name!==b.name)return false;
  if(a.hp!==null&&b.hp!==null&&a.hp!==b.hp)return false;
  if(a.stage&&b.stage&&a.stage!==b.stage)return false;
  if(a.suffix!==b.suffix)return false;
  if(a.types.length&&b.types.length&&JSON.stringify(a.types)!==JSON.stringify(b.types))return false;
  if(a.retreat!==null&&b.retreat!==null&&a.retreat!==b.retreat)return false;
  if(!a.attacks.length||JSON.stringify(a.attacks)!==JSON.stringify(b.attacks))return false;
  const knownIdentity=(a.dex.length&&b.dex.length)||(a.name&&b.name);
  return Boolean(knownIdentity||(a.attacks.length>=2&&a.attacks.some(attack=>/[1-9]/.test(attack.damage))));
}
