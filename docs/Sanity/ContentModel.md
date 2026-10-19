# Sanity Content Model

How every piece of editable content on joebentaylor.co.uk maps to Sanity, where it
renders, and what deliberately stays in code. The Studio lives at `/studio`.

```
Studio
├── ⚙︎  Global settings        settings      (singleton)  → every page
├── 🏠 Homepage               homePage      (singleton)  → /
├── 👤 Profile panel           profilePanel  (singleton)  → the slide-out profile (every page)
├── 🗂  Projects page          projectsPage  (singleton)  → /projects (featured + all)
├── 📁 Projects               project       (documents)  → /projects/[slug] + the ribbon
└── 💬 Reviews                review        (documents)  → profile panel + case studies
```

Reusable objects: `seo`, `mediaItem`, `caseSingle`, `caseDual`, `link`.

---

## Global settings — `settings`

| Group | Field | Renders |
| --- | --- | --- |
| Identity | `name`, `shortName`, `tagline`, `jobTitle`, `description`, `knowsAbout[]` | Default `<title>` template, meta description, JSON-LD Person/WebSite, keywords |
| SEO | `seo` (title, description, share image) | Site-wide metadata defaults + default OG card (each page may override) |
| Contact | `email`, `bookingLink` (Cal.com path, e.g. `joebentaylor/30min`), `location` (locality, region, country) | Contact modal booking calendar, profile CTA email link, JSON-LD |
| Social | `socials[]` (platform, url) | Profile CTA links, JSON-LD `sameAs` |
| Business | `businessName`, `companyNumber`, `resume` (file) | JSON-LD Organization, profile CTA “Resume” link |

`src/config.ts` → `profile` remains the **fallback**: any field left empty in
Sanity (or Sanity being unreachable) falls back to the coded value, so the site
never renders blank. The header always links to `/projects`; project readiness
is controlled on each case study instead of in Global settings.

## Homepage — `homePage`

| Field | Renders |
| --- | --- |
| `heading`, `description` | Hero headline + intro (WebGL hero texture) |
| `clientLogos[]` (name, logo image) | Hero logo marquee |
| `seo` | `/` metadata |

## Profile panel — `profilePanel`

The slide-out “about me” panel, available on every page.

| Field | Renders |
| --- | --- |
| `introEyebrow` (“Bringing stories to life”), `titleLines[]` (“Designer, Developer, Storyteller”), `introduction[]` | Introduction section |
| `about[]`, `aboutImages[]` (exactly 5 photos; hotspot = focus) | About copy + the scroll photo sequence |
| `designToolkit`, `developmentToolkit` (title, tools: name, tile colour, logo layers) | The two physics toolkit tiles |
| `keyboards` (title, count) | Keyboard collector tile — “10 Boards” |
| `featuredOn` (eyebrow, publication, link, video loop) | Featured on Codrops tile |
| `cssda` (title, link, image) | CSSDA Judge tile |
| `servicesIntro` (rich text, *highlight* decorator), `services[]` (title, thumbnail) | Services list |
| `recognitionIntro`, `recognitionOutro`, `awards[]` (posters, cropped 420 × 595 around the hotspot) | Recognition copy + the 3D award spiral (first three = no-WebGL fallback) |
| `reviews[]` → `review` | Reviews carousel, in order |

## Projects page — `projectsPage`

The listing is split into the two areas the ribbon already has:

| Field | Renders |
| --- | --- |
| `featured[]` → `project` (ordered, drag to sort) — **case studies only** (the picker filters them, validation flags any switched back) | **Featured** — the curved WebGL ribbon (desktop) |
| `allProjects[]` → `project` (ordered, optional) — case studies **or** listing-only | **All projects** — the grid shows **every published project**: featured first, then this list (to pin an order), then everything else newest first |
| `seo` | `/projects` metadata |

