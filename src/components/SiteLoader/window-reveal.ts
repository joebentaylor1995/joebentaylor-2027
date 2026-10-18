import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { type LoaderSettings, loaderSettings } from './settings';

gsap.registerPlugin(CustomEase);
const windowEase = CustomEase.create('loader-window', '0.625, 0.05, 0, 1');

// Match the reference's separate 1s travel and 1.2s inset opening.
export function renderRevealWindow(
	window: Element | null,
	width: number,
	height: number,
	origin: LoaderSettings['revealOrigin'],
	progress: number,
	page?: HTMLElement | null
) {
	const p = Math.max(0, Math.min(1, progress));
	const opening = windowEase(p);
	const travel = windowEase(Math.min(1, p * 1.2));
	const offset = origin === 'lower' ? height * 0.5 * (1 - travel) : 0;
	const w = (width + 2) * opening;
	const h = (height + 2) * opening;
	if (page) {
		const hero = page.querySelector<HTMLElement>('[data-project-hero]');
		const startScale = loaderSettings.heroStartScale;
		if (p < 1) hero?.style.setProperty('--project-intro-scale', String(startScale + opening * (1 - startScale)));
		else hero?.style.removeProperty('--project-intro-scale');
		if (p > 0 && p < 1) {
			page.dataset.loaderWindow = 'true';
			page.style.setProperty('--loader-page-y', `${offset}px`);
		} else {
			delete page.dataset.loaderWindow;
			page.style.removeProperty('--loader-page-y');
		}
	}
	for (const [name, value] of Object.entries({
		x: (width - w) / 2,
		y: (height - h) / 2 + offset,
		width: w,
		height: h,
		rx: 0,
		ry: 0,
	}))
		window?.setAttribute(name, String(value));
}
