# Media on Cloudflare R2

Video loops and other Sanity **files** (the résumé PDF, for example) are served from Cloudflare R2 instead of
`cdn.sanity.io`, so visitor bandwidth doesn't use up Sanity's quota. R2 has no egress fees.
**Images stay on Sanity's CDN**, which keeps its resizing (`?w=…&fm=jpg`) and hotspots.

## How it works

```
Studio upload ─▶ Sanity (unchanged: CompressedVideoInput still compresses and uploads)

Visitor ─▶ <media worker>/files/<project>/<dataset>/<sha1>.mp4
             ├─ in R2   ─▶ served from R2 (range requests, ETag/304, CORS)
             └─ missing ─▶ fetched once from cdn.sanity.io, saved to R2, then served
```

- `workers/media/` is a Cloudflare Worker bound to an R2 bucket. Its paths mirror Sanity's file CDN, so a file's
  R2 key is its Sanity path. It only serves files from this project and dataset, so it can't be used as an open
  proxy.
- `src/utils/mediaUrl.ts` swaps `https://cdn.sanity.io/files/` for `NEXT_PUBLIC_MEDIA_URL/files/` in every
  `fetchContent` result (`src/cms/sanity/client.ts`). No GROQ query needs changing.
- Sanity file URLs are content-hashed, so objects never change. A replaced video gets a new URL and is
  mirrored the first time someone requests it. Responses are `immutable` and cached for a year.
- Existing videos need no migration: each one is copied into R2 the first time it's requested.
- If `NEXT_PUBLIC_MEDIA_URL` is unset, everything is served from Sanity as before.

## One-time setup

1. **Create the bucket.** In the Cloudflare dashboard, go to **R2 Object Storage**, choose **Create bucket**, and
   name it `joebentaylor-media-eu` (it must match `bucket_name` in `workers/media/wrangler.jsonc`). Set the
   location hint to **Western Europe (WEUR)**, near most visitors, and leave the storage class as Standard.
   Public access can stay **off**, because the Worker reads the bucket through its binding. Or from the terminal:

   ```bash
   bunx wrangler r2 bucket create joebentaylor-media-eu --location weur
   ```

   A location can't be changed after the bucket is created. Recreating a recently deleted name may also keep
   the old location, which is why this bucket has the `-eu` suffix.

2. **Log in to Wrangler** (this opens the browser):

   ```bash
   bunx wrangler login
   ```

3. **Deploy the Worker** from `workers/media`:

   ```bash
   cd workers/media && bunx wrangler deploy
   ```

   The command prints the Worker's URL, for example `https://joebentaylor-media.<account>.workers.dev`.

4. **Check it.** Copy any video URL from the site (it currently starts `https://cdn.sanity.io/files/lsgdcp1a/production/`),
   then swap the host:

   ```bash
   curl -I https://joebentaylor-media.<account>.workers.dev/files/lsgdcp1a/production/<sha1>.mp4
   ```

   You should get a `200` with `content-type: video/mp4`. The file should now be listed in the bucket. A
   `Range: bytes=0-99` request should return `206`.

5. **Point the site at it.** Set `NEXT_PUBLIC_MEDIA_URL` to the Worker URL (no trailing slash) in `.env`
   for local development, and in **Netlify → Site configuration → Environment variables** for production.
   `NEXT_PUBLIC_` values are inlined at build time, so trigger a new deploy afterwards.

## Optional: a custom domain

`joebentaylor.co.uk` uses Netlify DNS, and a Worker custom domain needs the zone on Cloudflare. To use
`media.joebentaylor.co.uk`, move the domain's nameservers to Cloudflare, re-create the Netlify DNS records there,
then replace `"workers_dev": true` in `wrangler.jsonc` with the commented `routes` entry. Redeploy and update
`NEXT_PUBLIC_MEDIA_URL`. `workers.dev` works fine in the meantime.

## Costs

- R2 storage: 10 GB free, then $0.015/GB-month. Egress is free.
- Every request runs the Worker (100k/day free; the paid plan is $5/month for 10M) and makes one R2 read
  (10M/month free).
- Sanity bandwidth is used once per file, when it's first mirrored.

## Development

- `bunx wrangler dev` in `workers/media` runs the Worker locally against a local R2 simulation.
- `bunx wrangler types` regenerates `worker-configuration.d.ts` (gitignored) after you edit `wrangler.jsonc`,
  and `bunx tsc -p workers/media` type-checks the Worker. The site's `bun run type-check` doesn't cover it.
- Deleting a video in Sanity doesn't remove its copy from R2. Orphaned copies are harmless, and you can delete
  them from the bucket in the dashboard.
