export type Lang = 'ja' | 'en';

export const copy = {
  ja: {
    siteTitle: 'Pokira',
    siteDescription: 'ポケモンカードのイラストレーターと、その作品を紹介する非公式アーカイブ。',
    directory: 'イラストレーター',
    search: '作家名・X ID・ポケモン名で検索',
    searchLabel: 'イラストレーターを検索',
    noResults: '該当する作家が見つかりません。',
    sort: '名前順',
    all: 'すべて',
    profile: 'Xのプロフィール',
    original: 'Xで投稿を見る',
    originalEmbed: '元の投稿',
    viewPost: '投稿を見る',
    announcements: '作品の投稿',
    artwork: 'カードイラスト',
    showMore: 'さらに表示',
    back: '一覧へ戻る',
    unofficial: '非公式の独立したプロジェクトです。Pokémon および関連会社とは関係ありません。',
    embedUnavailable: '投稿が表示されない場合は、Xで原文をご覧ください。',
    pocket: 'ポケポケ',
    physical: 'ポケモンカード',
    language: '言語を選択',
    artistMeta: (name: string) => `${name}のポケモンカードイラストと本人によるX投稿。`
  },
  en: {
    siteTitle: 'Pokira',
    siteDescription: 'An independent archive of Pokémon card illustrators and their original announcements.',
    directory: 'Illustrators',
    search: 'Search artist, X handle, or Pokémon',
    searchLabel: 'Search illustrators',
    noResults: 'No illustrators found.',
    sort: 'Name order',
    all: 'All',
    profile: 'X profile',
    original: 'View original on X',
    originalEmbed: 'Original post',
    viewPost: 'View post',
    announcements: 'Announcements',
    artwork: 'Card artwork',
    showMore: 'Show more',
    back: 'Back to directory',
    unofficial: 'Independent, unofficial project. Not affiliated with Pokémon or its associated companies.',
    embedUnavailable: 'If the post does not appear, view the original on X.',
    pocket: 'TCG Pocket',
    physical: 'Pokémon TCG',
    language: 'Select language',
    artistMeta: (name: string) => `Pokémon card illustrations and original X announcements by ${name}.`
  }
} as const;

export const pathFor = (lang: Lang, artistId?: string) =>
  `${lang === 'en' ? '/en' : ''}${artistId ? `/artists/${artistId}` : ''}/`;
