const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.join(__dirname, '../public');
const oldVideo = '/assets/demo-v4/en/frontdoor-demo.mp4';
const newVideo = '/assets/demo-v4/en/frontdoor-demo-cachecheck-20260923.mp4';

test('Safari A/B diagnosis uses byte-identical videos and matching native/script URLs', () => {
  assert.deepEqual(fs.readFileSync(path.join(root, oldVideo)), fs.readFileSync(path.join(root, newVideo)));
  for (const [name, source] of [['index.html', oldVideo], ['renamed.html', newVideo]]) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'diagnostics/safari', name), 'utf8'));
    const d = dom.window.document;
    assert.equal(d.querySelector('video').getAttribute('src'), source);
    assert.equal(d.querySelector('script').dataset.video, source);
    assert.equal(d.querySelector('video').getAttribute('preload'), 'metadata');
    assert.equal(d.querySelector('video').hasAttribute('autoplay'), false);
    assert.equal(d.querySelector('meta[name="robots"]').content, 'noindex,nofollow');
    dom.window.close();
  }
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!home.includes('/diagnostics/'));
  assert.ok(!home.includes('cachecheck'));
});
