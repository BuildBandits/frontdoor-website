const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const publicDir = path.join(__dirname, '../public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(publicDir, 'script.js'), 'utf8');

function setup() {
  const dom = new JSDOM(html, { url: 'https://example.test/', runScripts: 'outside-only' });
  const { window } = dom;
  window.matchMedia = () => ({ matches: true });
  const video = window.document.querySelector('video');
  const calls = { play: 0, pause: 0, load: 0 };
  video.play = () => { calls.play++; return Promise.resolve(); };
  video.pause = () => { calls.pause++; };
  video.load = () => { calls.load++; };
  Object.defineProperty(window.HTMLTrackElement.prototype, 'track', {
    get() { return this._track ??= { mode: 'disabled' }; },
  });
  window.eval(script);
  return { window, document: window.document, video, calls, close: () => dom.window.close() };
}

test('progressive enhancement: native player and all screenshots work without JS', () => {
  const { window } = new JSDOM(html);
  const d = window.document;
  assert.equal(d.querySelector('video').getAttribute('preload'), 'metadata');
  assert.equal(d.querySelector('video').hasAttribute('autoplay'), false);
  assert.ok(d.querySelector('video').hasAttribute('controls'));
  assert.equal(d.querySelectorAll('[data-tour-panel]:not([hidden])').length, 6);
  assert.ok([...d.querySelectorAll('[data-demo-controls], [data-tour-controls]')].every(e => e.hidden));
  assert.ok(d.querySelector('a[href$="/it/frontdoor-demo.mp4"]'));
  assert.equal(d.documentElement.classList.contains('motion-ready'), false);
  window.close();
});

test('initial English selection is playable, and a failed selected language can retry', () => {
  const s = setup();
  assert.ok(s.video.src.endsWith('/demo-v4/en/frontdoor-demo.mp4'));
  assert.equal(s.calls.play, 0, 'never autoplay on page load');
  s.document.querySelector('[data-language="en"]').click();
  assert.equal(s.calls.load, 1);
  assert.equal(s.calls.play, 1, 'initial EN must not be a no-op');
  Object.defineProperty(s.video, 'readyState', { value: 4 });
  Object.defineProperty(s.video, 'error', { value: { code: 3 } });
  s.document.querySelector('[data-language="en"]').click();
  assert.equal(s.calls.load, 2, 'reload an explicit retry after a decode error');
  s.close();
});

test('current MP4 audio timestamps stay continuous and metadata precedes media', () => {
  const boxes = (b, start, end) => {
    const result = [];
    while (start + 8 <= end) {
      const size = b.readUInt32BE(start);
      assert.ok(size >= 8 && start + size <= end, 'valid MP4 box');
      result.push({ type: b.toString('ascii', start + 4, start + 8), start: start + 8, end: start + size });
      start += size;
    }
    return result;
  };
  for (const lang of ['en', 'it']) {
    const b = fs.readFileSync(path.join(publicDir, `assets/demo-v4/${lang}/frontdoor-demo.mp4`));
    const top = boxes(b, 0, b.length);
    const moov = top.find(x => x.type === 'moov');
    assert.ok(moov.start < top.find(x => x.type === 'mdat').start, 'faststart required');
    let audioTracks = 0;
    for (const trak of boxes(b, moov.start, moov.end).filter(x => x.type === 'trak')) {
      const mdia = boxes(b, trak.start, trak.end).find(x => x.type === 'mdia');
      const mdiaBoxes = boxes(b, mdia.start, mdia.end);
      const handler = mdiaBoxes.find(x => x.type === 'hdlr');
      if (b.toString('ascii', handler.start + 8, handler.start + 12) !== 'soun') continue;
      audioTracks++;
      const minf = mdiaBoxes.find(x => x.type === 'minf');
      const stbl = boxes(b, minf.start, minf.end).find(x => x.type === 'stbl');
      const stts = boxes(b, stbl.start, stbl.end).find(x => x.type === 'stts');
      const count = b.readUInt32BE(stts.start + 4);
      for (let i = 0; i < count; i++) {
        const duration = b.readUInt32BE(stts.start + 12 + i * 8);
        assert.ok(duration > 0 && duration <= 1024, `${lang}: AAC sample duration ${duration} must not hide a timestamp gap`);
      }
    }
    assert.equal(audioTracks, 1);
  }
});

test('all local resources, fragments and accessible control targets exist', () => {
  const { window } = new JSDOM(html);
  const d = window.document;
  const ids = [...d.querySelectorAll('[id]')].map(e => e.id);
  assert.equal(ids.length, new Set(ids).size);
  for (const element of d.querySelectorAll('[src], [href], [poster], [aria-controls]')) {
    for (const attr of ['src', 'href', 'poster']) {
      const url = element.getAttribute(attr);
      if (url?.startsWith('/')) assert.ok(fs.existsSync(path.join(publicDir, new URL(url, "https://example.test").pathname)), url);
      if (url?.startsWith('#')) assert.ok(d.getElementById(url.slice(1)), url);
    }
    if (element.hasAttribute('aria-controls')) assert.ok(d.getElementById(element.getAttribute('aria-controls')));
  }
  for (const lang of ['en', 'it']) {
    for (const name of ['frontdoor-demo.mp4', 'captions.vtt', 'transcript.html']) {
      const file = path.join(publicDir, name === 'transcript.html' ? 'assets/tour-v1' : 'assets/demo-v4', lang, name);
      assert.ok(fs.statSync(file).size < 25 * 1024 * 1024, file);
      if (name.endsWith('.mp4')) {
        const bodyBytes = 4 * Math.ceil(fs.statSync(file).size / 3) + 64;
        assert.ok(bodyBytes < 10 * 1024 * 1024, 'GitHub base64 request must fit ClawGuard');
      }
    }
    const vtt = fs.readFileSync(path.join(publicDir, 'assets/demo-v4', lang, 'captions.vtt'), 'utf8');
    assert.ok(vtt.startsWith('WEBVTT\n\n'));
    assert.ok(vtt.match(/\d{2}:\d{2}:\d{2}\.\d{3} -->/g).length > 50);
    assert.ok(!/\d{2}:\d{2}:\d{2},\d{3}/.test(vtt));
  }
  window.close();
});

test('explicit language selection starts playback and replaces captions and transcript', () => {
  const s = setup();
  assert.equal(s.calls.play, 0);
  const previous = s.video.querySelector('track');
  previous.track.mode = 'showing';
  s.document.querySelector('[data-language="it"]').click();
  assert.equal(s.calls.pause, 1);
  assert.equal(s.calls.load, 1);
  assert.equal(s.calls.play, 1);
  assert.ok(s.video.src.endsWith('/it/frontdoor-demo.mp4'));
  assert.ok(s.video.poster.endsWith('/it/02-governed-catalog.webp'));
  assert.ok(s.document.querySelector('[data-transcript]').href.endsWith('/it/transcript.html?v=2'));
  const next = s.video.querySelector('track');
  assert.notEqual(previous, next);
  assert.equal(next.srclang, 'it');
  assert.equal(next.track.mode, 'showing');
  assert.equal(s.document.querySelector('[data-language="it"]').getAttribute('aria-pressed'), 'true');
  Object.defineProperty(s.video, 'readyState', { value: 4 });
  s.document.querySelector('[data-language="it"]').click();
  assert.equal(s.calls.load, 1, 'healthy same-language media should not restart');
  s.close();
});

test('chapter seeking handles unloaded media, rapid selection and source changes', () => {
  const s = setup();
  s.document.querySelector('[data-chapter="admin"]').click();
  s.document.querySelector('[data-chapter="connect"]').click();
  s.video.dispatchEvent(new s.window.Event('loadedmetadata'));
  assert.equal(s.video.currentTime, 136.967);
  s.video.dispatchEvent(new s.window.Event('timeupdate'));
  assert.equal(s.document.querySelector('[data-chapter][aria-current="true"]').dataset.chapter, 'connect');
  s.document.querySelector('[data-chapter="admin"]').click();
  s.document.querySelector('[data-language="it"]').click();
  s.video.currentTime = 0;
  s.video.dispatchEvent(new s.window.Event('loadedmetadata'));
  assert.equal(s.video.currentTime, 0, 'do not apply an old-language pending seek');
  Object.defineProperty(s.video, 'readyState', { value: 1 });
  s.document.querySelector('[data-chapter="admin"]').click();
  assert.equal(s.video.currentTime, 72.633);
  s.close();
});

test('gallery switches all six screens and its language independently of audio', () => {
  const s = setup();
  for (const button of s.document.querySelectorAll('[data-screen]')) {
    button.click();
    const visible = [...s.document.querySelectorAll('[data-tour-panel]')].filter(p => !p.hidden);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].dataset.tourPanel, button.dataset.screen);
    assert.equal(s.document.querySelectorAll('[data-screen][aria-pressed="true"]').length, 1);
  }
  s.document.querySelector('[data-image-language="it"]').click();
  for (const panel of s.document.querySelectorAll('[data-tour-panel]')) {
    const img = panel.querySelector('img');
    assert.ok(img.src.includes('/it/'));
    assert.ok(fs.existsSync(path.join(publicDir, new URL(img.src).pathname)));
    for (const a of panel.querySelectorAll('[data-full-image]')) assert.equal(a.href, img.src);
  }
  assert.ok(s.video.src.includes('/en/'));
  assert.equal(s.calls.play, 0);
  s.close();
});

test('playback rejection and media errors provide a fallback instead of unhandled promises', async () => {
  const s = setup();
  s.video.play = () => Promise.reject(new Error('autoplay policy'));
  s.document.querySelector('[data-chapter="catalog"]').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(s.document.querySelector('[data-demo-status]').textContent, /Press Play/);
  s.video.dispatchEvent(new s.window.Event('error'));
  assert.match(s.document.querySelector('[data-demo-status]').textContent, /EN or IT video link/);
  s.close();
});
