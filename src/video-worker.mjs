// Current demos and immutable v1 fallback routes only. Everything else stays static.
const VIDEO_PATH = /^\/assets\/(tour-v1|demo-v2)\/(en|it)\/frontdoor-demo\.mp4$/;
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || '');
  // Unsupported multi-range or malformed requests may be ignored (full 200).
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return false;
  return { start, end };
}

export default {
  async fetch(request, env) {
    if (!VIDEO_PATH.test(new URL(request.url).pathname)) return env.ASSETS.fetch(request);
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 405, headers: { ...SECURITY_HEADERS, Allow: 'GET, HEAD' } });
    }
    const assetRequest = new Request(request.url, { method: 'GET', headers: request.headers });
    for (const header of ['Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']) assetRequest.headers.delete(header);
    assetRequest.headers.set('Accept-Encoding', 'identity');
    const asset = await env.ASSETS.fetch(assetRequest);
    const headers = new Headers(asset.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    if (asset.status !== 200 || !headers.get('Content-Type')?.startsWith('video/mp4')) {
      return new Response(asset.body, { status: asset.status, headers });
    }
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    // ASSETS may omit Content-Length internally even when the public response
    // has one. Derive it for range/HEAD requests from these small fixed files.
    let size = Number(headers.get('Content-Length'));
    let bytes = null;
    if (!size && (request.headers.has('Range') || request.method === 'HEAD')) {
      bytes = await asset.arrayBuffer();
      size = bytes.byteLength;
      headers.set('Content-Length', String(size));
    }
    if (request.method === 'HEAD') {
      if (!bytes) await asset.body?.cancel();
      return new Response(null, { status: 200, headers });
    }
    const validator = request.headers.get('If-Range');
    const etag = headers.get('ETag');
    const modified = headers.get('Last-Modified');
    const validatorMatches = !validator || (etag && !etag.startsWith('W/') && validator === etag) ||
      (modified && Number.isFinite(Date.parse(validator)) && Date.parse(modified) <= Date.parse(validator));
    const range = request.method === 'GET' && validatorMatches && size > 0
      ? parseRange(request.headers.get('Range'), size) : null;
    if (range === false) {
      if (!bytes) await asset.body?.cancel();
      headers.set('Content-Range', `bytes */${size}`);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }
    if (!range) return new Response(bytes ?? asset.body, { status: 200, headers });
    // These immutable assets are <8 MB. A bounded slice avoids an external
    // video host and provides native seek support even on a cold edge cache.
    bytes ??= await asset.arrayBuffer();
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    headers.set('Content-Length', String(range.end - range.start + 1));
    return new Response(bytes.slice(range.start, range.end + 1), { status: 206, headers });
  },
};
