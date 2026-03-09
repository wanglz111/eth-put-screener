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
- `POST /api/import-cache`
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

If you want to avoid Deribit public rate limits in production, also add:

```bash
printf 'DERIBIT_CLIENT_ID="your-client-id"\nDERIBIT_CLIENT_SECRET="your-client-secret"\n' >> .dev.vars
```

4. Set the deployed Worker secrets:

```bash
npx wrangler secret put MANUAL_REFRESH_TOKEN
npx wrangler secret put CACHE_IMPORT_TOKEN
npx wrangler secret put DERIBIT_CLIENT_ID
npx wrangler secret put DERIBIT_CLIENT_SECRET
```

5. Start local dev:

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## GitHub Actions refresh

The Worker no longer relies on Cloudflare Cron. Instead, GitHub Actions fetches Deribit data and uploads the normalized snapshot back to the Worker cache.

GitHub repository secrets required:

- `WORKER_BASE_URL`
- `CACHE_IMPORT_TOKEN`
- `DERIBIT_CLIENT_ID`
- `DERIBIT_CLIENT_SECRET`

You can also run the same flow locally:

```bash
WORKER_BASE_URL="https://your-worker-domain" CACHE_IMPORT_TOKEN="your-token" npm run refresh:push
```

## Notes

- Static assets are served from `public/`.
- API routes are served by the Worker.
- The current implementation reads ETH options data from Deribit.
- If `DERIBIT_CLIENT_ID` and `DERIBIT_CLIENT_SECRET` are configured, the Worker uses authenticated requests to reduce the chance of HTTP 429 on Cloudflare egress IPs.
- Cache refresh is intended to run from GitHub Actions or another non-Cloudflare environment.
- `options.html` shows the full normalized ETH put snapshot and filters it client-side.
