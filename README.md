# Pokira

A Japanese-first directory of Pokémon TCG illustrators and their original X announcements. Built with Astro, TypeScript, file-based JSON, and CSS. A Cloudflare Pages Function validates illustrator suggestions before email delivery.

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

The generated site is in `dist/`. Each artist record lives in `src/data/artists/<stable-id>.json`. Both language routes and homepage previews are generated from these records. Artist cards show separate X and Instagram links when those profiles are present; the card itself does not navigate. On phones, its six card thumbnails scroll horizontally. Search runs in the browser without a request.

## One-message update

In Codex, send:

> Add this tweet to the website: https://x.com/artist/status/1234567890123456789

Codex should follow [AGENTS.md](AGENTS.md): inspect the original post through permitted methods, verify the author and card announcement, run `npm run add-tweet -- <URL> --evidence <JSON> --publish`, then confirm the live Cloudflare deployment. The evidence JSON is created by Codex during the task; visitors and the site owner never edit it by hand.

For an artist already in the directory, the CLI can ingest a URL alone when official X oEmbed provides the author and enough text to classify the card type. A new artist also needs the illustrator credit as printed on the card and a verifiable credit source in the evidence file. The CLI calculates the publication date from the tweet ID. When oEmbed omits details or blocks access, Codex supplies only verified information in the evidence file. The CLI refuses ambiguous or unverified records and leaves the existing directory intact.

```sh
npm run add-tweet -- 'https://x.com/artist/status/1234567890123456789' --evidence /tmp/pokira-evidence.json --publish
```

Evidence shape:

```json
{
  "artistName": "Verified X display name, if needed",
  "cardCredit": "Illustrator credit printed on the card",
  "creditSource": "https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/series/example/123/",
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

`mediaIndices` is optional and selects card images from the original post when it also contains sketches or promotional material. The CLI reads public X embed media and profile-photo URLs; the homepage displays those X-hosted images and a separate X profile link. Original post URLs remain in the records for verification. `imageFiles` is optional. Without reuse permission, keep it absent. The site does not scrape around access limits or infer a license to store copies from public availability. Permitted local images are generated at up to 480, 960, and 1440 pixels wide, encoded as WebP, and stored in `public/images/announcements/`. The original image files are never committed by the CLI.

Profile links are independent of card evidence. An artist record may have an X `handle`, an Instagram `instagram` handle, or both; at least one is required. Each social link shows the platform icon and its own handle. The artist heading uses the printed card credit, with its official `creditSource` recorded separately. Add an Instagram handle only after verifying the artist owns that account, and record the verification page as `instagramSource`. Artists without X announcements need permitted local `gallery` images so their directory card has artwork. Jerky and rika have verified Instagram links; Ryota Murayama and Scav currently have X links only. Old artist URLs lead to the corresponding directory card so visitors can choose a profile.

For a new artist, the CLI derives a stable ID from their handle if none is supplied. Keep IDs stable so existing records and old links remain consistent. The image record stores its permission evidence. A typographic initial appears in the directory when an X profile photo cannot be reused.

## Deploy on Cloudflare Pages for free

The project is deployed at [pokira.pages.dev](https://pokira.pages.dev/) from the public `yugi-motta/Pokira` repository. Cloudflare Pages is connected to the `main` branch with the **Astro** preset, `npm run build`, `dist`, and `PUBLIC_SITE_URL=https://pokira.pages.dev`. Pushes to `main` trigger builds and deployments automatically.

To recreate the deployment in another account: create a free public GitHub repository, select **Import an existing Git repository** in Cloudflare Pages, choose the repository, set those build values and environment variable, then deploy.

Cloudflare Pages serves the directory and runs the suggestion endpoint. Card images depend on X's public image CDN being available in the visitor's browser.

## Illustrator suggestions

The suggestion modal accepts optional visitor name and email, plus a required illustrator name and a specific artwork post on X/Twitter or Instagram. Profile-only links are rejected. Suggestions are addressed to **pokirahelp@outlook.com** (configured in `src/lib/suggestions-config.ts`).

