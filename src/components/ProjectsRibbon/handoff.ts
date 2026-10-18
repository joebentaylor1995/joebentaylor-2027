import { lockProjectScroll } from '@utils/lockProjectScroll';
import { PROJECT_HANDOFF_SETTLED } from '@utils/projectHandoff';
import type Lenis from 'lenis';
import s from './styles.module.scss';

// This cover survives the iframe's unmount while the destination image decodes.
export async function holdProjectHero(src: string, height: number, top: number, lenis?: Lenis) {
	const cover = document.createElement('div');
	cover.className = s.handoff;
	cover.dataset.projectHandoff = 'true';
	cover.setAttribute('aria-hidden', 'true');
	const image = new Image();
	image.src = src;
	await image.decode();
	const unlock = lockProjectScroll(lenis);
	cover.style.setProperty('--handoff-height', `${height}px`);
	cover.style.setProperty('--handoff-top', `${top}px`);
	cover.append(image);
	// Share the header's stacking context: a body-level cover sits above the
	// isolated profile scene regardless of the header's own z-index.
	(document.querySelector('[data-profile-scene]') || document.body).append(cover);
	let releasing = false;
	let removed = false;
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
	const check = async () => {
		// Cached case studies can remain in hidden Activity trees. Only the live
		// destination can release the cover; an old hidden hero would time out.
		const hero = Array.from(document.querySelectorAll<HTMLElement>('[data-project-hero]')).find(
			element => element.getBoundingClientRect().width > 0
		);
		const photo = hero?.querySelector<HTMLImageElement>('img');
		if (releasing || !photo?.complete || !photo.naturalWidth || !hero?.getBoundingClientRect().width) return;
		releasing = true;
		try {
			await photo.decode();
			await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
			await cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished;
		} finally {
			remove();
		}
	};
	const observer = new MutationObserver(() => void check());
	const onLoad = () => void check();
	document.addEventListener('load', onLoad, true);
	observer.observe(document.body, { childList: true, subtree: true, attributes: true });
	// Never strand the visitor behind a cover after a failed navigation.
	const deadline = window.setTimeout(remove, 10000);
	void check();
}
