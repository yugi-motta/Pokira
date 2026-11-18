import type { Artist } from './schema';
export const illustratorSearchText = (artist: Artist) => [artist.name,artist.japaneseName,artist.romanizedName,artist.handle,artist.instagram].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase();
export const matchesIllustrator = (text: string, query: string) => query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).every(word=>text.includes(word));
