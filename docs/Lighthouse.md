# Lighthouse

## Netlify deployed-page audits

`netlify.toml` uses the local `plugins/lighthouse` build plugin. It runs after a successful deploy against the immutable `DEPLOY_URL`, including Next.js SSR, functions and image delivery. It never audits `.next` as a static website or blocks publication on a low score.

Lighthouse **13.5.0** and Chrome Launcher **1.2.1** are exact dev dependencies in `bun.lock`. Lighthouse's latest version was checked against npm on 18 October 2026. Chromium comes from the Playwright installation rather than arbitrary system Chrome. Versions are reproducible, not silently upgraded every deploy.

The official Netlify plugin's latest release, **6.0.4**, still depends on Lighthouse 9 and imports paths removed in Lighthouse 13. A dependency override alone is incompatible; this local plugin replaces it.

### Conditions

- Routes: `/`, `/projects/`, `/projects/pocketchange/`.
- Desktop: 1440×900, DPR 1, Lighthouse desktop throttling (40ms RTT, 10,240Kbps, 1× CPU).
- Mobile: Lighthouse's mid-range Android baseline, 412×823, DPR 1.75, slow 4G (150ms RTT, 1,638.4Kbps), 4× CPU. This is not an iPhone simulation.
- Three fresh-browser runs per route/device, sequentially, with storage reset. Select the report with the median performance score. CDN caches can still warm between runs.
- Simulated network/CPU throttling makes comparisons repeatable; these are lab estimates, not real-device results.
- No skipped audits, hidden loaders or relaxed scores. Deploy permalink noindex headers may legitimately lower SEO.

Six labelled reports return in the Netlify plugin summary, with full HTML report metadata. A local plugin may not receive the official integration's special deploy-list badges. Raw runs are written to `.lighthouseci/netlify` in the build workspace, not published publicly or guaranteed retained as downloadable artifacts.

18 audits add several minutes to post-deploy reporting. Configure `paths` and `runs` in `netlify.toml`. Browser/runtime failures are reported as plugin failures, never as successful scores.

Lighthouse cannot certify 120fps, scrolling, Safari or sustained WebGL performance. Real-device frame-time testing and field Core Web Vitals remain necessary. Protected deploys, CMS CORS rules and network failures can affect reports.

## GitHub CI

The existing `lighthouserc.js` remains separate: three desktop audits of the production server. Thresholds are unchanged: Performance 80, Best Practices 90, SEO 100, Agentic Browsing 100; Accessibility warns below 90. The existing override keeps LHCI on 13.5.0.

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000 bun run lighthouse
```

This builds, serves and audits the homepage. Report links use temporary public storage and expire after seven days.

## Updates

Check npm before updating Lighthouse, its override, Chrome Launcher or Playwright; regenerate the lockfile and smoke-test both profiles. Do not force a future engine into the obsolete official plugin.

Sources: [Netlify plugin](https://github.com/netlify/netlify-plugin-lighthouse), [Lighthouse releases](https://github.com/GoogleChrome/lighthouse/releases), [throttling model](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md).
