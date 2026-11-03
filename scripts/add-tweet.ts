import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { artistSchema } from '../src/lib/schema';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
if (!input) throw new Error('Usage: npm run add-tweet -- <X URL> [--evidence path.json] [--publish]');
const evidenceIndex = args.indexOf('--evidence');
const evidencePath = evidenceIndex >= 0 ? args[evidenceIndex + 1] : undefined;
const publish = args.includes('--publish');
const parsed = new URL(input);
if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(parsed.hostname)) throw new Error('Expected an X post URL');
const match = parsed.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{15,20})(?:\/|$)/);
if (!match) throw new Error('Expected URL format: https://x.com/handle/status/123...');
const [, inputHandle, tweetId] = match;
const tweetUrl = `https://x.com/${inputHandle}/status/${tweetId}`;
const dataDir = resolve('src/data/artists');
const records = readdirSync(dataDir).filter((name) => name.endsWith('.json')).map((name) => ({
  name,
  data: artistSchema.parse(JSON.parse(readFileSync(join(dataDir, name), 'utf8')))
}));
if (records.some(({ data }) => data.announcements.some((post) => post.tweetId === tweetId))) throw new Error(`Tweet already exists: ${tweetUrl}`);

let official: { author_name?: string; author_url?: string; html?: string } | undefined;
try {
  const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true&dnt=true`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
  if (response.ok) official = await response.json();
} catch { /* X may block access; evidence can be supplied by Codex. */ }

type Evidence = {
  artistName?: string;
  artistId?: string;
  romanizedName?: string;
  handle?: string;
  date?: string;
  pokemon?: string[];
  kind?: 'physical' | 'pocket';
  source?: string;
  imageFiles?: { path: string; alt: string; permission: string }[];
};
const evidence: Evidence = evidencePath ? JSON.parse(readFileSync(resolve(evidencePath), 'utf8')) : {};
const officialHandle = official?.author_url?.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)/)?.[1];
const handle = officialHandle || evidence.handle;
if (!handle || handle.toLowerCase() !== inputHandle.toLowerCase()) {
  throw new Error('Cannot verify the original author. Supply an evidence JSON with the verified handle, or retry when X oEmbed is available.');
}
const existing = records.find(({ data }) => data.handle.toLowerCase() === handle.toLowerCase());
const name = existing?.data.name || official?.author_name || evidence.artistName;
if (!name) throw new Error('Artist name is unavailable. Supply artistName in evidence JSON.');
if (evidence.artistName && official?.author_name && evidence.artistName !== official.author_name && !existing) {
  throw new Error('Artist name conflicts with official X oEmbed.');
}
const id = existing?.data.id || evidence.artistId || handle.toLowerCase().replaceAll('_', '-');
if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error('New artist requires a stable artistId in evidence JSON.');
if (!existing && records.some(({ data }) => data.id === id)) throw new Error(`Artist ID already exists: ${id}`);
const date = evidence.date || new Date(Number(BigInt(tweetId) >> 22n) + 1288834974657).toISOString().slice(0, 10);
const postText = official?.html?.replace(/<[^>]*>/g, ' ').replace(/&[^;]+;/g, ' ') || '';
const inferredKind = /ポケポケ|Trading Card Game Pocket/i.test(postText)
  ? 'pocket'
  : /ポケモンカードゲーム|Pokémon TCG|Pokemon TCG/i.test(postText)
    ? 'physical'
    : undefined;
const kind = evidence.kind || inferredKind;
if (!kind) throw new Error('Cannot verify whether this is a physical card or TCG Pocket announcement. Supply kind in evidence JSON.');
if (!evidence.source && !official) throw new Error('X oEmbed is unavailable. Supply a public verification source URL in evidence JSON.');
if (evidence.imageFiles?.some((image) => !image.permission.trim())) throw new Error('Every local image requires permission evidence.');

const images: { src: string; width: number; height: number; variants: { src: string; width: number }[]; alt: string; permission: string }[] = [];
const created: string[] = [];
const target = join(dataDir, `${id}.json`);
const originalContents = existsSync(target) ? readFileSync(target, 'utf8') : undefined;
try {
  for (const [index, image] of (evidence.imageFiles || []).entries()) {
    const file = resolve(image.path);
    if (!existsSync(file)) throw new Error(`Image file missing: ${file}`);
    if (!['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(extname(file).toLowerCase())) throw new Error(`Unsupported image format: ${file}`);
    const outputDir = resolve('public/images/announcements', id);
    mkdirSync(outputDir, { recursive: true });
    const metadata = await sharp(file).metadata();
    const originalWidth = metadata.orientation && metadata.orientation >= 5 ? metadata.height : metadata.width;
    if (!originalWidth) throw new Error(`Cannot determine image width: ${file}`);
    const widths = [...new Set([480, 960, 1440].map((width) => Math.min(width, originalWidth)))];
    const variants: { src: string; width: number }[] = [];
    let largest: { src: string; width: number; height: number } | undefined;
    for (const width of widths) {
      const src = `/images/announcements/${id}/${tweetId}-${index + 1}-${width}.webp`;
      const target = resolve('public', src.slice(1));
      if (existsSync(target)) throw new Error(`Image already exists: ${target}`);
      const result = await sharp(file).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(target);
      created.push(target);
      variants.push({ src, width: result.width });
      largest = { src, width: result.width, height: result.height };
    }
    if (!largest) throw new Error(`Could not optimize image: ${file}`);
    images.push({ ...largest, variants, alt: image.alt, permission: image.permission });
  }
  const artist = existing ? structuredClone(existing.data) : { id, name, handle, announcements: [] };
  if (evidence.romanizedName && !('romanizedName' in artist)) Object.assign(artist, { romanizedName: evidence.romanizedName });
  artist.announcements.push({
    url: `https://x.com/${handle}/status/${tweetId}`,
    tweetId,
    date,
    pokemon: evidence.pokemon || [],
    kind,
    source: evidence.source || tweetUrl,
    images
  });
  artist.announcements.sort((a, b) => b.date.localeCompare(a.date) || b.tweetId.localeCompare(a.tweetId));
  const valid = artistSchema.parse(artist);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, JSON.stringify(valid, null, 2) + '\n');
  try {
    renameSync(temporary, target);
    execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  } catch (error) {
    rmSync(temporary, { force: true });
    if (originalContents !== undefined) writeFileSync(target, originalContents);
    else rmSync(target, { force: true });
    throw error;
  }
} catch (error) {
  created.forEach((path) => rmSync(path, { force: true }));
  throw error;
}
if (publish) {
  execFileSync('git', ['add', target, ...created], { stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', `Add X announcement ${tweetId}`], { stdio: 'inherit' });
  execFileSync('git', ['push'], { stdio: 'inherit' });
}
console.log(`Added ${tweetUrl} to ${id}.`);
