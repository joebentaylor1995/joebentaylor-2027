# Portfolio performance audit — 18 October 2026

## Outcome

Reduced unnecessary video decoding and texture uploads, fixed ahead-of-scroll media loading in the nested/pinned layouts, suspended covered WebGL work, and removed confirmed unused demo code. Image quality, texture resolution limits, responsive sizing and the approved visual effects were retained.

**120fps is not certified.** The available automated browser reports an ANGLE SwiftShader software GPU and a roughly 60Hz animation cadence. Some desktop samples miss that frame budget. These results must not be presented as proof of 120fps on an iPhone or a hardware-accelerated desktop. Sustained 120fps requires frames within 8.33ms on the actual device.

## Changes

- Added `preloadNearbyMedia`: native lazy images are promoted to eager loading roughly one viewport (minimum 800px) before reaching view. Distant images remain lazy. Nearby videos buffer in advance while playback remains visibility-controlled.
- Correctly observe the Profile scroller and desktop case-study panel. The latter changes into a clipped, pinned panel after mount; the preload observer now reconnects when that layout changes or returns to mobile/reduced-motion layout.
- Prepare the case-study reveal renderer and footer matrix ahead of entry, including after desktop scroll enhancement installs.
- Warm image textures shortly before the reveal, instead of making the first visible frame pay the upload cost.
- Use decoded-video-frame callbacks to avoid uploading the same video frame on every display refresh. Static, settled media still uses the native image/video and stops WebGL drawing.
- Case-study videos pause offscreen, in hidden tabs, behind Profile, and for reduced motion. Cleanup releases their source/decoder and restores it when the cached route becomes active again.
- Suspend the project hero's water renderer behind Profile and detach its ticker offscreen/when the document is hidden.
- Featured ribbon videos now pause outside the rendered slide ranges on desktop as well as mobile. Stacked ribbons calculate their own reversed/offset ranges instead of declaring every project visible.
- Profile About images now use lazy loading plus the nearby-media buffer instead of requesting the entire collection eagerly on opening.
- Removed 74 unused starter demo source files (5,657 lines) and five demo images (about 639KiB). These were already unreferenced by live routes; this is source/asset cleanup, not a claimed reduction of that size in the shipped JS bundle.
- Removed unreachable ribbon reveal shader branches; kept Slide Cascade and the reduced-motion fallback.
- Fixed case-sensitive toolkit preview selectors and updated old test assumptions for fluid font rounding and production CSP. No security policy was weakened.

## Coverage

Inspected the homepage renderer/fluid pipeline, shared scrolling, header, Profile scenes and media, contact/calendar loading, ribbon/grid/video atlas, case-study hero/media/footer, route preloading, and image configuration. Public route samples cover home, projects, Pocketchange, privacy and cookies. Shared case-study components cover the other CMS case studies. The Sanity editor itself was not performance-profiled.

Existing good behaviour retained: preloaded hero images; responsive Next image sizes; AVIF/WebP image optimisation; lazy imports for noncritical WebGL scenes; shared GSAP/Lenis ticking; offscreen Profile scene suspension; capped canvas resolution; bounded grid texture caches; project destination preloading; and consent-gated calendar loading.

## Production frame samples

Three-second automated scroll samples at 440×900 and 1440×900, DPR 1, using Chromium/SwiftShader. These are viewport/layout samples, **not iPhone hardware benchmarks**. No main-thread long tasks over 50ms or horizontal page overflow were recorded in these samples. A lack of long tasks does not imply the GPU/compositor meets its frame budget.

| Route | 440px median / p95 | 1440px median / p95 |
| --- | --- | --- |
| Home | 16.7 / 16.7ms | 16.7 / 16.8ms |
| Projects ribbon | 16.7 / 33.3ms | 16.7 / 33.3ms |
| Pocketchange | 16.7 / 16.8ms | 49.9 / 50.1ms |
| Privacy | 16.7 / 16.8ms | 33.4 / 50.1ms |
| Cookies | 16.7 / 16.8ms | 33.4 / 50.1ms |

The slower desktop samples remain an unresolved performance qualification item. Hardware profiling is needed to distinguish software-rasterisation cost from a real-device compositor bottleneck, especially around the progressive header backdrop blur. No visual effect was removed merely to improve a software-renderer score.

The existing mobile intro test also ran at 390px/DPR 3 with 4× and 6× CPU slowdown against the development server: median 16.7ms, p95 16.7ms and 33.3ms respectively, with no long tasks. This is a synthetic check, not a physical-phone result.

## Verification

- Production build, strict TypeScript and Biome/Stylelint pass.
- 39 distinct production browser checks passed across the audit suite and targeted reruns, including contact modal consent, mobile and reduced-motion behaviour. Three additional development mobile intro/budget checks passed.
- Browser checks verify images and the reveal renderer are ready while the first tile is still offscreen at desktop/mobile widths, while the final distant image remains lazy.
- Reveal scrub/reversal, static draw suspension, reduced motion, media layout, mobile panel behaviour, footer, progressive header blur, Profile preparation/suspension, route transitions and error/security pages were exercised.
- Desktop/mobile rendered screenshots were inspected.
- New repeatable diagnostic: `tests/site-performance-audit.spec.ts` records renderer identity, median/p95 frame intervals, long tasks and overflow. Its functional assertions do not certify an FPS target.

Production tests must use an origin allowed by Sanity. Direct CDN texture requests accepted `http://localhost:3001` and `https://joebentaylor.co.uk`, but returned 403 for the temporary `http://localhost:3002` origin. The production suite was rerun on port 3001; no Sanity CORS configuration was changed.

## Remaining real-device acceptance

On the iPhone 16 Pro Max, test a production build on an allowed origin with Low Power Mode off and a 120Hz display mode available. Measure cold/warm entry, fast forward/reverse scrolling, the stacked mobile ribbon, media/video reveals, opening/closing Profile, and route changes. Check frame pacing and GPU time, not only Lighthouse. Also test a throttled connection: preload buffers improve readiness but cannot guarantee a completed network request during an arbitrarily fast jump or an offline connection.

The development server was restored at http://localhost:3001 after production testing. No deployment or Git push was performed.
