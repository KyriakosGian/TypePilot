# TypePilot Chrome Web Store Assets

These files are prepared for the TypePilot 1.4.0 Chrome Web Store listing.

## Upload to the Store Listing

- Store icon: `icon-128.png`, 128x128 PNG.
- Small promo tile: `small-promo-440x280.png`, 440x280 PNG.
- Marquee promo image: `marquee-1400x560.png`, 1400x560 PNG.
- Screenshots: upload the five PNG files from `screenshots/` in numeric order. Each file is 1280x800.

The screenshots show the real 1.4.0 unpacked interface, including Post for X,
Copy result, and the Recovery selector. The fifth screenshot covers both
Personal Dictionary and Recovery. All editor text and settings are fictional.

## Privacy Policy URL

After `PRIVACY.md` is pushed to the public repository, use:

`https://github.com/KyriakosGian/TypePilot/blob/main/PRIVACY.md`

## Source Files

- `typepilot-icon-master.png` is the transparent master used for the extension and Store icon sizes.
- `promo-master.png` is the high-resolution source for the promotional images.
- `demo-page.html` is the neutral local page used to capture the real TypePilot interface. It is not part of the extension package.

To regenerate screenshots, run `tests/browser.cjs` with `TYPEPILOT_CAPTURE=1`
and an available Playwright Chromium. Captures run only after the editor checks
pass and use mocked Gemini responses in a temporary browser profile.

Do not upload the source files or `demo-page.html` to the Chrome Web Store listing.
