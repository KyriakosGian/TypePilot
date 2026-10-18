const test = require('node:test');
const assert = require('node:assert/strict');
const { background } = require('./helpers.cjs');

test('X counts bare-domain URLs and NFC text using the official parser', () => {
  const bg = background();
  assert.equal(bg.evaluate("TypePilotX.length('a'.repeat(265) + ' x.com')"), 289);
  assert.equal(bg.evaluate("TypePilotX.length('cafe\\u0301')"), 4);
  assert.equal(bg.evaluate("TypePilotX.length('👨‍👩‍👧‍👦')"), 2);
});

test('X validates the complete editor, including unselected text', () => {
  const bg = background();
  assert.equal(bg.evaluate("TypePilotX.validate('old', 'a'.repeat(270), {prefix:'More text outside the selection. '}).valid"), false);
  assert.equal(bg.evaluate("TypePilotX.validate('old', 'new', {prefix:'Start ',suffix:' end'}).weightedLength"), 13);
});

test('X refuses changed links, missing mentions, and extra hashtags', () => {
  const bg = background();
  for (const code of [
    "TypePilotX.validate('Read https://example.org/a', 'Read https://example.org/b').valid",
    "TypePilotX.validate('Hello @Example', 'Hello').valid",
    "TypePilotX.validate('News', 'News #One #Two #Three').valid",
    "TypePilotX.checkBudget('https://example.org/a '.repeat(13)).valid",
  ]) assert.equal(bg.evaluate(code), false);
});

test('X retries one invalid result without truncating protected URLs', async () => {
  const bg = background();
  bg.evaluate(`globalThis.attempts = 0; callGeminiDirect = async () => ({result: ++attempts === 1 ? 'wrong link' : 'Read https://example.org/a', usage:{}, model:'test'});`);
  const result = await bg.evaluate("processXPost({text:'Read https://example.org/a',action:{instruction:'Polish'}},{})");
  assert.equal(result.result, 'Read https://example.org/a');
  assert.equal(bg.evaluate('attempts'), 2);
});

test('Recovery serializes concurrent saves and retains the five newest complete originals', async () => {
  const bg = background();
  const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => bg.send({ type: 'TYPEPILOT_SAVE_BACKUP', selectedText: 'sample', fullText: `draft ${index}` })));
  assert.ok(responses.every(result => result.success));
  const result = await bg.send({ type: 'TYPEPILOT_GET_BACKUPS' });
  assert.deepEqual(Array.from(result.backups, entry => entry.fullText), ['draft 7', 'draft 6', 'draft 5', 'draft 4', 'draft 3']);
  assert.equal(new Set(result.backups.map(entry => entry.id)).size, 5);
});

test('Recovery rejects oversized originals instead of silently truncating them', async () => {
  const bg = background();
  const result = await bg.send({ type: 'TYPEPILOT_SAVE_BACKUP', selectedText: 'sample', fullText: 'x'.repeat(100001) });
  assert.equal(result.success, false);
  assert.match(result.error, /100,000/);
  assert.equal((await bg.send({ type: 'TYPEPILOT_GET_BACKUPS' })).backups.length, 0);
});

test('Recovery reads and deletion are restricted to Settings', async () => {
  const bg = background();
  await bg.send({ type: 'TYPEPILOT_SAVE_BACKUP', selectedText: 'sample', fullText: 'original' });
  const webSender = { id: bg.chrome.runtime.id, url: 'https://example.org', tab: { id: 1 } };
  assert.equal((await bg.send({ type: 'TYPEPILOT_GET_BACKUPS' }, webSender)).success, false);
  assert.equal((await bg.send({ type: 'TYPEPILOT_CLEAR_BACKUPS' }, webSender)).success, false);
  assert.equal((await bg.send({ type: 'TYPEPILOT_GET_BACKUPS' })).backups.length, 1);
  await bg.send({ type: 'TYPEPILOT_CLEAR_BACKUPS' });
  assert.equal((await bg.send({ type: 'TYPEPILOT_GET_BACKUPS' })).backups.length, 0);
});

test('Timeout covers a response body that stalls after headers', async () => {
  let timeout;
  let signal;
  const bg = background({
    setTimeout(fn) { timeout = fn; return 1; },
    clearTimeout() {},
    fetch: async (_url, options) => ({ ok: true, json: () => new Promise((_resolve, reject) => {
      signal = options.signal;
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }) }),
  });
  const pending = bg.evaluate("callGeminiOnce({text:'sample',systemPrompt:'test',apiKey:'test',model:'test',action:{instruction:'fix'}})");
  await new Promise(setImmediate);
  assert.ok(signal);
  timeout();
  await assert.rejects(pending, error => error.code === 'TIMEOUT');
  assert.equal(signal.aborted, true);
});

test('Cancellation aborts a response body and stays isolated by tab/frame', async () => {
  const controllers = [];
  const bg = background({ fetch: async (_url, options) => ({ ok: true, json: () => new Promise((_resolve, reject) => {
    controllers.push(options.signal);
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }) }) });
  const first = { id: bg.chrome.runtime.id, tab: { id: 1 }, frameId: 0 };
  const second = { id: bg.chrome.runtime.id, tab: { id: 2 }, frameId: 0 };
  const pending = bg.send({ type: 'TYPEPILOT_PROCESS', requestId: 'same', text: 'sample' }, first);
  await new Promise(setImmediate);
  await bg.send({ type: 'TYPEPILOT_CANCEL', requestId: 'same' }, second);
  assert.equal(controllers[0].aborted, false);
  await bg.send({ type: 'TYPEPILOT_CANCEL', requestId: 'same' }, first);
  assert.equal((await pending).code, 'CANCELLED');
});

test('Fix command targets the current tab without additional host permissions', async () => {
  const bg = background();
  let received;
  bg.chrome.tabs.sendMessage = async (id, message) => { received = { id, message }; };
  await bg.command('fix-selection', { id: 9 });
  assert.equal(received.id, 9);
  assert.equal(received.message.type, 'TYPEPILOT_FIX_SELECTION');
});

test('cache reuse expires after five minutes and stale entries are deleted on lookup', () => {
  const bg = background();
  bg.evaluate('globalThis.testNow = 0; Date.now = () => testNow; setCachedResult("draft", { result: "sample" });');
  assert.equal(bg.evaluate('testNow = 299999; getCachedResult("draft").result'), 'sample');
  assert.equal(bg.evaluate('testNow = 300001; resultCache.size'), 1);
  assert.equal(bg.evaluate('getCachedResult("draft")'), null);
  assert.equal(bg.evaluate('resultCache.size'), 0);
});
