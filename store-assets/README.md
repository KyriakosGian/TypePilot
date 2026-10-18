# TypePilot Chrome Web Store Assets

These files are prepared for the TypePilot 1.4.1 Chrome Web Store listing.

## Listing text and submission guide

- [STORE-LISTING.md](STORE-LISTING.md): copy-ready English description and listing fields.
- [SUBMISSION.md](SUBMISSION.md): permission justifications, data disclosures, private reviewer instructions, upload paths, and final checklist.
- [AUDIT.md](AUDIT.md): verified checks, resolved documentation discrepancies, and remaining manual submission gates.
- Run `node scripts/check-store.cjs` to verify the listing metadata, image dimensions, runtime ZIP contents, and SHA-256 checksum without uploading anything.
- Add `--online` to also check the public homepage, demo, support, privacy policy, and published package checksum. This makes public read-only HTTP requests, never a Gemini request or upload.

The files are preparation material, not evidence that the dashboard has been
filled out or the extension approved. Live API/site tests, account-only fields,
and Google API eligibility remain explicit in the checklist. The marketing and
privacy wording corrections are included in 1.4.1.

## Upload to the Store Listing

- Store icon: `icon-128.png`, 128x128 PNG.
- Small promo tile: `small-promo-440x280.png`, 440x280 PNG.
- Marquee promo image: `marquee-1400x560.png`, 1400x560 PNG.
- Screenshots: upload the five PNG files from `screenshots/` in numeric order. Each file is 1280x800.

The screenshots show the real 1.4.1 unpacked interface, including Post for X,
Copy result, and the Recovery selector. The fifth screenshot covers both
Personal Dictionary and Recovery. All editor text and settings are fictional.

## Privacy Policy URL

Use the public policy URL in the dashboard's dedicated privacy-policy field:

`https://github.com/KyriakosGian/TypePilot/blob/main/PRIVACY.md`

## Source Files

- `typepilot-icon-master.png` is the transparent master used for the extension and Store icon sizes.
- `promo-master.png` is the high-resolution source for the promotional images.
- `demo-page.html` is the neutral local page used to capture the real TypePilot interface. It is not part of the extension package.

To regenerate screenshots, run `tests/browser.cjs` with `TYPEPILOT_CAPTURE=1`
and an available Playwright Chromium. Captures run only after the editor checks
pass and use mocked Gemini responses in a temporary browser profile.

Do not upload the source files or `demo-page.html` to the Chrome Web Store listing.
