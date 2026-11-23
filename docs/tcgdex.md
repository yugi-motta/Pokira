# Illustrator previews

Pokira helps visitors discover and follow illustrators. It shows a short selection of Japanese physical TCG cards, with a link to each illustrator's full collection on Art of Pokémon.

## Selection and image sources

- Profiles show at most 15 distinct illustrations. The homepage shows the first five from the same selection.
- Every displayed card image loads directly from `https://www.pokemon-card.com/assets/images/card_images/large/`. No card image is served by Pokira, X, TCGdex, CardCorpus, or another third-party image host.
- X remains the avatar source. Verified larger public avatar variants replace 96-pixel thumbnails where available; source resolution remains the upper limit.
- Images stay Japanese in both interface languages. Only the presentation text changes.
- Rarity is ordered from higher to lower tiers. Lower rarities fill remaining places; fewer than 15 appear when fewer distinct official images are available. Existing verified artwork identities prevent reprints from consuming preview slots. Within a shared-art group, the rarer printing is selected.
- Tiers are an editorial cross-era ordering, not a claim about comparable pack odds: MUR, BWR, UR, SAR, HR, CSR, SSR, SR, AR, CHR, S, RRR, RR, R, U, C, then unmarked/unknown cards. Date and collector number break ties deterministically.
- `src/data/preview-rarities.json` stores rarity metadata and its source. Official printed rarity symbols are verified for the preview candidates by `scripts/refresh-preview-rarities.py`. Existing TCGdex/CardCorpus metadata can supply labels outside the verified candidates; their image servers are never used.

## Profiles and search

The centered header emphasizes the illustrator's avatar and social links. There are no card counts, filters, or client-side pagination. A gradient over the final row carries a “See all” link to the illustrator's Art of Pokémon page in a new tab. The enlarged card viewer keeps its existing animation and tilt interaction.

Directory search and profile search sheets both provide a suggestion action after the results, including when there are no matches. Suggestions use the existing modal and submission flow.

## Refresh and validation

`npm run refresh:cards` refreshes metadata, resolves only official Japanese card images, verifies preview-candidate rarities, and updates artwork fingerprints. It stores metadata and numeric fingerprints, not card image copies. Refresh scripts complete their fetch/validation stage before replacing their output snapshots.

Run `npm run build`, `npm test`, and `npx astro check` after changes. The public per-illustrator JSON endpoints are capped to the same 15-item preview as the page; changing interface language cannot change its image membership or order.

Production is published through the existing GitHub-to-Cloudflare Pages integration. Source changes are pushed and deployed only when the user requests publication.
