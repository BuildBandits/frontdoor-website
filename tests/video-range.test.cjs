const { test } = require('node:test');
const assert = require('node:assert/strict');
const url = 'https://example.test/assets/demo-v4/en/frontdoor-demo.mp4';

async function serve(headers = {}, method = 'GET', pathname = url, omitLength = false) {
  const { default: worker } = await import('../src/video-worker.mjs');
  const env = { ASSETS: { fetch: async req => {
    assert.equal(req.headers.get('range'), null);
    return new Response(req.method === 'HEAD' ? null : new Uint8Array([0,1,2,3,4,5,6,7,8,9]), {
      headers: { 'Content-Type': 'video/mp4', ...(omitLength ? {} : {'Content-Length': '10'}), ETag: '"demo-v1"' },
    });
  } } };
  return worker.fetch(new Request(pathname, { method, headers }), env);
}

test('MP4 range requests return exact partial bytes and security headers', async () => {
  for (const [range, contentRange, expected] of [
    ['bytes=0-1', 'bytes 0-1/10', [0,1]],
    ['bytes=7-', 'bytes 7-9/10', [7,8,9]],
    ['bytes=-3', 'bytes 7-9/10', [7,8,9]],
    ['bytes=8-500', 'bytes 8-9/10', [8,9]],
  ]) {
    const res = await serve({ Range: range });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), contentRange);
    assert.equal(res.headers.get('content-length'), String(expected.length));
    assert.equal(res.headers.get('accept-ranges'), 'bytes');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], expected);
  }
});

test('unsatisfiable ranges fail safely without streaming a full file', async () => {
  for (const range of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=99999999999999999999-']) {
    const res = await serve({ Range: range });
    assert.equal(res.status, 416, range);
    assert.equal(res.headers.get('content-range'), 'bytes */10');
    assert.equal((await res.arrayBuffer()).byteLength, 0);
  }
});

test('range and HEAD work when the ASSETS binding omits Content-Length', async () => {
  const partial = await serve({Range:'bytes=3-5'}, 'GET', url, true);
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), 'bytes 3-5/10');
  assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())], [3,4,5]);
  const head = await serve({}, 'HEAD', url, true);
  assert.equal(head.headers.get('content-length'), '10');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test('full GET, HEAD, invalid syntax and stale If-Range preserve HTTP semantics', async () => {
  for (const headers of [{}, {Range:'invalid'}, {Range:'bytes=0-1,5-6'}, {Range:'bytes=0-1','If-Range':'"stale"'}]) {
    const res = await serve(headers);
    assert.equal(res.status, 200);
    assert.equal((await res.arrayBuffer()).byteLength, 10);
  }
  const partial = await serve({Range:'bytes=2-3','If-Range':'"demo-v1"'});
  assert.equal(partial.status, 206);
  const head = await serve({Range:'bytes=0-1'}, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '10');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const post = await serve({}, 'POST');
  assert.equal(post.status, 405);
});

test('non-video requests pass through to the asset binding unchanged', async () => {
  const { default: worker } = await import('../src/video-worker.mjs');
  const request = new Request('https://example.test/styles.css');
  const response = new Response('styles');
  const result = await worker.fetch(request, { ASSETS: { fetch: async received => {
    assert.equal(received, request); return response;
  } } });
  assert.equal(result, response);
});

test('the renamed diagnostic MP4 has the same range handling as the original', async () => {
  const renamed = 'https://example.test/assets/demo-v4/en/frontdoor-demo-cachecheck-20260923.mp4';
  const response = await serve({Range: 'bytes=0-1'}, 'GET', renamed);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 0-1/10');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0, 1]);
});
