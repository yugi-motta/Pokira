import test from 'node:test';
import {uniqueIllustrations} from '../src/lib/illustrations';
const artworkIdentities:Record<string,string>=JSON.parse(readFileSync('src/data/artwork-identities.json','utf8')).images;
import type {CatalogCard} from '../src/lib/cards';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { compareCards } from '../src/lib/card-order';
import { visibleCatalog, filterCards } from '../src/lib/catalog-view';
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const snapshots = readdirSync('src/data/artists').filter(f=>f.endsWith('.json')).map(file=>({artist:JSON.parse(readFileSync(`src/data/artists/${file}`,'utf8')), index:JSON.parse(readFileSync(`src/data/tcgdex/${file}`,'utf8'))}));
test('release dates take priority over card identifiers, with stable numeric and ID ties',()=>{
  const input=[{id:'new-2b',number:'2',releaseDate:'2025-01-01'},{id:'old-999',number:'999',releaseDate:'2020-01-01'},{id:'new-10',number:'10',releaseDate:'2025-01-01'},{id:'new-2a',number:'2',releaseDate:'2025-01-01'},{id:'undated',number:'1',releaseDate:null}];
  assert.deepEqual(input.sort(compareCards).map(x=>x.id),['new-2a','new-2b','new-10','old-999','undated']);
});
test('every listed illustrator has both complete sorted language snapshots with exact credits',()=>{
  for(const {artist,index} of snapshots){assert.equal(index.artistId,artist.id);for(const lang of ['ja','en']){
    const cards=index.catalogs[lang];assert.ok(Array.isArray(cards));assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
    const credits=[artist.name,...(artist.tcgdexAliases||[])].map(normalize);
    for(const c of cards){assert.ok(credits.includes(normalize(c.illustrator)),`${artist.id}: ${c.illustrator}`);assert.equal(c.language,lang);if(c.image)assert.ok(c.image.startsWith(`https://assets.tcgdex.net/${lang}/`));if(c.releaseDate)assert.match(c.releaseDate,/^\d{4}-\d{2}-\d{2}$/);}
    assert.deepEqual(cards,[...cards].sort(compareCards));
  }}
});
function builtCards(id:string,lang:string):CatalogCard[]{return JSON.parse(readFileSync(`dist/api/artists/${id}/${lang}/all.json`,'utf8')).cards;}
test('home previews use Japanese thumbnails and profile links without a viewer',()=>{
 for(const lang of ['en','ja']){
  const html=readFileSync(`dist/${lang==='en'?'en/':''}index.html`,'utf8');assert.ok(!html.includes('class="card-viewer"'));
  for(const {artist} of snapshots){const expected=builtCards(artist.id,lang).slice(0,6);const article=html.split(`id="${artist.id}"`)[1].split('</article>')[0];
   assert.equal((article.match(/class="artwork-thumb"/g)||[]).length,expected.length);
   for(const card of expected)assert.ok(article.includes((card.thumbnail||`${card.image}/low.webp`).replaceAll('&','&amp;')));
   assert.ok(article.includes(`${lang==='en'?'/en':''}/${artist.id}/`));
  }
 }
});
test('all profile routes and pages preserve the Japanese collection',()=>{
 for(const {artist} of snapshots)for(const lang of ['en','ja']){
  const all=JSON.parse(readFileSync(`dist/api/artists/${artist.id}/${lang}/all.json`,'utf8'));const cards:CatalogCard[]=all.cards;
  const html=readFileSync(`dist/${lang==='en'?'en/':''}${artist.id}/index.html`,'utf8');
  assert.ok(html.includes('class="card-viewer"'));assert.ok(!html.includes('viewer-close'));assert.ok(!html.includes('viewer-name'));assert.ok(!html.includes('include-other-language'));assert.ok(!html.includes('class="card-language"'));
  assert.equal((html.match(/class="gallery-card"/g)||[]).length,Math.min(24,cards.length));
  const paged=[];for(let page=1;page<=Math.ceil(cards.length/24);page++){const data=JSON.parse(readFileSync(`dist/api/artists/${artist.id}/${lang}/${page}.json`,'utf8'));paged.push(...data.cards);assert.equal(data.more,page*24<cards.length);}
  assert.deepEqual(paged,cards);assert.ok(all.version.startsWith('illustrations-v2:'));
  const source:{cards:{source:string;high:string|null}[]}=JSON.parse(readFileSync(`src/data/japanese-catalog/${artist.id}.json`,'utf8'));
  for(const card of source.cards.filter(c=>c.high)) assert.ok(cards.some(c=>(artworkIdentities[c.fullImage||c.image!]||c.fullImage||c.image)===(artworkIdentities[card.high!]||card.high)),`${artist.id} missing artwork ${card.source}`);
  for(const card of cards){assert.equal(card.language,'ja');assert.ok(card.image);assert.ok(!card.image.includes('/en/') && !card.image.includes('cdn.artofpkm.com'));}
 }
});

