# Projects ribbon runtime

Self-contained WebGL renderer imported from `cre/outputs/ribbon` on 2026-10-16.
`src/components/ProjectsRibbon` hosts it at `/projects` in a same-origin frame so
its canvas, global styles, wheel handlers and rendering loop cannot interfere
with the site's Lenis/GSAP scene. The React effect unloads the frame when leaving
the route, including when Next.js Activity retains its hidden DOM, releasing GPU
and video resources. Returning to the route mounts a fresh renderer.

The demo header is removed; the Next.js layout supplies the real site header.
Display settings, project titles, desktop ribbon/grid switching, mobile ribbon
settings and the project expansion prototype are retained. All media and fonts
are served locally. The existing project detail view is still a prototype hero,
not CMS case-study content.

`navigation.js` connects the renderer to the host's `/projects?project=…` URL and
browser history. The frame has no independent navigation history. The host waits
for the site loader before mounting it so the spinning reveal remains visible.

These imported JS/CSS files keep their original formatting and are excluded from
Biome; the typed Next.js integration and its Playwright tests remain linted.
When updating the renderer, retain the header removal, navigation adapter and
the `routeLocation` / `routeHistory` references in `project-transition.js`.

Content comes from Sanity: `app.js` loads `/api/projects-ribbon/` (the
“Projects page” singleton's featured + all lists — see
`docs/Sanity/ContentModel.md`). Empty or unavailable catalogues show a message;
the bundled demo JSON is never used by the website. Images and videos load with
`crossOrigin='anonymous'` so Sanity CDN media can be uploaded as WebGL
textures. Clicking a tile posts `{ type: 'projects:open', href }` to the host,
which routes to the case study or opens the external link. Retain these three
integration points when updating the renderer too.

Missing or failing posters fall back to the `placeholder` URL the API sends
(`PLACEHOLDER_IMAGE` in `src/data/site.ts`) — in `imageLoad` (app.js) and the
grid's texture loader (grid.js) — so one bad image can't stop the ribbon.

The ribbon and grid's tooltip shows where a project opens, from
its `href`: “View” for a ready case study on this site (borderless, brand-c3 fill), or “View Offsite” for one
hosted elsewhere (Dribbble, an agency site) — the name and services already
show bottom-left. See `projectKind` in `grid.js`. Keyboard focus selects the
centre tile; Enter/Space opens it, and Escape dismisses its tooltip. Tapping a
locked tile also shows the tooltip without navigating.

Case studies only open when Sanity sends `isReady: true`. False or missing
readiness, and projects with no link, show a grab cursor and locked “Coming soon”
tooltip (`isProjectClickable` in `grid.js`, shared by both views and
`projectClick` in `app.js`). Explicit external listing links remain clickable.

Video loop projects also play in the All projects grid (`attachVideo` /
`updateVideoTexture` in `grid.js`): the poster shows until the loop has a frame,
and each loop pauses itself when its tile is off-screen or the page is hidden.

The All projects grid layout comes from `buildGridLayout` in `grid.js`: a
shuffled block (rebuilt each time the grid opens) wrapped across the grid. No
project repeats within a screen-sized window — the largest box the catalogue
allows (30 projects → 5×5). The ribbon line keeps the featured order only for
the run the ribbon was showing, so the ribbon ↔ grid transition lines up.
