# Frontdoor website

Static product website for Frontdoor, deployed on Cloudflare Workers with Static Assets.

## Local development

```bash
npm install
npm run dev
```

## Deployment

The production Worker is connected to the `main` branch through Cloudflare Workers Builds. Every push to `main` triggers a deployment. Until a custom domain is purchased, the site is served from its `*.workers.dev` address.

## Structure

- `public/index.html` — page content and metadata
- `public/styles.css` — responsive design system
- `public/script.js` — navigation and progressive enhancement
- `public/assets/` — brand and product assets
- `wrangler.jsonc` — Cloudflare Static Assets configuration

## Bilingual product tour

The landing includes native EN/IT video, seekable chapters, captions and transcripts,
plus six screenshot views in both languages. Assets come from the approved
`frontdoor-oss-demo-2026-08-14` package and show fictional demo data.

- Media lives under `public/assets/tour-v1/{en,it}/`. Version the directory when
  replacing files: `/assets/*` is cached immutably for one year.
- The 720p web copies preserve the approved H.264 video stream and use AAC audio
  at 96 kbps. They fit both the Workers 25 MiB/file limit and ClawGuard's 10 MiB
  request-body limit after base64 encoding for GitHub. The original masters and
  preview files remain unchanged in the delivery package.
- Video uses `preload="none"`, a WebP poster, native controls and no autoplay.
  Screenshots use explicit dimensions and lazy loading (except the hero).
- English is the default. Audio and screenshot languages can be selected
  independently; switching audio resets playback and does not auto-start it.
- The no-JavaScript page keeps native English playback, links to both MP4s,
  all six screenshot panels, and visible page content.
- All media is same-origin. No external player, cookies, new service or CSP
  relaxation was added.
- `src/video-worker.mjs` handles only the two MP4 paths: single-byte-range GETs
  return 206 for native seeking, HEAD returns metadata, and invalid ranges return
  416. All other files bypass Worker execution. Security headers are explicitly
  preserved on Worker responses; no external storage or runtime dependency.
- The product repository was still private on 2026-09-22. Keep the pre-release
  notice beside the video until the public release is confirmed. This change
  does not alter repository visibility or the separate GitHub-link PR.

Manual visual review: hero; `#demo` playback, EN/IT switching and chapter seeking;
`#tour` six views and EN/IT images; desktop, 390px/320px mobile, keyboard focus,
reduced motion and no-JavaScript fallback.

Run `npm test` for DOM interaction, resource/fallback, media limits and HTTP range checks.
These tests simulate browser media events; they do not replace real playback or
visual verification in a browser.
