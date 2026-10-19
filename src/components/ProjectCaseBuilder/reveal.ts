import { mediaScrollRoot } from '@utils/preloadNearbyMedia';
import { mediaEasings, mediaSettings } from './settings';

// Native media stays in place; only its rounded clipping window animates.
export function mountMediaReveal(root: HTMLElement) {
	const tiles = Array.from(root.querySelectorAll<HTMLElement>('[data-media-tile]'));
	const visible = new Set<HTMLElement>();
	const animations = new Map<HTMLElement, Animation>();
	const finish = (tile: HTMLElement) => {
		tile.dataset.revealComplete = 'true';
		delete tile.dataset.revealPending;
		delete tile.dataset.revealing;
		animations.get(tile)?.cancel();
		animations.delete(tile);
	};
	const reveal = (tile: HTMLElement) => {
		if (!visible.has(tile) || tile.dataset.revealComplete === 'true' || animations.has(tile)) return;
		const figure = tile.querySelector('figure');
		// NOTE • A YouTube iframe has no load state worth waiting on — it reveals straight away
		const media = tile.querySelector('img, video, iframe');
		if (!figure || !media) return;
		if (media instanceof HTMLImageElement && (!media.complete || !media.naturalWidth)) return;
		if (media instanceof HTMLVideoElement && media.readyState < 2) return;
		const radius = getComputedStyle(figure).borderRadius;
		const animation = figure.animate(
			[{ clipPath: `inset(50% round ${radius})` }, { clipPath: `inset(0% round ${radius})` }],
			{
				duration: mediaSettings.duration * 1000,
				delay: (mediaSettings.delay + (tile.previousElementSibling ? mediaSettings.stagger : 0)) * 1000,
				easing: mediaEasings[mediaSettings.easing],
				fill: 'both',
			}
		);
		tile.dataset.revealing = 'true';
		animations.set(tile, animation);
		animation.onfinish = () => finish(tile);
		observer.unobserve(tile);
	};
	const scrollRoot = mediaScrollRoot(root);
	const triggerInset =
		Math.min(innerHeight, scrollRoot?.clientHeight || innerHeight) * (1 - mediaSettings.trigger / 100);
	const observer = new IntersectionObserver(
		entries => {
			for (const entry of entries) {
				const tile = entry.target as HTMLElement;
				if (entry.isIntersecting) {
					visible.add(tile);
					reveal(tile);
				} else visible.delete(tile);
			}
		},
		{ root: scrollRoot, rootMargin: `0px 0px -${triggerInset}px 0px` }
	);
	for (const tile of tiles) {
		if (tile.dataset.revealComplete === 'true') continue;
		tile.dataset.revealPending = 'true';
		observer.observe(tile);
	}
	const loaded = (event: Event) => {
		const tile = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-media-tile]') : null;
		if (tile) reveal(tile);
	};
	root.addEventListener('load', loaded, true);
	root.addEventListener('loadeddata', loaded, true);
	root.dataset.revealReady = 'true';
	return () => {
		observer.disconnect();
		root.removeEventListener('load', loaded, true);
		root.removeEventListener('loadeddata', loaded, true);
		delete root.dataset.revealReady;
		// Preserve completed/started tiles across layout changes and reduced motion.
		for (const tile of animations.keys()) finish(tile);
		for (const tile of tiles) delete tile.dataset.revealPending;
	};
}
