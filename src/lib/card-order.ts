export function compareCards(a: { releaseDate: string | null; number: string; id: string }, b: { releaseDate: string | null; number: string; id: string }) {
  return (b.releaseDate || '').localeCompare(a.releaseDate || '') || a.number.localeCompare(b.number, 'en', { numeric: true }) || a.id.localeCompare(b.id, 'en');
}