test('legacy profile URLs redirect to the short routes',()=>{
  const redirects=readFileSync('public/_redirects','utf8');assert.ok(redirects.includes('/en/artists/:id/ /en/:id/ 301'));assert.ok(!redirects.includes('/#'));
});
test('language fallback uses matching cards and rejects ambiguous editions',()=>{
  const base={id:'ja-1',number:'1',name:'Japanese',image:null,illustrator:'Example',rarity:'Rare',language:'ja' as const,setId:'jp',setName:'JP',releaseDate:'2025-01-01',matchingKey:'verified-details'};
  const english={...base,id:'en-1',name:'English',language:'en' as const,image:'https://assets.tcgdex.net/en/example/1',setId:'en',setName:'EN',releaseDate:'2025-02-01'};
  const result=visibleCatalog([base],[english]);assert.equal(result[0].image,english.image);assert.equal(result[0].imageDetails?.id,english.id);assert.equal(result[0].releaseDate,base.releaseDate);
  assert.equal(visibleCatalog([base],[{...english,matchingKey:'other-art'}])[0].otherLanguageOnly,true);
  assert.equal(visibleCatalog([base],[english,{...english,id:'another'}]).length,2);
  assert.equal(visibleCatalog([base],[{...english,illustrator:'Someone else'}])[0].editionIds?.length,1);
});
test('filters and sorting apply to the complete collection',()=>{
  const cards=visibleCatalog(snapshots[0].index.catalogs.en,snapshots[0].index.catalogs.ja);
  const target=cards[0];const filtered=filterCards(cards,target.name,target.setId,target.rarity||'','oldest');assert.ok(filtered.some(c=>c.id===target.id));assert.ok(filtered.every(c=>c.setId===target.setId));
  const oldest=filterCards(cards,'','','','oldest');assert.ok(oldest[0].releaseDate! <= oldest.at(-1)!.releaseDate!);
});

test('interface language changes text but never Japanese image membership or ordering',()=>{
 for(const {artist} of snapshots){const en=builtCards(artist.id,'en');const ja=builtCards(artist.id,'ja');assert.deepEqual(en.map(c=>[c.id,c.image,c.thumbnail,c.fullImage]),ja.map(c=>[c.id,c.image,c.thumbnail,c.fullImage]),artist.id);assert.equal(new Set(en.map(c=>c.id)).size,en.length);assert.ok(en.every(c=>!/[\u3040-\u9fff]/u.test(c.name)),artist.id+' has an unlocalized name');}
 const en=builtCards('usgmen','en');const ja=builtCards('usgmen','ja');assert.ok(en.length>=15);assert.equal(en.filter(c=>c.name==='Wurmple').length,1);assert.ok(en.find(c=>c.name==='Wurmple')?.source?.includes('/sets/579/card/4'));assert.ok(en.some(c=>c.name==='Bibarel ex'));assert.ok(ja.some(c=>c.name==='ビーダルex'));
});

test('known TCGdex translations survive incomplete Japanese rarity and Pokédex data',()=>{
 const artist=snapshots.find(x=>x.artist.id==='uninori')!;
 const cards=visibleCatalog(artist.index.catalogs.ja,artist.index.catalogs.en,'ja');
 for(const [en,ja] of [['sv08-210','SV7a-074'],['sv08.5-166','SV8a-222']]){
  const card=cards.find(c=>c.editionIds?.includes(`en:${en}`))!;
  assert.ok(card.editionIds?.includes(`ja:${ja}`));assert.equal(card.otherLanguageOnly,false);assert.ok(card.image?.includes('/ja/'));assert.equal(card.imageDetails,undefined);
 }
});
test('both language menus always use 日本語 / English',()=>{
 for(const lang of ['en','ja']){
  const html=readFileSync(`dist/${lang==='en'?'en/':''}usgmen/index.html`,'utf8');
  assert.ok(html.includes('data-lang="ja">日本語</a>'));assert.ok(html.includes('data-lang="en">English</a>'));
 }
});

