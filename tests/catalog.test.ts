import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {rarityRank,selectPreview,isOfficialCardImage,isTrainerCard,PREVIEW_LIMIT} from '../src/lib/card-preview';
import {illustratorSearchText,matchesIllustrator} from '../src/lib/illustrator-search';
import type {CatalogCard} from '../src/lib/cards';
const artists=readdirSync('src/data/artists').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`src/data/artists/${f}`,'utf8')));
const identities:Record<string,string>=JSON.parse(readFileSync('src/data/artwork-identities.json','utf8')).images;
function cardsFor(id:string,lang:string):CatalogCard[]{return JSON.parse(readFileSync(`dist/api/artists/${id}/${lang}/all.json`,'utf8')).cards;}

test('rarity tiers prioritize rare illustrations and fill the remaining preview with lower tiers',()=>{
 const input=Array.from({length:20},(_,i)=>({id:String(i),number:String(i),releaseDate:'2025-01-01',rarity:i<3?'SAR':i<8?'AR':'Common',image:`https://www.pokemon-card.com/assets/images/card_images/large/test/${i}.jpg`}));
 const result=selectPreview(input.reverse());assert.equal(result.length,15);
 assert.equal(result.filter(c=>c.rarity==='SAR').length,3);assert.equal(result.filter(c=>c.rarity==='AR').length,5);
 assert.equal(result.filter(c=>c.rarity==='Common').length,7);
 assert.ok(rarityRank('Special Art Rare (SAR)')>rarityRank('Art Rare (AR)'));
 assert.ok(rarityRank('SR')>rarityRank('RR'));assert.ok(rarityRank('R')>rarityRank('U'));
 assert.ok(rarityRank('U')>rarityRank('C'));assert.equal(rarityRank(null),0);
});

test('preview image policy permits only official Japanese Pokémon card images',()=>{
 for(const url of ['https://assets.tcgdex.net/ja/SV/SV8/045/high.webp','https://pbs.twimg.com/media/a.jpg','https://pokira.pages.dev/images/a.webp','https://www.pokemon-card.com.evil.example/assets/images/card_images/large/a.jpg','http://www.pokemon-card.com/assets/images/card_images/large/a.jpg','https://user@www.pokemon-card.com/assets/images/card_images/large/a.jpg'])assert.equal(isOfficialCardImage(url),false,url);
 assert.equal(isOfficialCardImage('https://www.pokemon-card.com/assets/images/card_images/large/SV8/046385_P_TOGEPI.jpg'),true);
});

test('variants do not consume preview slots and the rarer printing represents shared art',()=>{
 const base={id:'common',number:'1',releaseDate:'2024-01-01',rarity:'C',image:'https://www.pokemon-card.com/assets/images/card_images/large/a.jpg'};
 const rare={...base,id:'rare',rarity:'SAR',image:'https://www.pokemon-card.com/assets/images/card_images/large/b.jpg'};
 const distinct={...base,id:'distinct',rarity:'AR',image:'https://www.pokemon-card.com/assets/images/card_images/large/c.jpg'};
 assert.deepEqual(selectPreview([base,rare,distinct],{[rare.image]:base.image}).map(c=>c.id),['rare','distinct']);
});

test('every illustrator has a capped, rarity-ordered official preview with identical language membership',()=>{
 for(const artist of artists){
  const en=cardsFor(artist.id,'en'),ja=cardsFor(artist.id,'ja');
  const source=JSON.parse(readFileSync(`src/data/japanese-catalog/${artist.id}.json`,'utf8'));
  const expected=new Set(source.cards.filter((c:{high:string|null})=>isOfficialCardImage(c.high)).map((c:{high:string})=>identities[c.high]||c.high));
  assert.equal(en.length,Math.min(PREVIEW_LIMIT,expected.size),artist.id);
  assert.deepEqual(en.map(c=>[c.id,c.image]),ja.map(c=>[c.id,c.image]),artist.id);
  const seen=new Set<string>();
  en.forEach((card,i)=>{assert.equal(card.language,'ja');assert.equal(card.kind,'physical');assert.ok(isOfficialCardImage(card.fullImage));assert.ok(isOfficialCardImage(card.thumbnail));
   const key=identities[card.fullImage!]||card.fullImage!;assert.ok(!seen.has(key),artist.id);seen.add(key);
   if(i){
    assert.ok(!isTrainerCard(en[i-1])||isTrainerCard(card),artist.id);
    if(isTrainerCard(en[i-1])===isTrainerCard(card))assert.ok(rarityRank(en[i-1].rarity)>=rarityRank(card.rarity),artist.id);
   }
  });
 }
});

