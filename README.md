# Frontdoor website

Static product website for Frontdoor: **https://frontdoor.buildbandits.com/**.
Hosted on Vercel Hobby with GitHub deployments. Cloudflare Workers remains available
as a fallback. The custom domain, HTTPS certificate and HTTP-to-HTTPS redirect
were verified on 2026-09-23.

## Local development

```bash
npm install
npm run dev
```

## Vercel deployment

`BuildBandits/frontdoor-website` is public and connected to the authorized
Vercel Hobby project `frontdoor-website`. This is the free, non-commercial
open-source project; do not activate Pro or a paid trial for this migration.

`vercel.json` supplies all build settings: **Other** framework, `npm ci --include=dev`,
`npm run build`, and output directory `dist`. The build runs the complete test suite
before copying the static website. No Next.js application, Functions, database,
environment secrets, or external media service are required. Only public website
files are deployed; Cloudflare's `_headers` is excluded and its policies are
expressed in `vercel.json`. Missing paths are not rewritten to the homepage.

Vercel's GitHub app is authorized only for this repository; `main` is the
production branch. PR previews and production deployments have been verified.

To verify a deployment, run from its exact source revision:

```bash
npm ci
npm run build
npm run verify:deployment -- https://frontdoor.buildbandits.com
```

The last command validates deployed content, security/cache headers, subtitle MIME
types, both MP4s, HEAD metadata, six exact byte ranges, and versioned transcripts.
If a preview requires authentication, verify through the authorized session; do
not disable protection globally or commit bypass credentials. HTTP checks do not
replace the visual/playback review described below.

### Domain and cutover

The production domain is `frontdoor.buildbandits.com`. The authoritative DNS
and registrar remain on Spaceship. Its only migration record is:
`frontdoor CNAME 32efc9afb807d69d.vercel-dns-017.com.`
This destination was assigned by Vercel specifically to this project.
Do not change nameservers, apex records, mail records, or unrelated subdomains.

DNS and HTTPS are verified. HTTP redirects permanently to HTTPS. The canonical
and Open Graph URLs use the custom domain. Keep Cloudflare available as a fallback;
removing it is a separate operation, not part of a content update.

### Cloudflare fallback (still active)

The Worker is connected to `main` through Cloudflare Workers Builds. Every push
to `main` triggers a deployment at
`https://frontdoor-website.fluffy-eyelash.workers.dev/`. `npm run dev` and
`npm run deploy -- --dry-run` remain available during the transition. Do not remove
this fallback or change its domain configuration before the Vercel cutover.

## Structure

- `public/index.html` — page content and metadata
- `public/styles.css` — responsive design system
- `public/script.js` — navigation and progressive enhancement
- `public/assets/` — brand and product assets
- `wrangler.jsonc` — Cloudflare Static Assets configuration
- `vercel.json` — Vercel static deployment and security/cache headers
- `scripts/build.mjs` — publish only website files to ignored `dist/`
- `scripts/verify-deployment.mjs` — HTTP verification for preview and production

## Bilingual product tour

The landing includes native EN/IT video, seekable chapters, captions and transcripts,
plus six screenshot views in both languages. Assets come from the approved
`frontdoor-oss-demo-2026-08-14` package and show fictional demo data.

- Current videos/captions live under `public/assets/demo-v2/{en,it}/`.
  Screenshots, transcripts and original fallback media remain in `tour-v1`.
  Version changed media paths: `/assets/*` is cached immutably for one year.
- v2 cancels the original TTS 1.25 speed multiplier with a pitch-preserving
  0.8 audio tempo and video timestamps multiplied by 1.25. It is a retiming of
  the approved masters, not newly synthesized speech; music and motion slow
  with the narration. Duration: EN 209.875 seconds, IT 213.750 seconds.
  H.264 video packets remain unchanged (effective 24 fps), audio is AAC 80 kbps
  for web delivery. Both files fit the ClawGuard 10 MiB base64 request limit.
  External captions and chapter points use the same timestamp multiplier;
  burned-in captions stay aligned with the copied video frames.
  Original masters and preview files are untouched. Reproduction:
  `python3 scripts/retime-demo.py SOURCE_PACKAGE OUTPUT_PACKAGE`.
- Video uses `preload="none"`, a WebP poster, native controls and no autoplay.
  Screenshots use explicit dimensions and lazy loading (except the hero).
- English is the default. Audio and screenshot languages can be selected
  independently; switching audio resets playback and does not auto-start it.
- The no-JavaScript page keeps native English playback, links to both MP4s,
  all six screenshot panels, and visible page content.
- All media is same-origin. No external player, cookies, new service or CSP
  relaxation was added.
- `src/video-worker.mjs` handles current and original fallback MP4 paths: single-byte-range GETs
  return 206 for native seeking, HEAD returns metadata, and invalid ranges return
  416. All other files bypass Worker execution. Security headers are explicitly
  preserved on Worker responses; no external storage or runtime dependency.
  This is Cloudflare-only fallback code. Vercel serves MP4s as static assets;
  verify its native byte-range behavior on a real deployment before cutover.
- The product repository was still private on 2026-09-22. Keep the pre-release
  notice beside the video until the public release is confirmed. This change
  does not alter repository visibility or the separate GitHub-link PR.

Manual visual review: hero; `#demo` playback, EN/IT switching and chapter seeking;
`#tour` six views and EN/IT images; desktop, 390px/320px mobile, keyboard focus,
reduced motion and no-JavaScript fallback.

Run `npm test` for DOM interaction, resource/fallback, media limits and HTTP range checks.
These tests simulate browser media events; they do not replace real playback or
visual verification in a browser.
