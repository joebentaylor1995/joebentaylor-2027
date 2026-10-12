# Hero depth effect

The Hero's Background renders the refined portrait effect directly in WebGL. No iframe, prototype title, status label, or controls appear on the normal page.

Open `/?heroSettings=1` to load the optional controls. That exact flag dynamically imports the settings component and its styles; normal visits never request them. The flag is a convenience for tuning, not an authentication mechanism. Changes in the panel are temporary. Update `src/components/Hero/Background/effect-settings.ts` to change the shipped defaults.

The saved setup includes blue-only cursor and scroll chromatic effects, fingertip glow, scroll depth zoom, trails, and focus pull. Wireframe remains available but disabled. Scroll effects respond only to downward input, hold their peak during a continuous gesture, and return to zero after it stops. They do not cancel wheel/touch events or block the site's Lenis scrolling. Particle dispersion and click pulses are removed.

The renderer shares GSAP's ticker, pauses when the hero is offscreen or the tab is hidden, and releases listeners and GPU resources on unmount. Reduced-motion visitors see the original static portrait. Failed image loading or unavailable/lost WebGL also leaves the static image visible; restored contexts rebuild the renderer.

Original assets are in `public/images/hero-depth/`: the transparent 4046×2799 portrait and the 1508×1043 generated depth map. They are preserved without recompression. Shader math includes the local nose-depth correction. This is a single-image depth illusion; large parallax and zoom settings can reveal approximation artifacts.
