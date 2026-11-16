export type Lang = 'ja' | 'en';

export const copy = {
  ja: {
    siteTitle: 'Pokira',
    siteDescription: 'ポケモンカードのイラストレーターと、その作品を紹介する非公式アーカイブ。',
    directory: 'イラストレーター',
    search: '作家を検索',
    searchLabel: 'イラストレーターを検索',
    noResults: '該当する作家が見つかりません。',
    sort: '名前順',
    profile: 'Xのプロフィール',
    suggestArtist: '作家を提案する',
    yourName: 'お名前',
    yourEmail: 'メールアドレス',
    optional: '任意',
    artistXLink: '作家のXプロフィール',
    artistPostLink: '作品を紹介したX投稿',
    sendSuggestion: '提案を送る',
    sendingSuggestion: '送信中…',
    suggestionSent: '提案を送信しました。',
    suggestionsUnavailable: '受付メールの準備ができていません。後ほどお試しください。',
    suggestionFailed: '送信できませんでした。後ほどお試しください。',
    invalidXLink: '有効なXのリンクを入力してください。',
    linkMismatch: '投稿は同じ作家のXアカウントから選んでください。',
    unofficial: '非公式の独立したプロジェクトです。Pokémon および関連会社とは関係ありません。',
    language: '言語を選択'
  },
  en: {
    siteTitle: 'Pokira',
    siteDescription: 'An independent archive of Pokémon card illustrators and their original announcements.',
    directory: 'Illustrators',
    search: 'Search artists',
    searchLabel: 'Search illustrators',
    noResults: 'No illustrators found.',
    sort: 'Name order',
    profile: 'X profile',
    suggestArtist: 'Suggest an artist',
    yourName: 'Your name',
    yourEmail: 'Email',
    optional: 'Optional',
    artistXLink: "Artist's X profile",
    artistPostLink: 'X post showing their work',
    sendSuggestion: 'Send suggestion',
    sendingSuggestion: 'Sending…',
    suggestionSent: 'Suggestion sent.',
    suggestionsUnavailable: 'The suggestion inbox is not ready yet. Please try again later.',
    suggestionFailed: 'Could not send your suggestion. Please try again later.',
    invalidXLink: 'Enter a valid X link.',
    linkMismatch: "The post must be from the artist's X account.",
    unofficial: 'Independent, unofficial project. Not affiliated with Pokémon or its associated companies.',
    language: 'Select language'
  }
} as const;

export const pathFor = (lang: Lang) => `${lang === 'en' ? '/en' : ''}/`;
