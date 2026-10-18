/* Publish a tested package using Git's configured GitHub credential helper.
 * Credentials stay in memory and are never printed or written to the repository. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const tag = `v${manifest.version}`;
const mode = process.argv[2] || 'publish';
const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim();
const match = remote.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
if (!match) throw new Error('Expected the configured GitHub HTTPS origin.');
const repository = `${match[1]}/${match[2]}`;
const gitEnvironment = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };
const credentialOutput = execFileSync('git', ['credential', 'fill'], {
  cwd: root, input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
  env: gitEnvironment, stdio: ['pipe', 'pipe', 'pipe'],
});
const token = credentialOutput.match(/^password=(.+)$/m)?.[1];
if (!token) throw new Error('No saved GitHub credential is available.');
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'TypePilot-release' };
async function api(route, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repository}${route}`, {
    method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub ${method} ${route} returned HTTP ${response.status}.`);
  return response.status === 204 ? {} : response.json();
}
(async () => {
  if (mode === 'status') {
    const repo = await api('');
    const release = await api(`/releases/tags/${tag}`);
    const runs = await api('/actions/runs?per_page=5');
    console.log(JSON.stringify({ repository: repo.full_name, description: repo.description, release: release?.html_url || null, assets: release?.assets?.map(asset => asset.name) || [], runs: runs.workflow_runs?.map(run => ({ name: run.name, sha: run.head_sha.slice(0, 7), status: run.status, conclusion: run.conclusion, url: run.html_url })) }, null, 2));
    return;
  }
  if (mode !== 'publish') throw new Error('Use status or publish.');
  if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('Commit the exact tested source and package before publishing.');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const upstream = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
  if (head !== upstream) throw new Error('Push the tested commit to origin/main first.');
  const checks = await api(`/actions/runs?head_sha=${head}&event=push&per_page=20`);
  const regression = checks.workflow_runs?.find(run => run.name === 'Regression tests');
  if (regression?.status !== 'completed' || regression.conclusion !== 'success') {
    throw new Error('Wait for both GitHub regression and browser jobs to pass before publishing.');
  }
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const heading = `## [${manifest.version}]`;
  const section = changelog.slice(changelog.indexOf(heading));
  const body = section.split(/\r?\n/).slice(2).join('\n').split(/\n## \[/)[0].trim();
  if (!body) throw new Error('The release changelog is missing.');
  let release = await api(`/releases/tags/${tag}`);
  if (release && !release.draft) throw new Error('This release is already public. Refusing to replace its assets.');
  if (!release) release = await api('/releases', 'POST', { tag_name: tag, target_commitish: head, name: `TypePilot ${tag}`, body, draft: true, prerelease: false });
  for (const filename of [`TypePilot-${tag}.zip`, 'SHA256SUMS.txt']) {
    const filePath = path.join(root, 'release', filename);
    const bytes = fs.readFileSync(filePath);
    const existing = release.assets.find(asset => asset.name === filename);
    if (existing) {
      const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      if (existing.digest !== digest) throw new Error(`Draft asset ${filename} differs from the tested package. Inspect the draft before publishing.`);
      continue;
    }
    const upload = release.upload_url.split('{')[0] + `?name=${encodeURIComponent(filename)}`;
    const response = await fetch(upload, { method: 'POST', headers: { ...headers, 'Content-Type': filename.endsWith('.zip') ? 'application/zip' : 'text/plain' }, body: bytes });
    if (!response.ok) throw new Error(`GitHub upload of ${filename} returned HTTP ${response.status}. The release remains a draft.`);
  }
  release = await api(`/releases/${release.id}`, 'PATCH', { draft: false, body, make_latest: 'true' });
  await api('', 'PATCH', { description: 'Chrome extension for work-related writing with Google Gemini and your own API key. Fix, rewrite, translate, shorten, adjust tone, and prepare X posts. Includes Recovery and Copy result. Free extension, separate Google API costs and eligibility.', homepage: `https://${match[1].toLowerCase()}.github.io/${match[2]}/` });
  console.log(JSON.stringify({ release: release.html_url, tag, repository: `https://github.com/${repository}` }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
