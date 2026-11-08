// Imports
// ------------
import { gsap } from 'gsap';
import { loaderSettings } from './settings';

// Helpers
// ------------
const fadeEase = gsap.parseEase('sine.inOut');
const zoomEase = gsap.parseEase('power2.out');
const clamp = (value: number) => Math.max(0, Math.min(1, value));

// Reveal
// ------------
// Fades the loader out over revealDuration while the hero zooms down from
// heroStartScale over heroZoomDuration. `elapsed` is seconds since the reveal began.
// NOTE • The zoom runs for seconds after the loader has gone, and this runs every frame of it.
// Writes that would set what's already there (the solid logo, the faded-out loader) are
// skipped; every other frame writes exactly as before.
export function renderFade(root: HTMLElement, mark: Element | null, hero: HTMLElement | null, elapsed: number) {
	const fade = fadeEase(clamp(elapsed / loaderSettings.revealDuration));
	// The logo stays solid; only the whole loader fades, and it stops blocking clicks once gone
	if (!(mark instanceof HTMLElement) || mark.style.opacity !== '1') gsap.set(mark, { opacity: 1 });
	const faded = fade === 1 && root.style.opacity === '0' && root.style.pointerEvents === 'none';
	if (!faded) gsap.set(root, { opacity: 1 - fade, pointerEvents: fade === 1 ? 'none' : 'auto' });

	// The hero scale is handed to CSS as a variable, and removed once the zoom completes
	const zoom = zoomEase(clamp(elapsed / loaderSettings.heroZoomDuration));
	if (zoom === 1) hero?.style.removeProperty('--project-intro-scale');
	else hero?.style.setProperty('--project-intro-scale', String(1 + (loaderSettings.heroStartScale - 1) * (1 - zoom)));
}
