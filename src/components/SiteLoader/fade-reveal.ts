import { gsap } from 'gsap';
import { loaderSettings } from './settings';

const fadeEase = gsap.parseEase('sine.inOut');
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function renderFade(root: HTMLElement, mark: Element | null, hero: HTMLElement | null, elapsed: number) {
	const fade = fadeEase(clamp(elapsed / loaderSettings.revealDuration));
	gsap.set(mark, { opacity: 1 });
	gsap.set(root, { opacity: 1 - fade, pointerEvents: fade === 1 ? 'none' : 'auto' });
	const zoom = gsap.parseEase('power2.out')(clamp(elapsed / loaderSettings.heroZoomDuration));
	if (zoom === 1) hero?.style.removeProperty('--project-intro-scale');
	else hero?.style.setProperty('--project-intro-scale', String(1 + (loaderSettings.heroStartScale - 1) * (1 - zoom)));
}
