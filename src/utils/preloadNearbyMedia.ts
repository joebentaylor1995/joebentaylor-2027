// Keep native lazy loading as the no-JS fallback, but warm media well ahead of
// the actual nested scroller rather than waiting for a clipped tile to appear.
// Native lazy loading can't see past a panel's own scroll box (the profile
// panel, a case study's pinned panel), so without this it loads on sight.

// Constants
// ------------
// NOTE • Media should be loaded and decoded a full screen before it's seen. A
// fetch started one screen ahead lands about 0.8 of a screen ahead on Fast 4G
// (measured in the project modal), so loading starts three screens out
const LEAD_SCREENS = 3;
const MIN_LEAD = 2400;
// NOTE • A video only reads its metadata (shape, length) that far out, and starts
// buffering one screen out: a visitor who never gets there costs a few KB
const BUFFER_SCREENS = 1;
const LAZY_MEDIA = 'img[loading="lazy"], video[preload="none"]';
// NOTE • Why: a tile waiting for its reveal clips its figure to a centre line (clip-path), and
// an IntersectionObserver honours that clip. Media behind a further overflow box (a slideshow's
// slides, a gallery's cards) or off that line (thumbnails) never intersected, however large the
// margin, so it only started loading once the reveal opened the clip: on screen. The tile itself
// is never clipped, so it is watched in its media's place.
const MEDIA_TILE = '[data-media-tile]';

// Helpers
// ------------
// NOTE • decode() too, so an image paints the moment it arrives instead of decoding on screen
const warm = (media: Element) => {
	if (media instanceof HTMLImageElement) {
		media.loading = 'eager';
		media.decode?.().catch(() => {});
	} else if (media instanceof HTMLVideoElement && media.preload === 'none') {
		media.preload = 'metadata';
		media.load();
	}
};

// Exports
// ------------
// The element whose scroll box the lazy media should be measured against
export function mediaScrollRoot(host: HTMLElement) {
	// Desktop case studies translate content inside a clipped, pinned panel.
	// Expanding an ancestor's margin cannot pierce that intermediate clip.
	return host.closest('[data-project-experience][data-enhanced="true"]')
		? host.closest<HTMLElement>('[data-project-panel]')
		: host.closest<HTMLElement>('#profile-panel, .lenis');
}

// ANCHOR • Loads and decodes every lazy image under `host` now, however far it is from view
// (a panel that is still closed); resolves once they are all in
export function warmImages(host: Element) {
	return Promise.all(
		Array.from(host.querySelectorAll<HTMLImageElement>('img[loading="lazy"]'), image => {
			// Not rendered (a fallback that may never show): leave it to load on demand
			if (!image.getClientRects().length) return undefined;
			image.loading = 'eager';
			return image.decode().catch(() => {});
		})
	);
}

// ANCHOR • Warms lazy images and videos ahead of the scroll; returns a cleanup
export function preloadNearbyMedia(host: HTMLElement) {
	let observer: IntersectionObserver | undefined;
	let bufferObserver: IntersectionObserver | undefined;

	// What each observer watches (a media tile, or the media itself outside one) and the media
	// waiting behind it
	const pending = new Map<Element, Set<Element>>();
	const unbuffered = new Map<Element, Set<HTMLVideoElement>>();
	const tracked = new WeakSet<Element>();

	const track = (media: Element) => {
		if (tracked.has(media)) return;
		tracked.add(media);
		const target = media.closest(MEDIA_TILE) ?? media;
		if (!pending.has(target)) pending.set(target, new Set());
		pending.get(target)?.add(media);
		observer?.observe(target);
		if (media instanceof HTMLVideoElement) {
			if (!unbuffered.has(target)) unbuffered.set(target, new Set());
			unbuffered.get(target)?.add(media);
			bufferObserver?.observe(target);
		}
	};

	// NOTE • Content that mounts after the panel opens (Profile's frames, a newly
	// opened case study) brings its own lazy media — watch for it too
	const collect = (node: Node) => {
		if (!(node instanceof Element)) return;
		if (node.matches(LAZY_MEDIA)) track(node);
		for (const media of node.querySelectorAll(LAZY_MEDIA)) track(media);
	};

	const connect = () => {
		observer?.disconnect();
		const root = mediaScrollRoot(host);
		const margin = Math.max(MIN_LEAD, (root?.clientHeight || innerHeight) * LEAD_SCREENS);
		const current = new IntersectionObserver(
			entries => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					current.unobserve(entry.target);
					for (const media of pending.get(entry.target) ?? []) warm(media);
					pending.delete(entry.target);
				}
			},
			{ root, rootMargin: `${margin}px 0px` }
		);
		observer = current;
		for (const target of pending.keys()) current.observe(target);

		bufferObserver?.disconnect();
		const buffering = new IntersectionObserver(
			entries => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					buffering.unobserve(entry.target);
					for (const video of unbuffered.get(entry.target) ?? []) video.preload = 'auto';
					unbuffered.delete(entry.target);
				}
			},
			{ root, rootMargin: `${(root?.clientHeight || innerHeight) * BUFFER_SCREENS}px 0px` }
		);
		bufferObserver = buffering;
		for (const target of unbuffered.keys()) buffering.observe(target);
	};

	collect(host);
	connect();

	const additions = new MutationObserver(records => {
		for (const record of records) for (const node of record.addedNodes) collect(node);
	});
	additions.observe(host, { childList: true, subtree: true });

	// The parent's scroll enhancement is installed after child effects, and can
	// change again at the desktop breakpoint or with reduced-motion preferences.
	const experience = host.closest('[data-project-experience]');
	const layout = new MutationObserver(connect);

	if (experience) layout.observe(experience, { attributes: true, attributeFilter: ['data-enhanced'] });

	return () => {
		observer?.disconnect();
		bufferObserver?.disconnect();
		additions.disconnect();
		layout.disconnect();
	};
}
