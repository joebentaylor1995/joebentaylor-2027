# Hero depth effect

The Hero's Background renders the refined portrait effect directly in WebGL. No iframe, prototype title, status label, or controls appear on the normal page.

Open `/?heroSettings=1` to load the optional controls. That exact flag dynamically imports the settings component and its styles; normal visits never request them. The flag is a convenience for tuning, not an authentication mechanism. Changes in the panel are temporary. Update `src/components/Hero/Background/effect-settings.ts` to change the shipped defaults.

The saved setup includes blue-only cursor and scroll chromatic effects, fingertip glow, scroll depth zoom, trails, and focus pull. Wireframe remains available but disabled. Scroll effects respond only to downward input, hold their peak during a continuous gesture, and return to zero after it stops. They do not cancel wheel/touch events or block the site's Lenis scrolling. Particle dispersion and click pulses are removed.

The renderer shares GSAP's ticker, pauses when the hero is offscreen or the tab is hidden, stops drawing once motion settles (idle frames are skipped until the pointer, scroll or settings change), and releases listeners and GPU resources on unmount. Canvas resolution is capped at 1.5× device pixels. Reduced-motion visitors see the original static portrait. Failed image loading or unavailable/lost WebGL also leaves the static image visible; restored contexts rebuild the renderer.

Assets are in `public/images/hero-depth/`: the transparent 4046×2799 source portrait and the 1508×1043 generated depth map. The portrait is served through `next/image` (responsive AVIF/WebP), and the WebGL texture reuses the fallback `<img>` element, so each visitor downloads one viewport-sized copy. The source PNG is never sent to the browser. The depth map is a single-channel lossless WebP, with values exactly matching the original red channel. The local nose-depth correction is baked into the depth texture once on the CPU (`bakeDepth` in `renderer.ts`), so the ray march reads one depth texel per step. This is a single-image depth illusion; large parallax and zoom settings can reveal approximation artifacts.
