# Performance audit — 16 October 2026

Measured against a local production build with Lighthouse performance presets. These are lab measurements, not real-device or field guarantees.

| Measurement | Mobile before | Mobile after | Desktop after |
| --- | --- | --- | --- |
| Performance score | 79 | 88 | 98 |
| Largest contentful paint | 5.2 s | 3.8 s | 0.8 s |
| Total blocking time | 10 ms | 10 ms | 0 ms |
| Cumulative layout shift | 0 | 0 | 0 |
| Homepage transfer | 1.46 MB | 0.51 MB | 1.01 MB |

## Changes

- Hero and Recognition detach their GSAP ticker callbacks when hidden or outside the viewport. The hero also suspends behind the Profile modal.
- Recognition starts at actual viewport intersection, caps pixel ratio at 1.5 on mobile and 2 on desktop, and uses 160 rather than 2,560 triangles per unselected card. Opening a card restores its detailed mesh for the paper animation.
- Matrix rain reuses its wave uniform buffer and avoids an extra draw when hidden. Globe and toolkit engines already suspend when off-screen.
- Corrected responsive portrait image sizing: the measured mobile image transfer fell from 196 KB to 29 KB. The desktop-only liquid renderer is dynamically imported.
- Deferred the globe's approximately 757 KB background until it is visible.
- Cached hover and settings media queries instead of constructing them repeatedly.
- Root font size is 62.5% on mobile, 125% from `bp(m)` (700 px), and 62.5% again at `bp(l)` (1024 px). The CTA retains its mobile arrangement through tablet. Existing large-screen scaling remains.

## Verification

- Type checking, linting, production build and whitespace checks passed.
- Instrumented WebGL draw-call tests passed at 390, 768, 1024 and 1440 px: Recognition, rain, toolkit and globe stop drawing when scrolled out of view. These tests also check root typography and horizontal overflow.
- The 390 px test was rerun after deferring the globe background and confirms no initial request for that asset.
- Loader, Recognition, mobile interaction and Profile reset regression coverage passed: 12 tests passed together; one settings test timed out while the build was running and passed in isolation on rerun.

## Remaining limits

Mobile LCP at 3.8 seconds still needs improvement before claiming an excellent mobile loading result. Lighthouse flags approximately 46 KiB of unused JavaScript, 15 KiB of legacy JavaScript and a small render-blocking opportunity. These are not a justification for removing shared animation/runtime functionality without further profiling. Desktop performance remained 98. Physical phone GPU, battery and thermal behaviour were not measured; the interaction checks used Chromium viewport emulation.