test('homepage thumbnails use the same rarity-first selection as profiles',()=>{
 for(const lang of ['en','ja']){
  const html=readFileSync(`dist/${lang==='en'?'en/':''}index.html`,'utf8');
  for(const artist of artists){const article=html.split(`id="${artist.id}"`)[1].split('</article>')[0];const expected=cardsFor(artist.id,lang).slice(0,5);
   assert.equal((article.match(/class="artwork-thumb"/g)||[]).length,expected.length);
   for(const card of expected)assert.ok(article.includes(card.thumbnail!.replaceAll('&','&amp;')));
  }
  assert.ok(html.includes('data-suggest'));assert.ok(!html.includes('class="card-viewer"'));
 }
});

test('profiles replace counts, filters and pagination with an external continuation link',()=>{
 for(const artist of artists)for(const lang of ['en','ja']){
  const html=readFileSync(`dist/${lang==='en'?'en/':''}${artist.id}/index.html`,'utf8');
  assert.equal((html.match(/class="gallery-card"/g)||[]).length,Math.min(10,cardsFor(artist.id,lang).length));
  for(const obsolete of ['class="profile-count"','gallery-filter-dialog','class="load-more"','illustration-count-info','class="gallery-pagination"'])assert.ok(!html.includes(obsolete),obsolete);
  const source=JSON.parse(readFileSync(`src/data/japanese-catalog/${artist.id}.json`,'utf8')).source;
  assert.ok(html.includes(`class="see-all" href="${source}" target="_blank"`));
  assert.ok(html.includes(lang==='en'?'See all on artofpkm.com':'artofpkm.comですべて見る'));
  assert.ok(html.includes('class="card-viewer"'));assert.ok(!html.includes('viewer-close'));
 }
});

test('suggestion action is present after profile search results even when no rows match',()=>{
 for(const lang of ['en','ja']){
  const html=readFileSync(`dist/${lang==='en'?'en/':''}usgmen/index.html`,'utf8');
  const sheet=html.split('id="illustrator-search-results"')[1].split('</nav>')[0];
  assert.equal((sheet.match(/<li /g)||[]).length,artists.length);
  assert.ok(sheet.indexOf('data-suggest')>sheet.indexOf('</ul>'));
  assert.ok(sheet.includes('search-sheet-empty'));
 }
 const jerky=artists.find(a=>a.id==='jerky');assert.equal(matchesIllustrator(illustratorSearchText(jerky),'sa'),false);
 assert.equal(matchesIllustrator(illustratorSearchText(jerky),'ＢＡＮＡＮＡＪＥＲＫＹ'),true);
});

test('about copy focuses on following illustrators and omits the removed paragraphs',()=>{
 const html=readFileSync('dist/en/index.html','utf8');
 assert.ok(html.includes('Pokira celebrates the independent illustrators'));
 assert.ok(html.includes('follow them on social media'));
 assert.ok(!html.includes('Illustrator credits and card information may be incomplete'));
 assert.ok(!html.includes('Reprints and other variants of the same artwork are grouped'));
});

test('appearance follows the device until the visitor saves a manual choice',async()=>{
 const {runInNewContext}=await import('node:vm');
 const html=readFileSync('dist/en/index.html','utf8');const boot=html.match(/<script>([\s\S]*?)<\/script>/)![1];
 for(const systemDark of [false,true])for(const saved of [null,'light','dark','invalid','unreadable']){
  const root={dataset:{} as Record<string,string>,classList:{add(){}}};const meta={content:''};
  runInNewContext(boot,{document:{documentElement:root,querySelector:()=>meta},localStorage:{getItem(){if(saved==='unreadable')throw Error('Unavailable');return saved;}},matchMedia:()=>({matches:systemDark})});
  assert.equal(root.dataset.theme,saved==='light'||saved==='dark'?saved:systemDark?'dark':'light');
 }
});


