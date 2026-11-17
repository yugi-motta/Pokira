import { artistSchema, type Artist, type Announcement } from './schema';
export type { Artist, Announcement } from './schema';

const files = import.meta.glob('../data/artists/*.json', { eager: true, import: 'default' });
export const artists: Artist[] = Object.values(files)
  .map((file) => artistSchema.parse(file))
  .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

export const newest = (posts: Announcement[]) =>
  [...posts].sort((a, b) => b.date.localeCompare(a.date) || b.tweetId.localeCompare(a.tweetId));
