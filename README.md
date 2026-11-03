# Pokira

A static Japanese-first directory of Pokémon TCG illustrators and their original X announcements. Built with Astro, TypeScript, file-based JSON, and CSS. No database, CMS, paid API, or image service is required.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
npm run build
npx astro check
```

The generated site is in `dist/`. Each artist record lives in `src/data/artists/<stable-id>.json`. Both language routes and homepage previews are generated from these records. Search runs in the browser without a request. Artist pages show every recorded announcement, newest first, and reveal more entries in groups of eight.

## One-message update

In Codex, send:

> Add this tweet to the website: https://x.com/artist/status/1234567890123456789

Codex should follow [AGENTS.md](AGENTS.md): inspect the original post through permitted methods, verify the author and card announcement, run `npm run add-tweet -- <URL> --evidence <JSON> --publish`, then confirm the live Cloudflare deployment. The evidence JSON is created by Codex during the task; visitors and the site owner never edit it by hand.

The CLI can ingest a URL alone when official X oEmbed provides the author and enough text to classify the card type. It calculates the publication date from the tweet ID. When oEmbed omits details or blocks access, Codex supplies only verified information in the evidence file. The CLI refuses ambiguous or unverified records and leaves the existing directory intact.

```sh
npm run add-tweet -- 'https://x.com/artist/status/1234567890123456789' --evidence /tmp/pokira-evidence.json --publish
```

Evidence shape:

```json
{
  "artistName": "Verified display name",
  "artistId": "stable-id-for-a-new-artist",
  "handle": "artist",
  "date": "2026-11-04",
  "pokemon": ["Verified Pokémon name"],
  "kind": "physical",
  "source": "https://x.com/artist/status/1234567890123456789",
  "imageFiles": [
    {
      "path": "/absolute/path/to/permitted-card-image.jpg",
      "alt": "Description of the card image",
      "permission": "URL or written record documenting permission to reproduce this image"
    }
  ]
}
```

`imageFiles` is optional. Without reuse permission, keep it absent. The site displays the original post through X's official embed and a direct link. It does not download image URLs from X, scrape around access limits, or infer a license from public availability. Local images are generated at up to 480, 960, and 1440 pixels wide, encoded as WebP, and stored in `public/images/announcements/`. Multiple images per post are supported. The original image files are never committed by the CLI.

For a new artist, the CLI derives a stable ID from their handle if none is supplied. To keep existing URLs permanent, do not change an ID once published. The image record stores its permission evidence. A typographic initial appears in the profile header when an X profile photo cannot be reused.

## Deploy on Cloudflare Pages for free

1. Create a free public GitHub repository and push this project to its `main` branch.
2. In Cloudflare Pages, choose **Connect to Git** and select that repository.
3. Set framework preset **Astro**, build command `npm run build`, and output directory `dist`.
4. Set `PUBLIC_SITE_URL` to the final origin, such as `https://your-project.pages.dev`, without a trailing slash.
5. Deploy. Subsequent pushes to `main` trigger Pages builds automatically.

No runtime server is needed. Cloudflare Pages and public GitHub repositories have free tiers, subject to their published limits and terms. X embeds depend on X being available in the visitor's browser; direct post links remain visible if an embed fails.

## Content verification

The starter records contain four artists and eleven original X post URLs. Their authors, dates, and announced cards were cross-checked against the linked contemporary [roundups](https://note.com/mobile_slime). Each record includes the specific roundup URL under `source`. No card art has been copied into this repository.

The validation command checks schema shape, unique IDs, unique handles, unique tweet IDs, dates against X's snowflake timestamp, and local image paths. The production build runs validation first.
