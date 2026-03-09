# Option Put Worker

Minimal Cloudflare Worker MVP for screening ETH cash-secured put opportunities.

## Stack

- Cloudflare Workers
- Hono
- KV
- Cron Triggers
- Static assets in `public/`

## Routes

- `GET /api/health`
- `GET /api/market/latest`
- `GET /api/options`
- `GET /api/recommendations?limit=3`
- `GET /api/status`
- `POST /api/refresh`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a KV namespace and update `wrangler.jsonc`.

3. Create a local dev secret file:

```bash
printf 'MANUAL_REFRESH_TOKEN="your-local-token"\n' > .dev.vars
```

For local development, Wrangler reads secrets from `.dev.vars` or `.env`.

4. Optionally set the deployed Worker secret:

```bash
npx wrangler secret put MANUAL_REFRESH_TOKEN
```

5. Start local dev:

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Notes

- Static assets are served from `public/`.
- API routes are served by the Worker.
- The default cron is every 4 hours.
- The current implementation reads public ETH options data from Deribit.
- `options.html` shows the full normalized ETH put snapshot and filters it client-side.
