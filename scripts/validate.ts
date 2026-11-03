import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { artistSchema } from '../src/lib/schema';

const directory = resolve('src/data/artists');
const ids = new Set<string>();
const handles = new Set<string>();
const tweets = new Set<string>();
let artistCount = 0;
let postCount = 0;

for (const filename of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(join(directory, filename), 'utf8'));
  const artist = artistSchema.parse(raw);
  if (filename !== `${artist.id}.json`) throw new Error(`Filename and artist ID differ: ${filename}`);
  if (ids.has(artist.id)) throw new Error(`Duplicate artist ID: ${artist.id}`);
  if (handles.has(artist.handle.toLowerCase())) throw new Error(`Duplicate X handle: ${artist.handle}`);
  ids.add(artist.id);
  handles.add(artist.handle.toLowerCase());
  artistCount++;
  for (const post of artist.announcements) {
    const expected = `https://x.com/${artist.handle}/status/${post.tweetId}`;
    if (post.url.toLowerCase() !== expected.toLowerCase()) throw new Error(`Post URL mismatch: ${post.url}`);
    if (tweets.has(post.tweetId)) throw new Error(`Duplicate tweet: ${post.tweetId}`);
    tweets.add(post.tweetId);
    postCount++;
    const timestamp = Number(BigInt(post.tweetId) >> 22n) + 1288834974657;
    if (timestamp > Date.now() + 86400000) throw new Error(`Future tweet ID: ${post.tweetId}`);
    if (Math.abs(new Date(post.date).getTime() - timestamp) > 86400000) {
      throw new Error(`Tweet date does not match ID: ${post.tweetId}`);
    }
    for (const image of post.images) {
      if (!existsSync(resolve('public', image.src.slice(1)))) throw new Error(`Missing image: ${image.src}`);
      for (const variant of image.variants) {
        if (!existsSync(resolve('public', variant.src.slice(1)))) throw new Error(`Missing image variant: ${variant.src}`);
      }
    }
  }
}
if (!artistCount) throw new Error('No artists found');
console.log(`Validated ${artistCount} artists and ${postCount} announcements.`);
