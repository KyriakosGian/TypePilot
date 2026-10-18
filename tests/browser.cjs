/* Real unpacked-extension tests. No personal browser profile or live Gemini requests. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.TYPEPILOT_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, '.test-artifacts');
const contentTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
let context;
let page;
let worker;
let extensionId;
let failures = 0;
let passed = 0;
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (pathname === '/frame') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><html><body><label>Nested message<textarea id="nested">Before teh after.</textarea></label></body></html>');
    return;
  }
  const filename = path.resolve(root, pathname === '/fixture' ? 'tests/fixtures/editors.html' : `.${pathname}`);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filename)] || 'text/plain' });
  fs.createReadStream(filename).pipe(response);
});

async function configure(config = {}) {
  await worker.evaluate(value => { globalThis.__typepilotTestConfig = value; }, config);
}
async function fixture() {
  await configure();
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
  await page.locator('#native').waitFor();
}
async function selectNative(locator, start = 7, end = 10) {
  await locator.evaluate((element, range) => {
    element.focus(); element.setSelectionRange(range.start, range.end);
    element.dispatchEvent(new Event('select', { bubbles: true }));
  }, { start, end });
}
async function selectRich(locator, all = false) {
  await locator.evaluate((element, entire) => {
    element.focus();
    const range = document.createRange();
    if (entire) range.selectNodeContents(element);
    else {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const index = node.nodeValue.indexOf('teh');
        if (index < 0) continue;
        range.setStart(node, index); range.setEnd(node, index + 3); break;
      }
    }
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }, all);
}
async function fix(scope = page) {
  await scope.getByRole('button', { name: 'Fix selected text', exact: true }).click();
  await scope.locator('.typepilot-popup__item-text').waitFor();
}
async function apply(scope = page) {
  await scope.locator('.typepilot-popup__item-text').click();
}
async function run(name, fn) {
  try { await fixture(); await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) {
    failures++; console.error(`FAIL ${name}: ${error.message}`);
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, `failure-${failures}.png`) }).catch(() => {});
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'typepilot-browser-'));
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    });
    await context.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', supportedGenerationMethods: ['generateContent'] }] }),
    }));
    worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    extensionId = new URL(worker.url()).host;
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ geminiApiKey: 'demo-key-not-a-real-credential', translationLanguage: 'de' });
      globalThis.fetch = async (_url, options) => {
        const config = globalThis.__typepilotTestConfig || {};
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, config.delay || 0);
          options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
        });
        const payload = JSON.parse(options.body);
        const original = payload.contents[0].parts[0].text.match(/<selected_text>\n([\s\S]*)\n<\/selected_text>/)[1];
        const result = config.result ?? original.replaceAll('teh', 'the').replace('timeline work for', 'timeline works for');
        return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ result }) }] } }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 } }), { headers: { 'Content-Type': 'application/json' } });
      };
    });
    page = await context.newPage();
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${server.address().port}` });

    await run('native replacement preserves unselected text', async () => {
      await selectNative(page.locator('#native')); await fix(); await apply();
      await page.locator('#typepilot-popup').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#native').inputValue(), 'Before the after.');
    });
    await run('stale AI result cannot overwrite newer native text', async () => {
      await configure({ delay: 200, result: 'fixed' });
      await selectNative(page.locator('#native'));
      await page.getByRole('button', { name: 'Fix selected text', exact: true }).click();
      await page.locator('#native').evaluate(element => { element.value = 'A newer draft.'; });
      await page.locator('.typepilot-popup__item-text').waitFor(); await apply();
      await page.getByText('The editor changed after this request.', { exact: false }).waitFor();
      assert.equal(await page.locator('#native').inputValue(), 'A newer draft.');
    });
    await run('rich replacement preserves prefix, suffix, and paragraphs after a DOM rerender', async () => {
      await selectRich(page.locator('#rich')); await fix();
      await page.locator('#rich').evaluate(element => { element.replaceChildren(...Array.from(element.childNodes, node => node.cloneNode(true))); });
      await apply(); await page.locator('#typepilot-popup').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#rich').innerText(), 'Before the after.\n\nSecond line.');
    });
    await run('loss of surrounding rich text triggers restoration', async () => {
      await selectRich(page.locator('#rich')); await fix();
      await page.locator('#rich').evaluate(element => {
        element.addEventListener('input', () => { element.textContent = 'the'; }, { once: true });
      });
      await apply(); await page.getByText('The editor rejected the complete replacement.', { exact: false }).waitFor();
      assert.equal(await page.locator('#rich').innerText(), 'Before teh after.\nSecond line.');
    });
    await run('blocked rich insertion does not undo user history', async () => {
      await selectRich(page.locator('#rich')); await fix();
      await page.locator('#rich').evaluate(element => { element.addEventListener('beforeinput', event => event.preventDefault(), { once: true }); });
      await apply(); await page.locator('.typepilot-popup__hint').filter({ hasText: /editor/ }).waitFor();
      assert.equal(await page.locator('#rich').textContent(), 'Before teh after.Second line.');
    });
    await run('plaintext-only editor supports replacement', async () => {
      await selectRich(page.locator('#plain')); await fix(); await apply();
      await page.locator('#typepilot-popup').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#plain').innerText(), 'Before the after.');
    });
    await run('full multiline rich selection preserves all paragraph text', async () => {
      await selectRich(page.locator('#rich'), true); await fix(); await apply();
      await page.locator('#typepilot-popup').waitFor({ state: 'hidden' });
      assert.match(await page.locator('#rich').innerText(), /Before the after\.[\n]+Second line\./);
    });
    await run('a disconnected editor cannot silently consume the result', async () => {
      await selectRich(page.locator('#rich')); await fix();
      await page.locator('#rich').evaluate(element => { element.replaceWith(element.cloneNode(true)); });
      await apply(); await page.getByText('The editor changed after this request.', { exact: false }).waitFor();
      assert.equal(await page.locator('#rich').textContent(), 'Before teh after.Second line.');
      assert.equal(await page.getByRole('button', { name: 'Copy result', exact: true }).isVisible(), true);
    });
    await run('a delayed editor clear attempts text restoration', async () => {
      await selectRich(page.locator('#rich')); await fix();
      await page.locator('#rich').evaluate(element => {
        element.addEventListener('input', () => { setTimeout(() => { element.textContent = ''; }, 15); }, { once: true });
      });
      await apply(); await page.getByText('The page rejected the replacement.', { exact: false }).waitFor();
      assert.equal(await page.locator('#rich').innerText(), 'Before teh after.\nSecond line.');
    });
    await run('Shadow DOM native field supports keyboard selection', async () => {
      const field = page.locator('#shadow-native'); await selectNative(field); await fix(); await apply();
      await page.locator('#typepilot-popup').waitFor({ state: 'hidden' });
      assert.equal(await field.inputValue(), 'Before the after.');
    });
    await run('iframe field receives Fix from the command message', async () => {
      const frame = page.frameLocator('iframe');
      await selectNative(frame.locator('#nested'));
      await worker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'TYPEPILOT_FIX_SELECTION' });
      });
      await frame.locator('.typepilot-popup__item-text').waitFor(); await apply(frame);
      await frame.locator('#typepilot-popup').waitFor({ state: 'hidden' });
      assert.equal(await frame.locator('#nested').inputValue(), 'Before the after.');
    });
    await run('Copy result works while automatic replacement leaves the clipboard untouched', async () => {
      await page.evaluate(() => navigator.clipboard.writeText('existing clipboard'));
      await selectNative(page.locator('#native')); await fix(); await apply();
      await page.locator('#typepilot-popup').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'existing clipboard');
      await page.locator('#native').fill('Before teh after.');
      await selectNative(page.locator('#native')); await fix();
      await page.getByRole('button', { name: 'Copy result', exact: true }).click();
      await page.getByText('Result copied. Paste it into your editor.').waitFor();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'the');
    });
    await run('X action accounts for the complete editor', async () => {
      await page.locator('#native').fill('p'.repeat(260) + ' old');
      await configure({ result: 'a'.repeat(30) });
      await selectNative(page.locator('#native'), 261, 264);
      await page.getByRole('button', { name: 'Open other TypePilot actions', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Post for X Fit 280 characters with hashtags', exact: true }).click();
      await page.getByText('X_POST_INVALID', { exact: true }).waitFor();
      assert.equal(await page.locator('#native').inputValue(), 'p'.repeat(260) + ' old');
    });
    await run('all five Recovery entries are selectable and clearable', async () => {
      const options = await context.newPage();
      await options.goto(`chrome-extension://${extensionId}/options.html#recovery-section`);
      await options.evaluate(async () => {
        await chrome.runtime.sendMessage({ type: 'TYPEPILOT_CLEAR_BACKUPS' });
        await Promise.all(Array.from({ length: 6 }, (_, i) => chrome.runtime.sendMessage({ type: 'TYPEPILOT_SAVE_BACKUP', selectedText: 'sample', fullText: `original draft ${i}`, action: 'fix' })));
      });
      await options.waitForFunction(() => document.querySelector('#recoveryBackup').options.length === 5);
      assert.equal(await options.locator('#recoveryBackup option').count(), 5);
      await options.locator('#recoveryBackup').selectOption({ index: 4 });
      await options.getByRole('button', { name: 'Copy Original', exact: true }).click();
      await options.getByText('Selected original text copied to the clipboard.').waitFor();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'original draft 1');
      await options.getByRole('button', { name: 'Clear Backups', exact: true }).click();
      await options.getByText('Recovery backups cleared.').waitFor();
      assert.equal(await options.locator('#recoveryBackup').isDisabled(), true);
      await options.close();
    });

    if (failures) throw new Error(`${failures} browser test(s) failed`);
    if (process.env.TYPEPILOT_CAPTURE === '1') {
      const shots = path.join(root, 'store-assets/screenshots');
      await configure({ result: 'Please review the attached proposal and let me know if the timeline works for your team.' });
      await page.goto(`http://127.0.0.1:${server.address().port}/store-assets/demo-page.html`);
      await page.locator('#message-editor p').nth(1).evaluate(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        element.parentElement.focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
      });
      await page.locator('#typepilot-btn').waitFor();
      await page.screenshot({ animations: 'disabled', path: path.join(shots, '01-fix-control-1280x800.png') });
      await page.getByRole('button', { name: 'Open other TypePilot actions', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Post for X Fit 280 characters with hashtags', exact: true }).waitFor();
      await page.screenshot({ animations: 'disabled', path: path.join(shots, '02-actions-menu-1280x800.png') });
      await page.keyboard.press('Escape'); await fix();
      await page.screenshot({ animations: 'disabled', path: path.join(shots, '03-result-1280x800.png') });
      const options = await context.newPage();
      await options.goto(`chrome-extension://${extensionId}/options.html`);
      await options.getByText('API key accepted by Google.', { exact: true }).waitFor();
      await options.screenshot({ animations: 'disabled', path: path.join(shots, '04-settings-1280x800.png') });
      await options.locator('#personalDictionary').fill('ExampleBrand\nProductCode-123\nTechnicalTerm');
      await options.evaluate(async () => {
        await chrome.runtime.sendMessage({ type: 'TYPEPILOT_SAVE_BACKUP', selectedText: 'teh project timeline', fullText: 'Please review teh project timeline.', action: 'fix' });
      });
      await options.locator('#recoveryBackup').waitFor({ state: 'visible' });
      await options.waitForFunction(() => !document.querySelector('#recoveryBackup').disabled);
      await options.locator('#dictionary-section').evaluate(element => element.scrollIntoView({ block: 'start' }));
      await options.screenshot({ animations: 'disabled', path: path.join(shots, '05-personal-dictionary-1280x800.png') });
      await options.close();
      console.log('Updated five neutral product screenshots.');
    }
    console.log(`${passed} browser checks passed.`);
  } finally {
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    // This directory was created by mkdtemp for this test only.
    if (profile.startsWith(path.join(os.tmpdir(), 'typepilot-browser-'))) fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
