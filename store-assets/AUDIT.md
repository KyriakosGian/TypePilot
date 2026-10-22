# Chrome Web Store publication and maintenance review

Reviewed on October 18, 2026 against runtime version 1.4.1.

Publication update, October 22, 2026: the account owner received Google's
publication confirmation for TypePilot 1.4.1 with Public visibility. The
[Chrome Web Store listing](https://chromewebstore.google.com/detail/typepilot/ggbcehbgoodblpdpjgglbhfnkmjmhdcm)
was also checked directly and returned the public TypePilot page and version
1.4.1. README and the homepage now use the Store as the primary installation
route. The runtime, version, and published ZIP remain unchanged.

The original readiness review below was performed on October 18. Publication
is a separate event, not an inference from passing tests or a GitHub release.

## Verified

- 11 dependency-free regression tests passed, including an explicit cache-age/lookup-expiry check.
- 16 unpacked-extension Chromium checks passed in an isolated temporary profile with fictional text and mocked Gemini responses. They include Settings model discovery without editor text and desktop/mobile screenshot aspect ratios and horizontal overflow.
- The original eight local Store-material checks covered metadata alignment, permission descriptions, public-copy/privacy consistency, image dimensions, executable-code patterns, apparent credential/private-path patterns, ZIP checksum, and exact package/source agreement. The publication update adds a ninth check for the canonical Store installation route and the 500-character reviewer text limit.
- The optional `--online` mode now checks eight public endpoints after deployment: versioned homepage and Store CTA, demo editor, support page, exact privacy-policy source, GitHub About copy, Chrome Web Store listing, release-note Store link, and the downloaded release ZIP's checksum. It fails on stale deployed copy rather than merely accepting HTTP 200.
- The short description is 123 characters, within Chrome's 132-character limit. The interface exposes 25 translation targets, not 25 UI localizations.
- All eight Store images were inspected visually. The five screenshots are 1280 x 800. The Settings and Recovery screenshots were refreshed from 1.4.1 with neutral data. Store icon, small tile, and marquee dimensions match the prepared upload guide.
- The existing ZIP has its manifest at the root, includes runtime and third-party license files, and excludes tests, demo pages, Store preparation texts, Git data, and private credentials.
- SHA-256 for `TypePilot-v1.4.1.zip`: `04816DBC9C03876D09FFF5101AAB34E0BC595059A5AE1866985FC2BD8CC6225C`.
- The existing 1.4.0 ZIP retains SHA-256 `D0C73828C688570D742D6FEBB1D68EB5D46C7F514D90323A6F354BA31C70703F` and was not overwritten.

There were 35 passing local automated checks in the original review. The
updated suite contains 36 local checks plus eight public checks after
deployment. Syntax and whitespace checks also passed. The browser suite
requires permission to reach its isolated local fixture server. Image geometry
checks explicitly wait for lazy-loaded images to decode before comparing
aspect ratios. No live Gemini key or personal browser profile was used.

## Resolved in 1.4.1

1. Public marketing and intended audience. README, homepage metadata/hero,
   Settings, the release helper's GitHub About description, and the Store
   listing now distinguish the free extension from separate Google API costs
   and eligibility. They disclose adult, professional/business use and Paid
   Services requirements for the EEA, Switzerland, and UK. Publishing applies
   the matching About text. Source:
   [Gemini API terms](https://ai.google.dev/gemini-api/terms).
2. Privacy-policy precision. The policy now separately describes Settings'
   authenticated model-discovery request without editor text, actual cache
   reuse versus retention, user-provided sensitive text, and Google's own
   processing terms. Settings exposes these disclosures before use. No timed
   purge, additional telemetry, or new backend has been added.
3. Package integrity. The updated policy and Settings ship in a distinct
   1.4.1 archive. Action logic and editor replacement code remain unchanged.

## Manual checks for future updates

1. Real API and site tests. Automated tests do not establish current model
   access, quota, billing eligibility, or compatibility with signed-in X,
   Gmail, or WordPress editors. The account owner completes these manual tests
   using fictional text.
2. Private dashboard requirements. Confirm contact/account verification,
   publisher declarations, actual data-category definitions, distribution,
   and any separate restricted reviewer key inside Google's dashboard. No
   personal account data or working key belongs in this repository.

3. Distribution and Google eligibility. Confirm that the intended regions,
   adult audience, and API projects satisfy Google's applicable terms. A
   disclosure is not a technical verification of a user's billing account.
   No region or billing bypass is implemented.
4. Explicit approval. Do not submit a future update to the Chrome Web Store until the account
   owner confirms the live tests and authorizes that separate action.

## Repeat checks

Run `node --test tests/regression.test.cjs`, `node tests/browser.cjs` with an
available Playwright Chromium, and `node scripts/check-store.cjs --online`.
The last command only reads public URLs. Offline CI runs the nine local
Store checks and the existing regression/browser suites. A successful result
does not replace live API/site tests or authorize a future Store submission.
