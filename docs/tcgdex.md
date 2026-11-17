# TCGdex catalog

Pokira uses TCGdex REST v2 metadata and external TCGdex image URLs. X records are retained for identity/evidence and avatars, but no longer provide displayed card images.

## Refresh and publishing

Run `npm run refresh:cards` to refresh metadata; `-- --force` bypasses the request cache. Only JSON is downloaded. Then run `npm run build && npm test`.

The GitHub Actions `Refresh TCGdex metadata` workflow runs daily at 19:23 UTC (04:23 Japan time) and can be run manually. It caches API responses, refreshes the catalog, builds and tests it, then commits the new snapshots to main. Cloudflare Pages' existing main-branch integration deploys that commit. A failed fetch aborts before replacing the snapshots; a failed build/test prevents publication.

Daily illustrator credit lists and card associations identify new/removed cards. Daily card lists detect image/name changes. Detailed historical card fields are cached for 30 days, reusing their checked timestamps from the committed snapshot even on a fresh runner; changed image/name entries invalidate this cache immediately. Set metadata is refreshed daily. No visitor makes requests to TCGdex's API: pages and metadata are generated at build time. Galleries initially render 24 cards; filtering or loading more retrieves only that illustrator’s metadata and renders 24 images at a time.

## Matching, ordering, and languages

Illustrator credits are matched exactly after Unicode width, case, and whitespace normalization. Optional `tcgdexAliases` in the illustrator JSON can explicitly allow verified alternate credits. No fuzzy-name matching is used. The card detail credit is checked again before indexing.

Both interfaces share one deterministic union of the English and Japanese catalogs. Unambiguous reciprocal edition matches are grouped; unpaired language-exclusive printings remain in the union. A group is visible if either edition has an image. Canonical IDs and canonical release-date/number ordering are identical in both interfaces; language only selects localized metadata and the preferred available image. Uncertain matches are preserved as separate source printings rather than merged incorrectly.

The inclusion checkbox defaults to checked, so both languages show exactly the same card count and membership. Unchecking it explicitly limits the view to entries with an image in the current language. Fallback images carry a language badge and the enlarged viewer displays the pictured edition's metadata. Records without an image in either edition stay in the raw snapshot but are not shown as empty tiles.

Default ordering uses the canonical English printing where present (otherwise Japanese), with its actual set endpoint releaseDate descending, then collector number (numeric-aware ascending), then canonical ID ascending. Thus language switching also preserves default ordering. The viewer always describes the pictured printing. Unknown dates sort last; future releases are excluded until the daily refresh after release. The homepage takes the first six entries with an API-provided image. Raw snapshots preserve all records; visible galleries include cards with a usable image in the preferred language or a matching other-language edition. Cards are never replaced by an unrelated illustration.

## Coverage at initial import

See `src/data/tcgdex/coverage.json` for per-illustrator counts and the refresh timestamp. At import there were 2,904 English records (218 without image URLs) and 1,315 Japanese records (810 without image URLs), covering all 25 active illustrators. TCGdex's Japanese inventory and image coverage are incomplete, particularly older sets. Every returned record has a set release date in this import.

Japanese available-image counts below six: LINNE 5, mashu 4, Narano 4, USGMEN 3, Yoko Hishida 1, Yoshinobu Saito 0. Cross-language fallbacks can fill some of these gaps. Records without a safely matched available image are not displayed.

Cross-language equivalence is never based on Pokémon names alone: one Pokémon can have multiple distinct illustrations. TCGdex availability determines coverage, and source records may change with future refreshes.

Profile URLs are `/{id}/` and `/en/{id}/`. Permanent redirects preserve the former `/artists/{id}/` links. Set/rarity/name filters and newest/oldest/name/number ordering work across the full usable collection, not just the first page.
