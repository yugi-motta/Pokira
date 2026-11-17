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
type EdgeField={x:Float32Array;y:Float32Array;length:Float32Array};
const edgeCache=new WeakMap<Fingerprint,EdgeField>();
function edges(sample:Fingerprint):EdgeField{
 const existing=edgeCache.get(sample);if(existing)return existing;
 const gray=new Float32Array(1024);for(let i=0;i<1024;i++)gray[i]=sample.pixels[i*3]*.2126+sample.pixels[i*3+1]*.7152+sample.pixels[i*3+2]*.0722;
 const x=new Float32Array(1024),y=new Float32Array(1024),length=new Float32Array(1024);
 for(let row=1;row<31;row++)for(let col=1;col<31;col++){const i=row*32+col;x[i]=gray[i+1]-gray[i-1];y[i]=gray[i+32]-gray[i-32];length[i]=Math.hypot(x[i],y[i]);}
 const field={x,y,length};edgeCache.set(sample,field);return field;
}
function sameEdges(a:Fingerprint,b:Fingerprint){
 // Broad foil/rainbow lighting changes colors, but preserves illustration edges.
 const aa=edges(a),bb=edges(b);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  let dot=0,va=0,vb=0,matched=0,total=0;
  for(let y=4;y<28;y++)for(let x=4;x<28;x++){
   const i=y*32+x,j=(y+dy)*32+x+dx,am=aa.length[i],bm=bb.length[j];
   const product=aa.x[i]*bb.x[j]+aa.y[i]*bb.y[j];dot+=product;va+=am*am;vb+=bm*bm;
   const strongest=Math.max(am,bm);if(strongest<18)continue;total+=strongest;
   if(Math.min(am,bm)>10 && product/Math.max(1,am*bm)>.9 && Math.min(am,bm)/strongest>.35)matched+=strongest;
  }
  if(total>0 && matched/total>=.84 && dot/Math.max(1,Math.sqrt(va*vb))>=.935)return true;
 }
 return false;
}
function same(a:Fingerprint,b:Fingerprint){
 let distance=0;for(let i=0;i<a.hash.length;i++){let bits=parseInt(a.hash[i],16)^parseInt(b.hash[i],16);while(bits){distance++;bits&=bits-1;}if(distance>40)return false;}
 if(distance<=6){
  let total=0;const tiles=Array(16).fill(0);
  for(let i=0;i<a.pixels.length;i++){const delta=Math.abs(a.pixels[i]-b.pixels[i]);total+=delta;const pixel=Math.floor(i/3);tiles[Math.floor(Math.floor(pixel/32)/8)*4+Math.floor(pixel%32/8)]+=delta;}
  if(total/a.pixels.length<=4 && tiles.every(error=>error/(8*8*3)<=8))return true;
 }
 return sameEdges(a,b);
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
await writeFile('src/data/artwork-identities.json',JSON.stringify({version:2,images:identities},null,2)+'\n');console.log(`Indexed ${unique.length} images; ${merges} additional artwork matches.`);
