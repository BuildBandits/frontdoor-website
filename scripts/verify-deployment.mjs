import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const base = new URL(process.argv[2] || 'https://invalid.local');
assert.ok(process.argv[2], 'Usage: npm run verify:deployment -- https://deployment.example');
assert.equal(base.protocol, 'https:', 'Use HTTPS');
assert.equal(base.username + base.password + base.search + base.hash, '', 'Pass an origin without credentials or query');
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
const securityHeaders = config.headers[0].headers;

async function request(path, options = {}) {
  let url = new URL(path, base);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
      headers: {
        'X-ClawGuard-User': 'Fabio Lombardo via polpo-devsecops',
        'X-ClawGuard-Reason': `Verify Frontdoor deployment ${options.method || 'GET'} ${path}`,
        ...options.headers,
      },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    checkSecurity(response, path);
    const location = response.headers.get('location');
    assert.ok(location, `${path}: redirect without Location`);
    const next = new URL(location, url);
    assert.equal(next.origin, base.origin, `${path}: unexpected cross-origin redirect`);
    await response.body?.cancel();
    url = next;
  }
  throw new Error(`${path}: too many redirects`);
}

function checkSecurity(response, path) {
  for (const { key, value } of securityHeaders) assert.equal(response.headers.get(key), value, `${path}: ${key}`);
}

async function verifyFiles(directory, prefix = '') {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '_headers') continue;
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      count += await verifyFiles(join(directory, entry.name), relative + '/');
      continue;
    }
    const path = relative === 'index.html' ? '/' : '/' + relative;
    const local = await readFile(join(directory, entry.name));
    const response = await request(path);
    assert.equal(response.status, 200, path);
    checkSecurity(response, path);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(local), `${path}: content mismatch`);
    if (relative.startsWith('assets/')) assert.match(response.headers.get('cache-control') || '', /max-age=31536000/);
    if (path.endsWith('.vtt')) assert.match(response.headers.get('content-type') || '', /^text\/vtt/);
    if (path.endsWith('.mp4')) assert.match(response.headers.get('content-type') || '', /^video\/mp4/);
    count++;
  }
  return count;
}

const count = await verifyFiles(publicDir);
for (const lang of ['en', 'it']) {
  const path = `/assets/tour-v1/${lang}/frontdoor-demo.mp4`;
  const local = await readFile(join(publicDir, path));
  const head = await request(path, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), local.length);
  checkSecurity(head, path);
  for (const [start, end] of [[0, 1023], [1000000, 1001023], [local.length - 1024, local.length - 1]]) {
    const response = await request(path, { headers: { Range: `bytes=${start}-${end}` } });
    assert.equal(response.status, 206, `${lang}: byte-range support required`);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${local.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), local.subarray(start, end + 1));
    checkSecurity(response, path);
  }
  const transcript = await request(`/assets/tour-v1/${lang}/transcript.html?v=2`);
  assert.equal(transcript.status, 200);
  assert.equal(hash(Buffer.from(await transcript.arrayBuffer())), hash(await readFile(join(publicDir, `assets/tour-v1/${lang}/transcript.html`))));
}
console.log(`Verified ${count} files, security/cache headers, 2 HEAD requests, 6 byte ranges and 2 versioned transcripts.`);