test('Trainers only fill missing preview slots and always follow Pokémon',()=>{
 const make=(i:number,trainer=false,rarity='C')=>({id:String(i),number:String(i),releaseDate:'2026-01-01',rarity,image:`https://www.pokemon-card.com/assets/images/card_images/large/TEST/${100000+i}_${trainer?'T':'P'}_TEST.jpg`});
 const pokemon=Array.from({length:18},(_,i)=>make(i));
 const trainer=make(100,true,'SAR');
 assert.equal(isTrainerCard(trainer),true);
 assert.ok(selectPreview([trainer,...pokemon]).every(card=>!isTrainerCard(card)));
 const rarePokemon=make(99,false,'AR');
 const result=selectPreview([trainer,...pokemon.slice(0,4),rarePokemon]);
 assert.equal(result.length,6);assert.equal(result[0].id,rarePokemon.id);assert.equal(result.at(-1)!.id,trainer.id);
 assert.deepEqual(selectPreview([trainer]).map(c=>c.id),[trainer.id]);
 const variant={...trainer,id:'variant',image:'https://www.pokemon-card.com/assets/images/card_images/large/TEST/100101_T_TEST.jpg'};
 assert.equal(selectPreview([trainer,variant],{[variant.image]:trainer.image}).length,1);
});

test('closing suggestions preserves scroll and returns focus to the opener',async()=>{
 const {runInNewContext}=await import('node:vm');
 const ts=await import('typescript');
 const source=readFileSync('src/components/SuggestionForm.astro','utf8').match(/<script>([\s\S]*?)<\/script>/)![1];
 const script=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const menu of [false,true])for(const dismissal of ['button','cancel','backdrop']){
  const position={scrollX:12,scrollY:3756,scrollTo(options:{left:number;top:number;behavior:string}){assert.equal(options.behavior,'instant');this.scrollX=options.left;this.scrollY=options.top;}};
  const focusCalls:{name:string;preventScroll:boolean}[]=[];
  const closeButton=new EventTarget();
  const trigger=Object.assign(new EventTarget(),{closest:()=>menu?{}:null,focus:(options:{preventScroll:boolean})=>focusCalls.push({name:'opener',...options})});
  const menuButton={focus:(options:{preventScroll:boolean})=>focusCalls.push({name:'menu',...options})};
  const dialog=Object.assign(new EventTarget(),{dataset:{} as Record<string,string>,open:false,
   querySelector:()=>closeButton,showModal(){this.open=true;},close(this:EventTarget & {open:boolean}){this.open=false;position.scrollY=0;this.dispatchEvent(new Event('close'));}});
  const body={style:{overflow:'auto'}};
  const document={body,querySelectorAll:()=>[trigger],querySelector:(selector:string)=>selector==='#suggestion-dialog'?dialog:selector==='.menu-toggle'?menuButton:null};
  runInNewContext(script,{document,window:position,setTimeout:(callback:()=>void)=>{callback();return 0;}});
  trigger.dispatchEvent(new Event('click'));assert.equal(dialog.open,true);assert.equal(body.style.overflow,'hidden');
  if(dismissal==='button')closeButton.dispatchEvent(new Event('click'));
  if(dismissal==='cancel')dialog.dispatchEvent(new Event('cancel',{cancelable:true}));
  if(dismissal==='backdrop')dialog.dispatchEvent(new Event('click'));
  assert.equal(dialog.open,false);assert.equal(body.style.overflow,'auto');assert.equal(position.scrollX,12);assert.equal(position.scrollY,3756);
  assert.equal(focusCalls.at(-1)!.name,menu?'menu':'opener');assert.ok(focusCalls.every(call=>call.preventScroll));
 }
});
