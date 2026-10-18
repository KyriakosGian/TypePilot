/* Read-only store-material checks. No dependencies, uploads, credentials, or live API calls. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { inflateRawSync } = require('node:zlib');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name));
const text = name => read(name).toString('utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
function block(document, heading) {
  const section = document.split(`## ${heading}\n`)[1]?.split('\n## ')[0];
  const value = section?.match(/```text\n([\s\S]*?)\n```/)?.[1];
  assert.ok(value, `Missing plain-text block: ${heading}`);
  return value;
}
function png(name, width, height) {
  const bytes = read(name);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${name}: invalid PNG`);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', `${name}: missing IHDR`);
  assert.equal(bytes.readUInt32BE(16), width, `${name}: width`);
  assert.equal(bytes.readUInt32BE(20), height, `${name}: height`);
}
function zipEntries(bytes) {
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {
      end = offset; break;
    }
  }
  assert.ok(end >= 0, 'Missing ZIP directory');
  assert.equal(bytes.readUInt16LE(end + 4), 0, 'Multi-disk ZIP is not supported');
  assert.equal(bytes.readUInt16LE(end + 6), 0);
  const count = bytes.readUInt16LE(end + 10);
  assert.equal(bytes.readUInt16LE(end + 8), count);
  assert.notEqual(count, 0xffff, 'ZIP64 is not supported');
  let cursor = bytes.readUInt32LE(end + 16);
  assert.equal(cursor + bytes.readUInt32LE(end + 12), end, 'ZIP directory size mismatch');
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50, 'Invalid ZIP directory entry');
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const packedSize = bytes.readUInt32LE(cursor + 20);
    const unpackedSize = bytes.readUInt32LE(cursor + 24);
    const nameSize = bytes.readUInt16LE(cursor + 28);
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameSize).replaceAll('\\', '/');
    const local = bytes.readUInt32LE(cursor + 42);
    cursor += 46 + nameSize + bytes.readUInt16LE(cursor + 30) + bytes.readUInt16LE(cursor + 32);
    assert.equal(flags & 1, 0, 'Encrypted ZIP entry');
    assert.ok(!name.startsWith('/') && !name.includes(':') && !name.split('/').includes('..'), 'Unsafe ZIP path');
    assert.equal(bytes.readUInt32LE(local), 0x04034b50, 'Invalid ZIP local header');
    assert.equal(bytes.readUInt16LE(local + 8), method, 'ZIP compression mismatch');
    if (name.endsWith('/')) continue;
    assert.ok(!entries.has(name), 'Duplicate ZIP path');
    assert.ok(unpackedSize < 5_000_000, 'Unexpectedly large runtime entry');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    assert.ok(start + packedSize <= bytes.length, 'ZIP data exceeds archive');
    const packed = bytes.subarray(start, start + packedSize);
    assert.ok(method === 0 || method === 8, 'Unsupported ZIP compression');
    const contents = method === 8 ? inflateRawSync(packed, { maxOutputLength: 5_000_000 }) : packed;
    assert.equal(contents.length, unpackedSize, 'ZIP entry size mismatch');
    entries.set(name, contents);
  }
  assert.equal(cursor, end, 'ZIP directory entry count mismatch');
  return entries;
}

const manifest = JSON.parse(text('manifest.json'));
const listing = text('store-assets/STORE-LISTING.md').replaceAll('\r\n', '\n');
const submission = text('store-assets/SUBMISSION.md');
const packageName = `TypePilot-v${manifest.version}.zip`;
const runtime = ['background.js', 'content.js', 'editor-state.js', 'x-post.js', 'manifest.json',
  'options.html', 'options.js', 'options.css', 'style.css', 'LICENSE', 'PRIVACY.md',
  ...[16, 32, 48, 128].map(size => `icons/icon${size}.png`),
  ...fs.readdirSync(path.join(root, 'vendor')).map(name => `vendor/${name}`)];

check('manifest metadata and prepared listing agree', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name.length > 0 && manifest.name.length <= 75);
  assert.ok(manifest.description.length > 0 && manifest.description.length <= 132);
  assert.equal(block(listing, 'Name'), manifest.name);
  assert.equal(block(listing, 'Short description'), manifest.description);
  assert.ok(listing.includes(`version ${manifest.version}`));
  assert.ok(submission.includes(`Version: ${manifest.version}`));
  assert.ok(block(listing, 'Detailed description').startsWith('TypePilot is a Chrome extension'));
  assert.ok(block(listing, 'Detailed description').length <= 16000);
});
check('permission justifications match the package', () => {
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['https://generativelanguage.googleapis.com/*']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['<all_urls>']);
  assert.ok(submission.includes('content_scripts.matches: <all_urls>'));
  assert.ok(submission.includes('### storage'));
  assert.ok(submission.includes('### https://generativelanguage.googleapis.com/*'));
  assert.ok(manifest.commands['fix-selection']);
});
check('current public copy, Settings, and privacy disclosures agree', () => {
  for (const name of ['README.md', 'index.html', 'options.html', 'scripts/github-release.cjs']) {
    assert.ok(!/Google Gemini Free|Get a free key/.test(text(name)), `${name}: misleading free-API wording`);
  }
  assert.ok(text('options.html').includes(`v${manifest.version}`));
  const structured = JSON.parse(text('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(structured.softwareVersion, manifest.version);
  assert.ok(structured.downloadUrl.endsWith(packageName));
  for (const name of ['README.md', 'index.html', 'options.html', 'store-assets/STORE-LISTING.md', 'PRIVACY.md']) {
    assert.ok(text(name).includes('Paid Services'), `${name}: missing separate API eligibility disclosure`);
  }
  assert.ok(text('PRIVACY.md').includes('not by a timed deletion job'));
  assert.ok(text('PRIVACY.md').includes('models-list endpoint'));
});
check('all eight upload images have the required dimensions', () => {
  png('store-assets/icon-128.png', 128, 128);
  png('store-assets/small-promo-440x280.png', 440, 280);
  png('store-assets/marquee-1400x560.png', 1400, 560);
  const shots = fs.readdirSync(path.join(root, 'store-assets/screenshots')).filter(name => name.endsWith('.png'));
  assert.equal(shots.length, 5);
  for (const name of shots) png(`store-assets/screenshots/${name}`, 1280, 800);
  for (const size of [16, 32, 48, 128]) png(`icons/icon${size}.png`, size, size);
  assert.equal(sha256(read('store-assets/icon-128.png')), sha256(read('icons/icon128.png')));
});
check('runtime contains no executable remote script or dynamic evaluation', () => {
  for (const name of runtime.filter(name => name.endsWith('.js'))) {
    assert.ok(!/\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(\s*['"`]/.test(text(name)), `${name}: dynamic evaluation`);
  }
  assert.ok(!/<script\b[^>]*\bsrc\s*=\s*["']https?:/i.test(text('options.html')));
  assert.ok(!JSON.stringify(manifest.content_security_policy || {}).includes('unsafe-eval'));
  assert.ok(!/<script\b/i.test(block(listing, 'Detailed description')));
});
check('prepared text and runtime have no apparent embedded credentials or private device paths', () => {
  for (const name of [...runtime.filter(name => /\.(?:js|html|css|md)$/.test(name)),
    'store-assets/STORE-LISTING.md', 'store-assets/SUBMISSION.md', 'store-assets/README.md']) {
    const value = text(name);
    assert.ok(!/AIza[\w-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value), `${name}: possible credential`);
    assert.ok(!/[A-Z]:[\\/]Users[\\/]|\/Users\/|\/home\/[a-z0-9_-]+\//i.test(value), `${name}: private device path`);
  }
});
check('ZIP checksum matches both checksum file and submission guide', () => {
  const digest = sha256(read(`release/${packageName}`));
  const line = text('release/SHA256SUMS.txt').trim().split(/\r?\n/).find(value => value.endsWith(`  ${packageName}`));
  assert.equal(line?.trim(), `${digest}  ${packageName}`);
  assert.ok(submission.includes(packageName));
  assert.ok(submission.includes(digest));
});
check('ZIP has only the exact current runtime files, with manifest at root', () => {
  const entries = zipEntries(read(`release/${packageName}`));
  assert.deepEqual([...entries.keys()].sort(), [...runtime].sort());
  for (const name of runtime) assert.equal(sha256(entries.get(name)), sha256(read(name)), `${name}: package differs from source`);
  assert.equal(JSON.parse(entries.get('manifest.json')).version, manifest.version);
});
async function onlineChecks() {
  const base = 'https://kyriakosgian.github.io/TypePilot/';
  const repo = 'https://github.com/KyriakosGian/TypePilot';
  const cases = [
    ['public homepage matches current version and API disclosures', base, bytes => {
      const value = bytes.toString();
      assert.ok(value.includes(`"softwareVersion": "${manifest.version}"`));
      assert.ok(value.includes('Paid Services') && !value.includes('Google Gemini Free'));
    }],
    ['public demo editor', `${base}store-assets/demo-page.html`, bytes => {
      assert.ok(bytes.toString().includes('contenteditable="true"'));
      assert.ok(!bytes.toString().includes('window.chrome'));
    }],
    ['public support page', `${repo}/issues`, () => {}],
    ['public privacy policy matches source', `https://raw.githubusercontent.com/KyriakosGian/TypePilot/main/PRIVACY.md`, bytes => {
      assert.equal(bytes.toString().replaceAll('\r\n', '\n'), text('PRIVACY.md').replaceAll('\r\n', '\n'));
    }],
    ['public GitHub About uses accurate BYOK copy', 'https://api.github.com/repos/KyriakosGian/TypePilot', bytes => {
      const about = JSON.parse(bytes).description;
      assert.ok(about.includes('your own API key') && !about.includes('Google Gemini Free'));
      assert.ok(about.includes('separate Google API costs'));
    }],
    ['published ZIP checksum', `${repo}/releases/download/v${manifest.version}/${packageName}`, bytes => {
      assert.equal(sha256(bytes), sha256(read(`release/${packageName}`)));
    }],
  ];
  await Promise.all(cases.map(async ([name, url, verify]) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      assert.ok(response.ok, `HTTP ${response.status}`);
      verify(Buffer.from(await response.arrayBuffer()));
      passed++; console.log(`PASS ${name}`);
    } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
  }));
}
(async () => {
  if (process.argv.includes('--online')) await onlineChecks();
  console.log(`${passed} store-material checks passed, ${failed} failed.`);
  console.log('These checks do not approve the listing, verify live Gemini access, or clear the manual submission gates.');
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
