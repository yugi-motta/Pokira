// Analyze remote illustration pixels in memory; publish only identity metadata.
// Never infer shared artwork from Pokémon name, card number or rarity alone.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import sharp from 'sharp';
import {pokemonFor} from '../src/lib/pokemon';
const cachePath='.cache/artwork-fingerprints-v1.json';await mkdir('.cache',{recursive:true});
type Fingerprint={hash:string;pixels:number[]};
const cache:Record<string,Fingerprint>=await readFile(cachePath,'utf8').then(JSON.parse).catch(()=>({}));
const input:{artist:string;image:string;thumbnail:string;name:string}[]=[];
for(const file of await readdir('src/data/japanese-catalog')){
 const source=JSON.parse(await readFile(`src/data/japanese-catalog/${file}`,'utf8'));
 for(const card of source.cards)if(card.high)input.push({artist:source.artistId,image:card.high,thumbnail:card.thumbnail,name:card.en});
}
const unique=[...new Map(input.map(c=>[c.image,c])).values()];let cursor=0,done=0;
async function fingerprint(url:string):Promise<Fingerprint>{
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`${response.status}: ${url}`);
 const buffer=Buffer.from(await response.arrayBuffer());const metadata=await sharp(buffer).metadata();
 if(!metadata.width||!metadata.height)throw new Error('Invalid image');
 const crop={left:Math.round(metadata.width*.08),top:Math.round(metadata.height*.18),width:Math.round(metadata.width*.84),height:Math.round(metadata.height*.36)};
 const pixels=[...await sharp(buffer).extract(crop).removeAlpha().toColourspace('srgb').resize(32,32,{fit:'fill'}).raw().toBuffer()];
 const gray=await sharp(buffer).extract(crop).resize(17,16,{fit:'fill'}).greyscale().raw().toBuffer();let hash='';
 for(let y=0;y<16;y++)for(let x=0;x<16;x+=4){let nibble=0;for(let b=0;b<4;b++)nibble=(nibble<<1)|Number(gray[y*17+x+b]>gray[y*17+x+b+1]);hash+=nibble.toString(16);}
 return {hash,pixels};
}
async function worker(){while(cursor<unique.length){const card=unique[cursor++];if(!cache[card.image]){
 try{cache[card.image]=await fingerprint(card.thumbnail);}catch(error){console.warn('Kept unmerged:',String(error));}
 await new Promise(resolve=>setTimeout(resolve,220));
 }done++;if(done%100===0){console.log(`${done}/${unique.length} illustration images checked`);await writeFile(cachePath,JSON.stringify(cache));}}}
await Promise.all([worker(),worker()]);await writeFile(cachePath,JSON.stringify(cache));
function same(a:Fingerprint,b:Fingerprint){
 let distance=0;for(let i=0;i<a.hash.length;i++){let bits=parseInt(a.hash[i],16)^parseInt(b.hash[i],16);while(bits){distance++;bits&=bits-1;}if(distance>6)return false;}
 let total=0;const tiles=Array(16).fill(0);
 for(let i=0;i<a.pixels.length;i++){const delta=Math.abs(a.pixels[i]-b.pixels[i]);total+=delta;const pixel=Math.floor(i/3);tiles[Math.floor(Math.floor(pixel/32)/8)*4+Math.floor(pixel%32/8)]+=delta;}
 return total/a.pixels.length<=4 && tiles.every(error=>error/(8*8*3)<=8);
}
const previous:Record<string,string>=await readFile('src/data/artwork-identities.json','utf8').then(text=>JSON.parse(text).images).catch(()=>({}));
const identities:Record<string,string>={};const groups=new Map<string,{image:string;fingerprint:Fingerprint}[]>();let merges=0;
for(const card of input){
 if(identities[card.image])continue;
 const key=`${card.artist}:${pokemonFor(card.name,'en').map(p=>p.id).join(',') || card.name}`;
 const candidates=groups.get(key)||[];const sample=cache[card.image];
 const found=sample && candidates.find(c=>same(sample,c.fingerprint));
 if(found){identities[card.image]=found.image;merges++;}
 else{identities[card.image]=!sample && previous[card.image] ? previous[card.image] : card.image;if(sample)candidates.push({image:card.image,fingerprint:sample});groups.set(key,candidates);}
}
for(const image of Object.keys(identities)){let key=identities[image];const seen=new Set<string>([image]);while(identities[key]&&identities[key]!==key&&!seen.has(key)){seen.add(key);key=identities[key];}identities[image]=key;}
await writeFile('src/data/artwork-identities.json',JSON.stringify({version:1,images:identities},null,2)+'\n');console.log(`Indexed ${unique.length} images; ${merges} additional artwork matches.`);