test('Pokémon filtering groups variants and Pocket can be hidden independently',()=>{
 const usgmen=builtCards('usgmen','en');
 const physical=filterCards(usgmen,'','','','newest',{hidePocket:true});assert.equal(physical.length,6);assert.ok(physical.every(c=>c.kind==='physical'));
 const pocket=filterCards(usgmen,'','','','newest',{hideTCG:true});assert.equal(pocket.length,9);assert.ok(pocket.every(c=>c.kind==='pocket'));assert.equal(filterCards(usgmen,'','','','newest',{hideTCG:true,hidePocket:true}).length,0);
 const goomy=filterCards(usgmen,'','','','newest',{pokemonId:'704'});assert.equal(goomy.length,1);assert.equal(goomy[0].name,'Goomy');
 assert.equal(filterCards(usgmen,'','','','newest',{pokemonId:'704',hidePocket:true}).length,0);
 const sorted=filterCards(usgmen,'','','','pokemon',{locale:'en'});assert.equal(sorted[0].name,'Bibarel ex');assert.equal(sorted.at(-1)?.name,'Wurmple');
 const arita=builtCards('mitsuhiro-arita','en');const charizard=filterCards(arita,'','','','pokemon',{pokemonId:'6'});assert.ok(charizard.length>1);assert.ok(charizard.every(c=>c.pokemon?.some(p=>p.id===6)));
 for(const lang of ['en','ja']){const html=readFileSync(`dist/${lang==='en'?'en/':''}usgmen/index.html`,'utf8');for(const key of ['pocket','tcg'])assert.ok(html.includes(`data-display="${key}"`));assert.ok(html.includes('id="card-pokemon"'));}
});

test('filters live in a dialog and expanded cards omit the illustrator and icons',()=>{
 for(const lang of ['en','ja']){
  const html=readFileSync(`dist/${lang==='en'?'en/':''}usgmen/index.html`,'utf8');
  const filters=html.split('id="gallery-filter-dialog"')[1].split('</dialog>')[0];assert.ok(filters.includes('class="filter-reset"'));assert.ok(filters.includes('id="card-pokemon"'));assert.ok(filters.includes('data-display="tcg"'));
  const viewer=html.split('class="card-viewer"')[1].split('</dialog>')[0];assert.ok(!viewer.includes('viewer-credit'));assert.ok(!viewer.includes('<svg'));assert.ok(!viewer.includes('viewer-details'));assert.ok(!html.includes('gallery-card-name'));assert.ok(!html.includes('gallery-card-set'));assert.ok(!filters.includes('id="card-set"'));assert.ok(!filters.includes('data-display="name"'));assert.ok(html.includes('About unique illustrations') || html.includes('イラストの数について'));
 }
});

test('illustration grouping retains the first print without merging distinct artworks',()=>{
 const first={id:'original',image:'scan-a'},foil={id:'foil',image:'scan-a'},reprint={id:'reprint',image:'scan-b'},differentArt={id:'different',image:'scan-c'};
 assert.deepEqual(uniqueIllustrations([first,foil,reprint,differentArt],{'scan-b':'scan-a'}).map(c=>c.id),['original','different']);
 for(const {artist} of snapshots){const cards=builtCards(artist.id,'en');const keys=cards.map(c=>artworkIdentities[c.fullImage||c.image!]||c.fullImage||c.image);assert.equal(new Set(keys).size,keys.length,artist.id);}
});

test('homepage previews group foil scans that preserve the same illustration',()=>{
 const base='https://www.pokemon-card.com/assets/images/card_images/large/';
 for(const [a,b] of [
  ['MC/049231_P_MAGIANA.jpg','M2a/048642_P_MAGIANA.jpg'],
  ['MC/049009_P_TOGEKISSU.jpg','M2a/048588_P_TOGEKISSU.jpg'],
  ['MC/049224_P_GIGIGIARU.jpg','SV11W/047689_P_GIGIGIARU.jpg'],
  ['SK/041121_T_FUSHIGINAAME.jpg','SI/040465_T_FUSHIGINAAME.jpg'],
  ['SK/041126_T_FUUSEN.jpg','SD/038377_T_FUUSEN.jpg']
 ]){assert.ok(artworkIdentities[base+a]);assert.equal(artworkIdentities[base+a],artworkIdentities[base+b]);}
 for(const id of ['rika','narano','amelicart','yoshinobu-saito']){const cards=builtCards(id,'en').slice(0,6);assert.equal(new Set(cards.map(c=>artworkIdentities[c.fullImage||c.image!]||c.fullImage||c.image)).size,cards.length);}
 for(const lang of ['en','ja']){const html=readFileSync(`dist/${lang==='en'?'en/':''}usgmen/index.html`,'utf8');const filters=html.split('id="gallery-filter-dialog"')[1].split('</dialog>')[0];assert.ok(filters.includes('id="card-query"'));assert.ok(html.split('class="profile-header"')[1].split('</header>')[0].includes('profile-filter-action'));}
});

