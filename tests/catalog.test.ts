import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
test('built homepage uses six latest available images, links to profiles, and has no card viewer',()=>{
  for(const lang of ['en','ja']){
    const html=readFileSync(`dist/${lang==='en'?'en/':''}index.html`,'utf8');assert.ok(!html.includes('class="card-viewer"'));assert.ok(!html.includes('https://pbs.twimg.com/media/'));
    for(const {artist,index} of snapshots){const cards=visibleCatalog(index.catalogs[lang],index.catalogs[lang==='en'?'ja':'en']);const expected=cards.filter(c=>c.image).slice(0,6);const article=html.split(`id="${artist.id}"`)[1].split('</article>')[0];assert.equal((article.match(/class="artwork-thumb"/g)||[]).length,expected.length);for(const card of expected)assert.ok(article.includes(`${card.image}/low.webp`));assert.ok(article.includes(`${lang==='en'?'/en':''}/${artist.id}/`));
    }
  }
});
test('all profile routes and paginated metadata preserve the complete collection',()=>{
  for(const {artist,index} of snapshots)for(const lang of ['en','ja']){const cards=visibleCatalog(index.catalogs[lang],index.catalogs[lang==='en'?'ja':'en']);const html=readFileSync(`dist/${lang==='en'?'en/':''}${artist.id}/index.html`,'utf8');assert.ok(html.includes('class="card-viewer"'));assert.equal((html.match(/class="gallery-card"/g)||[]).length,Math.min(24,cards.length));const paged=[];for(let page=1;page<=Math.ceil(cards.length/24);page++){const data=JSON.parse(readFileSync(`dist/api/artists/${artist.id}/${lang}/${page}.json`,'utf8'));paged.push(...data.cards);assert.equal(data.more,page*24<cards.length);}assert.deepEqual(paged,cards);}
});

test('legacy profile URLs redirect to the short routes',()=>{
  const redirects=readFileSync('public/_redirects','utf8');assert.ok(redirects.includes('/en/artists/:id/ /en/:id/ 301'));assert.ok(!redirects.includes('/#'));
});
test('language fallback uses matching cards and rejects ambiguous editions',()=>{
  const base={id:'ja-1',number:'1',name:'Japanese',image:null,illustrator:'Example',rarity:'Rare',language:'ja' as const,setId:'jp',setName:'JP',releaseDate:'2025-01-01',matchingKey:'verified-details'};
  const english={...base,id:'en-1',name:'English',language:'en' as const,image:'https://assets.tcgdex.net/en/example/1',setId:'en',setName:'EN',releaseDate:'2025-02-01'};
  const result=visibleCatalog([base],[english]);assert.equal(result[0].image,english.image);assert.equal(result[0].imageDetails?.id,english.id);assert.equal(result[0].releaseDate,base.releaseDate);
  assert.equal(visibleCatalog([base],[{...english,matchingKey:'other-art'}]).length,0);
  assert.equal(visibleCatalog([base],[english,{...english,id:'another'}]).length,0);
  assert.equal(visibleCatalog([base],[{...english,illustrator:'Someone else'}]).length,0);
});
test('filters and sorting apply to the complete collection',()=>{
  const cards=visibleCatalog(snapshots[0].index.catalogs.en,snapshots[0].index.catalogs.ja);
  const target=cards[0];const filtered=filterCards(cards,target.name,target.setId,target.rarity||'','oldest');assert.ok(filtered.some(c=>c.id===target.id));assert.ok(filtered.every(c=>c.setId===target.setId));
  const oldest=filterCards(cards,'','','','oldest');assert.ok(oldest[0].releaseDate! <= oldest.at(-1)!.releaseDate!);
});
