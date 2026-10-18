const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');

function background(overrides = {}) {
  let data = {};
  let listener;
  let command;
  const chrome = {
    runtime: { id: 'test-extension', getURL: p => `chrome-extension://test-extension/${p}`, onMessage: { addListener(fn) { listener = fn; } } },
    action: { onClicked: { addListener() {} } },
    commands: { onCommand: { addListener(fn) { command = fn; } } },
    tabs: { create() {}, query: async () => [{ id: 1 }], sendMessage: async () => ({ success: true }) },
    storage: {
      local: { setAccessLevel: async () => {}, get: async () => ({ geminiApiKey: 'test-only-not-a-real-key' }) },
      session: {
        get: async () => structuredClone(data),
        set: async value => { data = structuredClone(value); },
        remove: async key => { delete data[key]; },
      },
      onChanged: { addListener() {} },
    },
  };
  const context = vm.createContext({ chrome, console: { error() {} }, AbortController, SyntaxError, Intl, performance, crypto: webcrypto, setTimeout, clearTimeout, ...overrides });
  context.self = context;
  for (const file of ['vendor/twitter-text.js', 'x-post.js', 'background.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/^import .*;\r?\n/gm, '');
    vm.runInContext(source, context, { filename: file });
  }
  const evaluate = code => vm.runInContext(code, context);
  const settingsSender = { id: chrome.runtime.id, url: chrome.runtime.getURL('options.html') };
  const send = (message, sender = settingsSender) => new Promise(resolve => listener(message, sender, resolve));
  return { context, chrome, evaluate, send, command: (...args) => command(...args), data: () => structuredClone(data) };
}
module.exports = { background, root };
