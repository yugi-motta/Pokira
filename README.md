# Pokira

A Japanese-first directory of Pokémon TCG illustrators and their original X announcements. Built with Astro, TypeScript, file-based JSON, and CSS. A Cloudflare Pages Function handles artist suggestions once email delivery is configured.

**Live site:** https://pokira.pages.dev/  
**Source:** https://github.com/yugi-motta/Pokira

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
npm run build
npx astro check
```

The generated site is in `dist/`. Each artist record lives in `src/data/artists/<stable-id>.json`. Both language routes and homepage previews are generated from these records. Each artist card opens that artist's X profile in a new tab. On phones, its six card thumbnails scroll horizontally. Search runs in the browser without a request.

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
  "mediaIndices": [0, 1],
  "imageFiles": [
    {
      "path": "/absolute/path/to/permitted-card-image.jpg",
      "alt": "Description of the card image",
      "permission": "URL or written record documenting permission to reproduce this image"
    }
  ]
}
```

`mediaIndices` is optional and selects card images from the original post when it also contains sketches or promotional material. The CLI reads public X embed media and profile-photo URLs; the homepage displays those X-hosted images and links to the artist's X profile. Original post URLs remain in the records for verification. `imageFiles` is optional. Without reuse permission, keep it absent. The site does not scrape around access limits or infer a license to store copies from public availability. Permitted local images are generated at up to 480, 960, and 1440 pixels wide, encoded as WebP, and stored in `public/images/announcements/`. The original image files are never committed by the CLI.

For a new artist, the CLI derives a stable ID from their handle if none is supplied. Keep IDs stable so existing records and old links remain consistent. The image record stores its permission evidence. A typographic initial appears in the directory when an X profile photo cannot be reused.

## Deploy on Cloudflare Pages for free

The project is deployed at [pokira.pages.dev](https://pokira.pages.dev/) from the public `yugi-motta/Pokira` repository. Cloudflare Pages is connected to the `main` branch with the **Astro** preset, `npm run build`, `dist`, and `PUBLIC_SITE_URL=https://pokira.pages.dev`. Pushes to `main` trigger builds and deployments automatically.

To recreate the deployment in another account: create a free public GitHub repository, select **Import an existing Git repository** in Cloudflare Pages, choose the repository, set those build values and environment variable, then deploy.

Cloudflare Pages serves the directory and runs the suggestion endpoint. Card images depend on X's public image CDN being available in the visitor's browser.

## Artist suggestions

The small form below the directory accepts optional visitor name and email, plus a required artist X profile and an original X post showing the artist's work. Both links must be HTTPS X/Twitter URLs from the same handle. The Pages Function at `functions/api/suggestions.ts` validates them and sends a plain-text email through Resend.

The inbox does not exist yet, so email delivery is intentionally unconfigured. Until setup is complete, the endpoint returns `503` and the form tells visitors that the inbox is not ready; it never claims a suggestion was sent. When the address is ready, verify a sending domain with Resend and add these production runtime variables in Cloudflare Pages **Settings → Variables and Secrets**, then redeploy:

```text
SUGGESTIONS_TO_EMAIL=your-real-inbox@example.com
SUGGESTIONS_FROM_EMAIL=Pokira <suggestions@your-verified-domain.example>
RESEND_API_KEY=re_your_secret_key
```

The values in `.env.example` are placeholders only. Keep the API key in Cloudflare Secrets, not in Git. The form will begin sending as soon as the three real values are present.

## Content verification

The records contain four artists and nineteen original X post URLs across physical TCG and TCG Pocket. Each record includes its specific verification URL under `source`. Card thumbnails and avatars are served from X's image CDN; no card art has been copied into this repository.

The validation command checks schema shape, unique IDs, unique handles, unique tweet IDs, dates against X's snowflake timestamp, and local image paths. The production build runs validation first.