test('directory search indexes illustrator names and handles without card titles',()=>{
 for(const lang of ['en','ja']){
  const html=readFileSync(`dist/${lang==='en'?'en/':''}index.html`,'utf8');
  for(const {artist} of snapshots){
   const article=html.split(`id="${artist.id}"`)[1].split('</article>')[0];
   const actual=article.match(/data-search="([^"]*)"/)![1].replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"');
   const expected=[artist.name,artist.japaneseName,artist.romanizedName,artist.handle,artist.instagram].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase();
   assert.equal(actual,expected,artist.id);
   if(artist.id==='jerky')assert.ok(!actual.includes('sa'));
  }
 }
});

test('format choices are available only for illustrators with both formats',()=>{
 for(const {artist} of snapshots){
  const cards=builtCards(artist.id,'en');
  const html=readFileSync(`dist/en/${artist.id}/index.html`,'utf8');
  const expected=cards.some(c=>c.kind==='pocket')&&cards.some(c=>c.kind!=='pocket');
  assert.equal(html.includes('class="filter-switches"'),expected,artist.id);
  assert.ok(!html.includes('role="switch"'));
 }
});

test('appearance defaults to the device and respects a saved manual choice',async()=>{
 const {runInNewContext}=await import('node:vm');
 const html=readFileSync('dist/en/index.html','utf8');
 const boot=html.match(/<script>([\s\S]*?)<\/script>/)![1];
 for(const systemDark of [false,true])for(const saved of [null,'light','dark','invalid','unreadable']){
  const root={dataset:{} as Record<string,string>,classList:{add(){}}};const meta={content:''};
  runInNewContext(boot,{document:{documentElement:root,querySelector:()=>meta},localStorage:{getItem(){if(saved==='unreadable')throw Error('Unavailable');return saved;}},matchMedia:()=>({matches:systemDark})});
  assert.equal(root.dataset.theme,saved==='light'||saved==='dark'?saved:systemDark?'dark':'light');
 }
});

test('profile search matches names and social handles across normalized queries',async()=>{
 const {illustratorSearchText,matchesIllustrator}=await import('../src/lib/illustrator-search');
 const jerky=snapshots.find(x=>x.artist.id==='jerky')!.artist;
 assert.equal(matchesIllustrator(illustratorSearchText(jerky),'sa'),false);
 assert.equal(matchesIllustrator(illustratorSearchText(jerky),'ＢＡＮＡＮＡＪＥＲＫＹ'),true);
 const arita=snapshots.find(x=>x.artist.id==='mitsuhiro-arita')!.artist;
 assert.equal(matchesIllustrator(illustratorSearchText(arita),'arita mitsuhiro'),true);
 for(const lang of ['en','ja']){
  const html=readFileSync(`dist/${lang==='en'?'en/':''}usgmen/index.html`,'utf8');
  const sheet=html.split('id="illustrator-search-results"')[1].split('</nav>')[0];
  assert.equal((sheet.match(/<li /g)||[]).length,snapshots.length);
  assert.ok(sheet.includes(`${lang==='en'?'/en':''}/jerky/`));
  assert.ok(html.includes('card-query-clear'));
 }
});

test('Yoko Hishida retains verified Japanese Pocket illustrations and their original image sources',()=>{
 const overrides=JSON.parse(readFileSync('src/data/japanese-image-overrides.json','utf8'));
 for(const lang of ['en','ja']){
  const cards=builtCards('yoko-hishida',lang).filter(c=>c.kind==='pocket');
  for(const [source,override] of Object.entries(overrides) as [string,{artistId:string;high:string;imageSource:string}][]){
   assert.equal(override.artistId,'yoko-hishida');
   const card=cards.find(c=>c.source===source);assert.ok(card,source);
   assert.equal(card.fullImage,override.high);assert.equal(card.imageSource,override.imageSource);
  }
 }
});
