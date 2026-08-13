# FrontDoor website

Static product website for FrontDoor, deployed on Cloudflare Workers with Static Assets.

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
