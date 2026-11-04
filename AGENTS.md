# Pokira update workflow

When the user says “Add this tweet to the website: <URL>”, handle the complete update without asking them to edit files.

1. Check `git status` and the configured remote. Preserve unrelated changes.
2. Normalize the X URL. Verify the post through official X access, an accessible original post, or a reputable page that directly quotes and links to the post. Confirm the original author made the card illustration. Exclude reposts, unrelated posts, and announcements of someone else's artwork.
3. Check `src/data/artists/` for the X handle and tweet ID. Never create duplicate artists or tweets. Check whether the announced card is a new distinct illustration before adding the same card again.
4. Identify the card type (`physical` or `pocket`), date, Pokémon names, and artist display name from verifiable material. Do not invent missing facts or translate the post text. A new artist ID should remain stable forever.
5. Inspect the original post's public X embed images and choose images showing the announced cards. The CLI reads public X embed media and avatar URLs for the homepage. If the post has extra images, set `mediaIndices` in evidence to select the card images, using zero-based positions. Do not use restricted retrieval methods. Store local optimized copies only if reuse permission is documented; otherwise use X-hosted images with the profile's original-post link and X embed.
6. Create a temporary evidence JSON and run `npm run add-tweet -- '<URL>' --evidence <path> --publish`. The script normalizes the URL, checks duplicates and identity, optimizes permitted images, validates, builds, commits, and pushes. If X oEmbed supplies all required information, the evidence file can be omitted.
7. Run `npx astro check` if any code changed. Verify the Cloudflare Pages deployment for the pushed commit when access is available. Report the live URL and any X embed or permission limitations.
8. If the original post is inaccessible, report exactly which fact or image permission is missing and request only that material. Do not add a partial or fabricated record. A failed run must leave existing records intact.

The repository is intentionally file based. Adding an announcement never requires editing a page or component.
