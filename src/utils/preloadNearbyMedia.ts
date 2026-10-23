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
const LAZY_MEDIA = 'img[loading="lazy"], video[preload="none"]';

// Helpers
// ------------
// NOTE • decode() too, so an image paints the moment it arrives instead of decoding on screen
const warm = (media: Element) => {
	if (media instanceof HTMLImageElement) {
		media.loading = 'eager';
		media.decode?.().catch(() => {});
	} else if (media instanceof HTMLVideoElement && media.preload === 'none') {
		media.preload = 'auto';
		media.load();
	}
};

// Exports
// ------------
export function mediaScrollRoot(host: HTMLElement) {
	// Desktop case studies translate content inside a clipped, pinned panel.
	// Expanding an ancestor's margin cannot pierce that intermediate clip.
	return host.closest('[data-project-experience][data-enhanced="true"]')
		? host.closest<HTMLElement>('[data-project-panel]')
		: host.closest<HTMLElement>('#profile-panel, .lenis');
}

export function preloadNearbyMedia(host: HTMLElement) {
	let observer: IntersectionObserver | undefined;
	const pending = new Set<Element>();
	const track = (media: Element) => {
		if (pending.has(media)) return;
		pending.add(media);
		observer?.observe(media);
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
					pending.delete(entry.target);
					warm(entry.target);
				}
			},
			{ root, rootMargin: `${margin}px 0px` }
		);
		observer = current;
		for (const media of pending) current.observe(media);
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
		additions.disconnect();
		layout.disconnect();
	};
}
