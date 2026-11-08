// Imports
// ------------
import { lockProjectScroll } from '@utils/lockProjectScroll';
import { PROJECT_HANDOFF_SETTLED } from '@utils/projectHandoff';
import type Lenis from 'lenis';

// Styles + Interfaces
// ------------
import s from './styles.module.scss';

// Handoff
// ------------
// Covers the page with the clicked project's hero image while the case study loads, then
// fades it out once the live hero has decoded. Scroll stays locked meanwhile.
// This cover survives the iframe's unmount while the destination image decodes.
export async function holdProjectHero(src: string, height: number, top: number, lenis?: Lenis) {
	const cover = document.createElement('div');
	cover.className = s.handoff;
	cover.dataset.projectHandoff = 'true';
	cover.setAttribute('aria-hidden', 'true');

	// Decode the image first so the cover never shows a half-loaded picture
	const image = new Image();
	image.src = src;
	await image.decode();
	const unlock = lockProjectScroll(lenis);
	// Position the cover over the hero's place on screen
	cover.style.setProperty('--handoff-height', `${height}px`);
	cover.style.setProperty('--handoff-top', `${top}px`);
	cover.append(image);
	// Share the header's stacking context: a body-level cover sits above the
	// isolated profile scene regardless of the header's own z-index.
	(document.querySelector('[data-profile-scene]') || document.body).append(cover);

	let releasing = false;
	let removed = false;

	// Tears the cover down and unlocks scroll; runs at most once, from the fade or the deadline
	const remove = () => {
		if (removed) return;
		removed = true;
		observer.disconnect();
		document.removeEventListener('load', onLoad, true);
		window.clearTimeout(deadline);
		cover.remove();
		unlock();
		window.dispatchEvent(new Event(PROJECT_HANDOFF_SETTLED));
	};

	// Releases the cover once the destination hero is on screen with its image decoded
	const check = async () => {
		// NOTE • Runs on every DOM mutation batch while the case study commits, and the lookup below forces a layout:
		// once releasing, nothing can change the outcome, so skip it
		if (releasing) return;
		// Cached case studies can remain in hidden Activity trees. Only the live
		// destination can release the cover; an old hidden hero would time out.
		const hero = Array.from(document.querySelectorAll<HTMLElement>('[data-project-hero]')).find(
			element => element.getBoundingClientRect().width > 0
		);
		const photo = hero?.querySelector<HTMLImageElement>('img');
		if (!photo?.complete || !photo.naturalWidth || !hero?.getBoundingClientRect().width) return;
		releasing = true;
		// Nothing else can release the cover now
		observer.disconnect();
		document.removeEventListener('load', onLoad, true);
		try {
			await photo.decode();
			await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
			await cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished;
		} finally {
			remove();
		}
	};

	// Re-check whenever the DOM changes or an image finishes loading
	const observer = new MutationObserver(() => void check());
	const onLoad = () => void check();
	document.addEventListener('load', onLoad, true);
	observer.observe(document.body, { childList: true, subtree: true, attributes: true });
	// Never strand the visitor behind a cover after a failed navigation.
	const deadline = window.setTimeout(remove, 10000);
	void check();
}
