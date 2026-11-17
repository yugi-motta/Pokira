import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { compareCards } from '../src/lib/card-order';

const ROOT = 'src/data/tcgdex';
const CACHE = '.cache/tcgdex';
const TTL = 24 * 60 * 60 * 1000;
await mkdir(ROOT, { recursive: true });
await mkdir(CACHE, { recursive: true });
const force = process.argv.includes('--force');
const matchingKey = (card: any) => card.matchingKey || (card.dexId?.length && card.attacks?.length ? createHash('sha256').update(JSON.stringify([card.illustrator,card.dexId,card.category,card.hp,card.types,card.stage,card.suffix||'',card.rarity,card.regulationMark||'',card.retreat,card.attacks.map((a:any)=>[a.cost||[],a.damage||'',Boolean(a.effect)])])).digest('hex') : null);
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
async function get(path: string, ttl = TTL): Promise<any> {
  const file = join(CACHE, createHash('sha256').update(path).digest('hex') + '.json');
  try { const cached = JSON.parse(await readFile(file, 'utf8')); if (!force && Date.now() - cached.time < ttl) return cached.data; } catch {}
  let error;
  for (let retry = 0; retry < 5; retry++) {
    try {
      const response = await fetch(`https://api.tcgdex.net/v2/${path}`, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      const data = await response.json();
      await writeFile(file, JSON.stringify({ time: Date.now(), data }));
      return data;
    } catch (e) { error = e; await new Promise(r => setTimeout(r, 1000 * 2 ** retry)); }
  }
  throw error;
}
async function pool<T, R>(items: T[], fn: (item: T) => Promise<R>, limit = 6): Promise<R[]> {
  const result: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; result[i] = await fn(items[i]); }
  })); return result;
}
const artists = await Promise.all((await readdir('src/data/artists')).filter(f => f.endsWith('.json')).map(async f => JSON.parse(await readFile(join('src/data/artists', f), 'utf8'))));
// Exact credit matches only. Case/width/spacing variants are resolved against the API's own credit list.
const credits: Record<string, string[]> = {};
for (const lang of ['en', 'ja']) credits[lang] = await get(`${lang}/illustrators`);
const report: any[] = [];
const snapshots = await pool(artists, async artist => {
  const catalogs: any = {};
  let previous: any;
  try { previous = JSON.parse(await readFile(join(ROOT, artist.id + '.json'), 'utf8')); } catch {}

  for (const lang of ['en', 'ja']) {
    const names = [artist.name, ...(artist.tcgdexAliases || [])].map(normalize);
    const matches = credits[lang].filter(name => names.includes(normalize(name)));
    const lists = await Promise.all(matches.map(name => get(`${lang}/cards?illustrator=${encodeURIComponent('eq:' + name)}`)));
    const briefs: any[] = [...new Map(lists.flat().map((card: any) => [card.id, card])).values()];
    console.log(`${artist.id} ${lang}: ${briefs.length} cards`);
    const historical = new Map<string, any>((previous?.catalogs[lang] || []).map((card: any) => [card.id, card]));
    const details = await pool(briefs, async brief => {
      const old = historical.get(brief.id);
      const checkedAt = old?.detailsCheckedAt || previous?.updatedAt;
      if (!force && old && old.matchingKey !== undefined && Date.now() - Date.parse(checkedAt) < 30 * TTL && old.name === brief.name && old.image === (brief.image || null)) {
        return { ...old, localId: old.number, set: { id: old.setId, name: old.setName }, detailsCheckedAt: checkedAt };
      }
      // Lists refresh daily. Historical detail fields are stable; recheck them monthly,
      // or immediately when the daily list reports a changed name/image.
      let card = await get(`${lang}/cards/${encodeURIComponent(brief.id)}`, 30 * TTL);
      if (card.name !== brief.name || (card.image || null) !== (brief.image || null)) card = await get(`${lang}/cards/${encodeURIComponent(brief.id)}`, 0);
      return { ...card, detailsCheckedAt: new Date().toISOString() };
    }, 3);
    const setIds = [...new Set<string>(details.map(card => card.set.id))];
    const sets = new Map((await pool(setIds, id => get(`${lang}/sets/${encodeURIComponent(id)}`), 3)).map(set => [set.id, set]));
    const cards = details.filter(card => names.includes(normalize(card.illustrator || ''))).map(card => ({
      id: card.id, number: card.localId, name: card.name, image: card.image || null,
      matchingKey: matchingKey(card), detailsCheckedAt: card.detailsCheckedAt, illustrator: card.illustrator, rarity: card.rarity || null, language: lang,
      setId: card.set.id, setName: card.set.name, releaseDate: sets.get(card.set.id)?.releaseDate || null
    }));
    cards.sort(compareCards);
    const today = new Date().toISOString().slice(0, 10);
    const released = cards.filter(card => !card.releaseDate || card.releaseDate <= today);
    catalogs[lang] = released;
    report.push({ artist: artist.name, language: lang, cards: released.length, missingImages: released.filter(c => !c.image).length, missingDates: released.filter(c => !c.releaseDate).length, matchedCredits: matches });
  }
  return { artistId: artist.id, updatedAt: new Date().toISOString(), catalogs };
}, 2);
// Write only after the entire refresh succeeds; failed network runs preserve the last good snapshot.
for (const snapshot of snapshots) {
  const path = join(ROOT, snapshot.artistId + '.json');
  await writeFile(path + '.tmp', JSON.stringify(snapshot) + '\n');
  await rename(path + '.tmp', path);
}
await writeFile(join(ROOT, 'coverage.json'), JSON.stringify({ updatedAt: new Date().toISOString(), artists: report.sort((a,b) => a.artist.localeCompare(b.artist) || a.language.localeCompare(b.language)) }, null, 2) + '\n');
console.log('Refreshed metadata only; no images downloaded.');
