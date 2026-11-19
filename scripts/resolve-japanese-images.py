"""Resolve reference printings to original official Japanese card image URLs.
No image files are downloaded. Ambiguous same-name cards are matched by their
printed collector number from the official detail page, never by list order.
"""
import concurrent.futures, hashlib, html, json, pathlib, re, time, urllib.request, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache/japanese-originals';CACHE.mkdir(parents=True,exist_ok=True)
IMAGE_OVERRIDES=json.loads((ROOT/'src/data/japanese-image-overrides.json').read_text())
def get(url):
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.txt')
 ttl=86400 if 'resultAPI.php' in url else 30*86400
 if p.exists() and time.time()-p.stat().st_mtime<ttl:return p.read_text()
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url,timeout=30) as r:s=r.read().decode()
   p.write_text(s);time.sleep(.6);return s
  except Exception as e:
   if attempt==2:raise
   time.sleep(30 if getattr(e,'code',None)==429 else 2)
def code(id):
 p=ROOT/'.cache/artofpkm'/(hashlib.sha256(('/sets/'+id).encode()).hexdigest()+'.html')
 s=p.read_text().split('<h1')[0]
 matches=re.findall(r'<span[^>]*data-highlight=""[^>]*>([^<>]+)</span>',s)
 return html.unescape(matches[-1]).strip() if matches else ''
def number(card):
 text=get('https://www.pokemon-card.com/card-search/details.php/card/'+card['cardID']+'/regu/all')
 m=re.search(r'class="img-regulation"[^>]*>\s*(.*?)</div>',text,re.S)
 text=html.unescape(re.sub('<[^>]+>','',m[1] if m else ''))
 return re.sub(r'\s','',text).split('/')[0].lstrip('0')
def same_set(folder,code):
 clean=lambda value:re.sub('[^a-z0-9]','',value.casefold().replace('+','p'))
 if clean(folder)==clean(code):return True
 # Official image folders add a product suffix to some printed set codes.
 if folder.casefold().startswith(code.casefold()+'-'):return True
 # Older Diamond/Pearl reference codes append booster identifiers.
 return bool(re.fullmatch(r'DP[1-6]-B(?:-[A-Z])?',code)) and folder==code.split('-')[0]
def normalized_name(name):return re.sub(r'\s|（[^）]*）|\([^)]*\)','',html.unescape(name)).casefold()
def process(file):
 s=json.loads(file.read_text());artist=json.loads((ROOT/'src/data/artists'/file.name).read_text());official=[];page=1
 while True:
  query=urllib.parse.urlencode({'illust':artist['name'],'regulation_sidebar_form':'all','keyword':'','page':page})
  data=json.loads(get('https://www.pokemon-card.com/card-search/resultAPI.php?'+query))
  if data.get('result')!=1:raise ValueError(data)
  official.extend(data['cardList'])
  if page>=int(data['maxPage']):break
  page+=1
 for c in s['cards']:
  setcode=c['setCode'] if 'setCode' in c else code(c['setId']);c['setCode']=setcode
  candidates=[o for o in official if normalized_name(o['cardNameAltText'])==normalized_name(c['ja']) and bool(setcode) and same_set(re.search(r'/large/([^/]+)/',o['cardThumbFile'])[1],setcode)]
  if len(candidates)>1:candidates=[o for o in candidates if number(o)==c['number'].split('/')[0].lstrip('0')]
  # Remove restricted third-party image URLs from the published catalog.
  c['high']=None;c['thumbnail']=None
  if candidates:
   c['width']=868;c['height']=1212
   original=candidates[0];url='https://www.pokemon-card.com'+original['cardThumbFile'];c['high']=url;c['thumbnail']=url;c['imageSource']='https://www.pokemon-card.com/card-search/details.php/card/'+original['cardID']+'/regu/all'
  elif s['artistId']=='usgmen':
   pocket={
    'ホエルオーex':'https://pbs.twimg.com/media/HRC-asBbwAACW9v.jpg',
    'メガヤドランex':'https://pbs.twimg.com/media/HHeOcyybwAAyDL0.jpg',
    'デリバード':'https://pbs.twimg.com/media/HAJVULmbAAArkfZ.jpg',
    'オドリドリ':'https://pbs.twimg.com/media/GsbtWkebIAAQEuT.jpg',
    'ビーダルex':'https://pbs.twimg.com/media/GqLdyxFbMAAkJn_.jpg',
    'コダック':'https://usgmen.com/wp-content/uploads/2026/07/171330dc0829cb233d93de2be0f24c11.png',
    'ヤドン':'https://usgmen.com/wp-content/uploads/2026/07/56d7c6529596ea169219ec628eb60c81.png',
    'ヌオー':'https://usgmen.com/wp-content/uploads/2026/07/544c5d12af7d458afde86a3eaf44c5b2.png',
    'ヌメラ':'https://usgmen.com/wp-content/uploads/2026/07/ae52061b87e90c617e5679da9d4d3a1a.png'}
   if c['ja'] in pocket:
    c['width']=734;c['height']=1024
    c['high']=pocket[c['ja']];c['thumbnail']=pocket[c['ja']].replace('.png','-215x300.png') if 'usgmen.com/wp-content/' in pocket[c['ja']] else pocket[c['ja']].replace('.jpg','?format=jpg&name=small')
    c['imageSource']='https://usgmen.com/work/3092' if 'usgmen.com' in c['high'] else next(p['url'] for p in artist['announcements'] if any(n in c['ja'] for n in p['pokemon']))
  override=IMAGE_OVERRIDES.get(c['source'])
  if override:
   if override['artistId']!=s['artistId']:raise ValueError('Image override illustrator mismatch: '+c['source'])
   c.update({key:override[key] for key in ['high','thumbnail','width','height','imageSource']})
 print(s['artistId'],sum(bool(c['high']) for c in s['cards']),'/',len(s['cards']),flush=True)
 return file,s
files=list((ROOT/'src/data/japanese-catalog').glob('*.json'))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(process,files))
for file,s in results:file.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