The Pages Functions at `functions/api/suggestions.ts` and `functions/api/contact.ts` validate submissions. Contact supports general inquiries, error corrections, and profile removal requests. With no Resend credentials configured, the functions return `forward`; the browser then sends to [Web3Forms' documented endpoint](https://docs.web3forms.com/getting-started/api-reference). The free plan supports 250 submissions per month across both forms. Its free transport must run in the browser; do not proxy it through a server.

The inbox owner must verify **pokirahelp@outlook.com** in Web3Forms and supply that form's access key. Set `contactAccessKey` and `suggestionAccessKey` in `src/lib/suggestions-config.ts` before deploying. This is a public form identifier intended for browser HTML, not an account password or a private API token. The key's verified inbox determines the recipient. No visitor data is forwarded when the key is missing.

After the provider confirms acceptance, the modal closes without moving the page and a localized toast appears for six seconds. Failed sends preserve the draft and never show a success toast. Both forms have a 30-second total deadline; a timeout explains that delivery could not be confirmed and gives the direct inbox address. Do not automatically retry timed-out sends, since the provider may already have accepted them.

Existing Resend delivery remains supported as an alternative. Configure both `SUGGESTIONS_FROM_EMAIL` (on a verified sending domain) and `RESEND_API_KEY` as production runtime values in Cloudflare Pages **Settings → Variables and Secrets**. The recipient remains pokirahelp@outlook.com. Keep private credentials out of Git. A failed Resend send is not retried through another provider, avoiding duplicate emails.

## Content verification

The records contain four artists and nineteen original X post URLs across physical TCG and TCG Pocket. Each record includes its specific verification URL under `source`. Card thumbnails and avatars are served from X's image CDN; no card art has been copied into this repository.

The validation command checks schema shape, unique IDs, unique X and Instagram handles, unique tweet IDs, dates against X's snowflake timestamp, and local image paths. The production build runs validation first.


### Japanese card galleries

Both interfaces show the same Japanese printings. Interface language changes names and UI text only. Public Japanese printing metadata is refreshed from [The Art of Pokémon](https://www.artofpkm.com/illustrators), with source links on each profile. Images resolve to the official Japanese Pokémon card search, existing Japanese TCGdex scans, and verified original illustrator posts; restricted reference-site images are never embedded. Existing Japanese TCGdex scans supplement unresolved printings; English-only scans are never displayed. `src/data/japanese-catalog/` contains metadata, not downloaded artwork.

`npm run refresh:cards` refreshes TCGdex and then runs `scripts/refresh-japanese.py` and `scripts/resolve-japanese-images.py`. The reference importer caches metadata, throttles requests, validates Japanese language markers, matches official collector numbers, and finishes all reads before replacing snapshots. GitHub Actions retains the cache and publishes only after build/tests pass. The viewer reuses the thumbnail immediately, warms the full image on hover/focus, and swaps it in without resizing or requesting a redundant PNG.

Pokémon filter IDs and localized species labels use the checked-in `src/data/pokemon-species.json`, derived from [PokéAPI species names](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv). Species filtering groups Mega/ex/V and other named variants; it also supports multi-Pokémon cards. Caption visibility and Pocket inclusion preferences are saved in the visitor’s browser.


Profiles now count unique illustrations, keeping the first displayed print of a shared artwork. `scripts/index-artwork.ts` analyzes public illustration crops in memory, caches numerical fingerprints, and checks in only `src/data/artwork-identities.json`; it does not copy image files into the site. Exact scan URLs and conservative crop matches group reprints/finishes without grouping solely by Pokémon name. Daily refresh includes this index before publishing. The expanded view uses a thumbnail-to-center transform. Profile thumbnails and expanded illustrations have fine-pointer perspective tilt and a subtle reflection; reduced-motion preferences disable these effects.
