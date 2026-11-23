"""Verify the rarity labels used by the curated previews against official pages.

Only HTML and JSON metadata are cached; all displayed card images stay on the
official Pokémon image server. Check more candidates than the final 15 so a
corrected label can move a replacement into the preview.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import time
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache/japanese-originals'
INDEX=ROOT/'src/data/preview-rarities.json'
TIERS={'MUR':120,'BWR':115,'UR':110,'SAR':100,'HR':95,'CSR':90,'SSR':85,'SR':80,'AR':70,'CHR':65,'S':60,'RRR':50,'RR':40,'R':30,'U':20,'C':10}
ALIASES={'mega ultra rare':'MUR','black white rare':'BWR','ultra rare':'UR','hyper rare':'HR','special illustration rare':'SAR','special art rare':'SAR','character super rare':'CSR','shiny ultra rare':'SSR','shiny super rare':'SSR','super rare':'SR','secret rare':'SR','illustration rare':'AR','art rare':'AR','character rare':'CHR','shiny rare':'S','triple rare':'RRR','double rare':'RR','rare':'R','holo rare':'R','rare holo':'R','uncommon':'U','common':'C'}

def rank(rarity):
    if not rarity:return 0
    match=re.search(r'\(([A-Z]{1,3})\)',rarity)
    code=match[1] if match else rarity.upper()
    return TIERS.get(code,TIERS.get(ALIASES.get(rarity.lower(),''),0))

def main():
    CACHE.mkdir(parents=True,exist_ok=True)
    labels=json.loads(INDEX.read_text()) if INDEX.exists() else {}
    identities=json.loads((ROOT/'src/data/artwork-identities.json').read_text())['images']
    candidates={}
    for path in sorted((ROOT/'src/data/japanese-catalog').glob('*.json')):
        snapshot=json.loads(path.read_text())
        cards=[c for c in snapshot['cards'] if (c.get('high') or '').startswith('https://www.pokemon-card.com/assets/images/card_images/large/')]
        tcgdex_path=ROOT/'src/data/tcgdex'/path.name
        tcgdex=json.loads(tcgdex_path.read_text())['catalogs']['ja'] if tcgdex_path.exists() else []
        for card in cards:
            if labels.get(card['high'],{}).get('source'):continue
            number=card['number'].split('/')[0].lstrip('0')
            matches=[c for c in tcgdex if c['name']==card['ja'] and c['number'].lstrip('0')==number
                     and c.get('releaseDate')==card.get('releaseDate') and c.get('rarity') not in [None,'None']]
            if len(matches)==1:
                labels[card['high']]={'rarity':matches[0]['rarity'],'source':'https://api.tcgdex.net/v2/ja/cards/'+matches[0]['id']}
        cards.sort(key=lambda c:(rank(labels.get(c['high'],{}).get('rarity')),c.get('releaseDate') or '',c['number']),reverse=True)
        seen=set()
        for card in cards:
            key=identities.get(card['high'],card['high'])
            if key in seen:continue
            seen.add(key)
            if card.get('imageSource'):candidates[card['high']]=card['imageSource']
            if len(seen)>=25:break

    def verify(item):
        image,url=item
        if not url.startswith('https://www.pokemon-card.com/card-search/details.php/card/'):
            raise ValueError('Non-official rarity source: '+url)
        path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.txt')
        if path.exists():text=path.read_text()
        else:
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(url,timeout=30) as response:text=response.read().decode()
                    path.write_text(text);time.sleep(.5);break
                except Exception as error:
                    if attempt==2:raise
                    time.sleep(30 if getattr(error,'code',None)==429 else 2)
        if '<h1' not in text or '/card_images/large/' not in text:
            raise ValueError('Invalid official card detail: '+url)
        match=re.search(r'/rarity/ic_rare_([a-z]+)(?:_|\.)',text)
        return image,{'rarity':match[1].upper() if match else None,'source':url}

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(verify,candidates.items()))
    labels.update(dict(results))
    INDEX.write_text(json.dumps(labels,ensure_ascii=False,indent=2)+'\n')
    print('Verified official rarity labels for',len(results),'preview candidates.')

if __name__=='__main__':main()
