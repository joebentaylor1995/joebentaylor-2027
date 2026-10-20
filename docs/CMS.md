# Sanity CMS

The portfolio uses Sanity. Application code imports from `@cms` (`src/cms/index.ts`), which exposes the Sanity client, content fetcher, and GROQ queries. The unused DatoCMS and no-CMS starter adapters have been removed.

## Fetching content

Fetch content in Server Components using `fetchContent<T>(query, options?)`. It returns `T` on success or `null` on failure, so callers must handle missing content. Queries such as `GET_HOME`, `GET_GLOBAL`, and `GET_PROJECTS_PAGE` live in `src/cms/sanity/queries/`.

Pages use the shared helpers in `src/data/` to map CMS responses into the site's content types. Keep imports through `@cms` so caching, draft mode, and error handling remain consistent.

## Studio and preview

- The embedded Studio lives at `/studio/`, configured by `sanity.config.ts`.
- Schemas live in `sanity/schemaTypes/`.
- Draft-mode routes resolve through `@cms/draft` and support Sanity's Presentation tool.
- `SANITY_API_READ_TOKEN` enables authenticated draft preview and must remain server-only.

## Environment

Copy `.env.example` to `.env` and configure:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project |
| `NEXT_PUBLIC_SANITY_DATASET` | Dataset, normally `production` |
| `NEXT_PUBLIC_SANITY_API_VERSION` | Pinned API version |
| `SANITY_API_READ_TOKEN` | Viewer token for draft preview |

Set the same project and dataset in the hosting environment so the website and Studio use the intended content.

See [Sanity setup and visual editing](./Sanity/README.md) for further details.
