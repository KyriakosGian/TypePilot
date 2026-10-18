# Bundled third-party code

`twitter-text.js` is the official twitter-text 3.1.0 browser distribution from
https://github.com/twitter/twitter-text/blob/master/js/pkg/twitter-text-3.1.0.js.
It is packaged locally and makes no network requests during post validation.

The only modification replaces the legacy dynamic `Function` global lookup with
`globalThis`, so the extension does not require `unsafe-eval`.

Twitter's distribution is licensed under Apache-2.0, included as
`twitter-text-LICENSE.txt`. Embedded twemoji-parser code is MIT licensed, with
its notice included as `twemoji-parser-LICENSE.txt`. The embedded core-js 2.6.10 polyfills are MIT licensed, with
their notice included as `core-js-LICENSE.txt`.

Embedded punycode.js 1.4.1 and Lodash are MIT licensed, with their notices
included as `punycode-LICENSE.txt` and `lodash-LICENSE.txt`.
