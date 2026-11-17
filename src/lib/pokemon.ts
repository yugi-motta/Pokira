import species from '../data/pokemon-species.json';
import type { Lang } from './i18n';
// Names are from PokéAPI's pokemon_species_names.csv (Japanese / English).
const normalize=(value:string)=>value.normalize('NFKC').replaceAll('’',"'");
const patterns=species.map(p=>({...p,pattern:new RegExp(`(?:^|[^a-z])${normalize(p.en).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^a-z])`,'i')}));
const matches=new Map<string,typeof patterns>();
export function pokemonFor(englishName:string,lang:Lang){
 const name=normalize(englishName);
 let found=matches.get(name);
 if(!found){found=patterns.filter(p=>p.pattern.test(name));matches.set(name,found);}
 return found.map(p=>({id:p.id,name:p[lang]}));
}