Served to the ribbon runtime by `GET /api/projects-ribbon` in the shape it
already understood (`name`, `type`, `poster`, `video`), plus `href` and `isReady`.
Only published CMS entries are returned; missing configuration, an unavailable
CMS, or an empty Featured list must never substitute the bundled demo catalogue.
On each Netlify site, configure `NEXT_PUBLIC_SANITY_PROJECT_ID`,
`NEXT_PUBLIC_SANITY_DATASET`, and `NEXT_PUBLIC_SANITY_API_VERSION` for both Builds
and Functions, then rebuild. Verify the deployed API's featured entries and
readiness values against Sanity before merging or publishing.

## Project — `project`

One document per piece of work. A project is either a full **case study** or a
**listing-only** entry (e.g. a Dribbble shot linking out).

| Group | Field | Notes |
| --- | --- | --- |
| Listing | `title`, `slug`, `client`, `tags[]` → `projectTag`, `thumbnail` (image + hotspot), `previewVideo` (short muted loop, file) | Ribbon + grid tile. Tags appear comma-separated beneath the featured name, in their selected order. Manage reusable names in **Project Tags**. |
| Listing | `hasCaseStudy` (boolean), `externalUrl` | Tile opens `/projects/[slug]` or the external URL |
| Listing / Case study | `isReady` (boolean, off by default) | Enables opening a case study from Featured and All projects. Off or unset keeps its tile visible with a locked “Coming soon” tooltip on hover, keyboard focus or tap. Publish to apply changes. External listing links and direct case-study URLs are unaffected. |
| Case study | `heroImage` | Full-bleed hero |
| Case study | `introduction` | Intro paragraph under the hero, also the meta description fallback |
| Case study | `objectives[]` | Overview → objectives paragraphs |
| Case study | `deliverables[]`, `website`, `credits[]` (`person` → `person`, free-text `role`), `recognition[]` (award, organisation) | Overview sidebar |
| Case study | `caseBuilder[]` — **visual builder** of blocks: `caseSingle` (one full-width media) and `caseDual` (two side by side); each media is an image, a short video loop with poster, or a YouTube link (YouTube's standard player, marketing-consent gated — thumbnail otherwise); alt text is required | Rendered by `ProjectCaseBuilder`; new block types slot into this array |
| Case study | `reviews[]` → `review` | Outro testimonial (first review is featured) |
| SEO | `seo` | Per-page title/description/share image |

**Required vs optional (case studies).** Required: introduction, at least one
objective, at least one deliverable, at least one builder block, at least one
review — the Studio shows placeholder hints and blocks publishing until they're
filled. Until then the site renders dummy stand-ins (`projectDummy` in
`src/data/projects.ts`) so a half-built page never looks empty; dummy copy never
reaches the meta description. Optional: Credits and Awards — their sections are
hidden when empty.

## Person — `person`

`name`, `image` (square headshot). A pool of collaborators managed under **People**;
a case study's Credits pick a person and add a free-text role for that project.

## Review — `review`

`quote`, `author`, `role`, `company`, `avatar` (portrait on its own — shown in a circle in the
carousel and case-study outros), `logo` (company logo — a round badge on the portrait's bottom-right, ringed in the panel colour).
One review can appear in the profile panel **and** any number of case studies.

---

## Stays in code (and why)

| Content | Reason |
| --- | --- |
| Hero WebGL, loader, ribbon renderer settings | Art-directed motion/graphics tuning, not editorial content |
| Profile location tile (globe), keycap model | Bespoke 3D artwork, not editorial content |
| Animation of the About sequence, award spiral and toolkits | Motion tuning lives in code (the `?globalSettings` panel) — only their content is in Sanity |
| Legal pages (terms/privacy, cookies, llms) | Legal copy changes with code-level behaviour (cookies, consent); versioned in git |

Each could move later — the same pattern (singleton + query + fallback) applies.

---

## Data flow

```
Sanity  ──GROQ (src/cms/sanity/queries)──▶  fetchContent ('use cache', tag: sanity)
                                              │
                         null / empty? ──▶ local fallback (src/data, src/config.ts)
                                              │
                                     Server Components → client parts via props
```

* Queries project Sanity documents **straight into the app's existing types**
  (`Project`, `Logo`, …), so components didn't change shape.
* Reads are cached (`'use cache'` + `cacheTag('sanity')`). Publishing in the Studio
  hits `POST /api/revalidate` (Sanity webhook, signed with
  `SANITY_REVALIDATE_SECRET`), which expires the tag — changes go live in seconds.
* **Locally** the webhook can't reach you, so in `bun run dev` the site listens
  to Sanity itself (`src/components/SanityDevSync`, development only): a publish
  clears the cache and refreshes the open page within a few seconds. If that
  ever misses, `http://localhost:3001/api/revalidate/` clears it by hand.
  Don't shorten the cache lifetime instead: the root layout reads Sanity outside
  Suspense, and a short-lived entry triggers Next's “Blocking Route” error.

## Visual Editing

Open **Presentation** in the Studio (`/studio/presentation`) to edit with the
site beside the form: click any outlined text on the page to jump to its field,
and every keystroke shows in the preview.

| Piece | Where |
| --- | --- |
| Presentation tool, document locations (“Used on”) | `sanity.config.ts`, `sanity/presentation.ts` |
| Draft mode on/off | `app/api/draft-mode/enable` (Sanity secret check) · `app/api/draft-mode/disable` |
| Draft reads + stega | `src/cms/sanity/client.ts` — in draft mode, reads `drafts` with `SANITY_API_READ_TOKEN` and stega-encodes strings |
| Overlays + live refresh | `src/components/SanityPreview` — `<VisualEditing>` refreshes the route on every edit; only sent in draft mode |

* Draft mode skips the `'use cache'` layer (Next re-runs cached functions per
  request and never stores the result), so drafts are always fresh and never
  leak to visitors.
* Stega's invisible characters stay on rendered text (so it's clickable) and
  are removed with `stegaClean` from everything else: metadata/`<head>`,
  Global settings (links, JSON-LD), the media `type`, slugs and the ribbon API
  (the ribbon runs in an iframe overlays can't reach).
* Split-text animations (`SpecialHeading`, `PageTitleReveal`, review quotes)
  carry `data-sanity-edit-target`, so the outline wraps the whole heading.
* Presentation previews the **drafts** perspective. Its perspective switcher
  (published / releases) isn't wired, because reading the perspective cookie
  isn't allowed inside `'use cache'`.
* Outside Presentation (e.g. a shared preview link), an **Exit draft preview**
  button returns to published content.
* **Profile panel:** opening the panel in the preview switches Presentation to
  the **Profile panel** document (the preview reports `/profile/`, a virtual
  path — `src/utils/profileRoute.ts`); closing it switches back to the page.
  The panel's “Used on” link, Presentation's URL bar and a plain visit to
  `/profile/` (redirected to `/?profile`) all open the panel.

## Setup checklist

Project: **Joe Ben Taylor 2027** (`lsgdcp1a`, dataset `production`, public read) in the **JoeBenTaylor** organization (`olg8ump9h`), owned by joe@12.studio.

1. `.env` — `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`,
   `SANITY_API_READ_TOKEN` (Viewer), `SANITY_API_WRITE_TOKEN` (Editor),
   `SANITY_REVALIDATE_SECRET`. Add the same to Netlify (tokens/secret as secrets).
2. `bun run sanity:import` — uploads every image/video and creates all documents.
   Re-running **overwrites** the seeded documents with the code fallbacks, so only
   use it to reset.
3. sanity.io/manage → API → CORS: add the site origins (with credentials) so `/studio` can sign in.
4. sanity.io/manage → API → Webhooks: `POST https://<site>/api/revalidate/`,
   projection `{_type}`, secret = `SANITY_REVALIDATE_SECRET`.
