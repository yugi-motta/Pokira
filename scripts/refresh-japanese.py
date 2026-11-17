"""Refresh Japanese print metadata from the public Art of Pokémon catalog.
Only metadata and remote image URLs are stored; image files remain on their CDN.
All requests finish and validate before checked-in snapshots are replaced.
"""
import concurrent.futures, datetime, hashlib, html, json, pathlib, re, time, urllib.request, urllib.parse
from urllib.error import HTTPError
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache/artofpkm'; CACHE.mkdir(parents=True,exist_ok=True)
BASE='https://www.artofpkm.com'
def fetch(path):
    cache=CACHE/(hashlib.sha256(path.encode()).hexdigest()+'.html')
    if cache.exists() and time.time()-cache.stat().st_mtime<86400: return cache.read_text()
    for attempt in range(3):
        try:
            req=urllib.request.Request(BASE+path,headers={'User-Agent':'Pokira catalog metadata refresh (pokira.pages.dev)'})
            with urllib.request.urlopen(req,timeout=60) as r: text=r.read().decode()
            cache.write_text(text); time.sleep(1.5); return text
        except Exception as error:
            if attempt==2: raise
            time.sleep(30 if isinstance(error,HTTPError) and error.code==429 else attempt+1)
class Tiles(HTMLParser):
    def __init__(self): super().__init__(); self.cards=[]; self.card=None; self.field=None; self.depth=0;self.tile_depth=0;self.kind="physical"
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); classes=a.get('class','').split()
        if tag in ['a','div'] and 'card-tile' in classes:
            self.card={'kind':self.kind};self.tile_depth=1
            if a.get('href'):self.card['source']=BASE+a['href']
        elif self.card is not None and tag not in ['img','br','hr','input']:self.tile_depth+=1
        if self.card is None:return
        if 'card-tile-title' in classes:self.field='en';self.depth=1
        elif 'card-tile-native' in classes:self.field='ja' if a.get('lang')=='ja' else 'other';self.depth=1
        elif 'card-tile-number' in classes:self.field='number';self.depth=1
        elif 'card-subtitle' in classes:self.field='setName';self.depth=1
        elif self.field and tag not in ['img','br']:self.depth+=1
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in ['img','br','hr','input']:self.handle_endtag(tag)
    def handle_endtag(self,tag):
        if self.card is None:return
        if self.field:
            self.depth-=1
            if self.depth<=0:self.field=None
        self.tile_depth-=1
        if self.tile_depth==0:
            if self.card.get('ja') and not self.card.get('other'):self.cards.append(self.card)
            self.card=None;self.field=None
    def handle_data(self,data):
        if self.card is None and re.fullmatch(r'Pocket \(\d+\)',data.strip()):self.kind='pocket'
        if self.card is None and re.fullmatch(r'TCG \(\d+\)',data.strip()):self.kind='physical'
        if self.card is not None and self.field:self.card[self.field]=self.card.get(self.field,'')+data
artists=[json.loads(p.read_text()) for p in sorted((ROOT/'src/data/artists').glob('*.json'))]
directory=fetch('/illustrators')
links={html.unescape(re.sub('<[^>]+>','',n)).strip().casefold():u for u,n in re.findall(r'href="(/illustrators/[^"?]+)"[^>]*>(.*?)</a>',directory,re.S)}
# The set index includes Japanese names, dates and official set codes in one read.
sets={}
for tile in re.findall(r'<a\b[^>]*href="/sets/\d+"[^>]*>.*?</a>',fetch('/sets'),re.S):
    name=re.search(r'<h3[^>]*>(.*?)</h3>',tile,re.S)
    if not name:continue
    clean=lambda value:html.unescape(re.sub('<[^>]+>','',value)).strip()
    name=clean(name[1]);native=re.search(r'<p[^>]*class="font-ja [^"]*"[^>]*>(.*?)</p>',tile,re.S)
    code=re.search(r'title="Set code"[^>]*>(.*?)</span>',tile,re.S);date=re.search(r'datetime="(\d{4}-\d{2}-\d{2})"',tile)
    meta={'setId':re.search(r'href="/sets/(\d+)"',tile)[1],'setCode':clean(code[1]) if code else '', 'setJapaneseName':clean(native[1]) if native else None,'releaseDate':date[1] if date else None}
    sets.setdefault(name,[]).append(meta)
def artist_cards(a):
    path=links[a['name'].casefold()]; parser=Tiles();parser.feed(fetch(path))
    if not parser.cards:raise ValueError('No Japanese cards for '+a['id'])
    seen=set();cards=[]
    for c in parser.cards:
        for key in ['en','ja','number','setName']:c[key]=c.get(key,'').strip()
        if not all(c[k] for k in ['en','ja','setName']):raise ValueError(c)
        known=sets.get(c['setName'],[])
        if c.get('source'):
            c['setId']=re.search(r'/sets/(\d+)/',c['source'])[1]
            known=[m for values in sets.values() for m in values if m['setId']==c['setId']]
        elif len(known)==1:
            c['setId']=known[0]['setId'];c['source']=BASE+'/sets/'+c['setId']+'#'+urllib.parse.quote(c['number'] or c['ja'],safe='')
        else:continue
        if c['source'] in seen:continue
        seen.add(c['source']);c['high']=None;c['thumbnail']=None;c['width']=600;c['height']=825
        if len(known)==1:c.update(known[0])
        else:c.update({'releaseDate':None,'setJapaneseName':None})
        cards.append(c)
    print(a['id'],len(cards),flush=True)
    return {'artistId':a['id'],'source':BASE+path,'cards':cards}
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool: snapshots=list(pool.map(artist_cards,artists))
# Pocket sets and foil sub-sets are outside the physical set index.
setids=sorted({c['setId'] for s in snapshots for c in s['cards'] if not c.get('releaseDate')})
def set_info(id):
    text=fetch('/sets/'+id);dates=re.findall(r'<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"',text)
    native=re.search(r'<h2[^>]*class="ja [^"]*"[^>]*>(.*?)</h2>',text,re.S)
    return id,{'date':dates[0] if dates else None,'ja':html.unescape(re.sub('<[^>]+>','',native[1])).strip() if native else None}
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:dates=dict(pool.map(set_info,setids))
now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
out=ROOT/'src/data/japanese-catalog';out.mkdir(exist_ok=True)
for s in snapshots:
    previous=out/(s['artistId']+'.json')
    if previous.exists() and len(s['cards'])<len(json.loads(previous.read_text())['cards'])*.8:
        raise ValueError('Unexpected catalog shrink; keeping existing snapshots for '+s['artistId'])
for s in snapshots:
    s['updatedAt']=now
    for c in s['cards']:
        if c['setId'] in dates:c['releaseDate']=dates[c['setId']]['date'];c['setJapaneseName']=dates[c['setId']]['ja']
    (out/(s['artistId']+'.json')).write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
print('Saved',sum(len(s['cards']) for s in snapshots),'Japanese printings',flush=True)
