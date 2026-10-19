// Keep native lazy loading as the no-JS fallback, but warm media a viewport ahead
// of the actual nested scroller rather than waiting for a clipped tile to appear.
export function mediaScrollRoot(host: HTMLElement) {
	// Desktop case studies translate content inside a clipped, pinned panel.
	// Expanding an ancestor's margin cannot pierce that intermediate clip.
	return host.closest('[data-project-experience][data-enhanced="true"]')
		? host.closest<HTMLElement>('[data-project-panel]')
		: host.closest<HTMLElement>('#profile-panel, .lenis');
}

export function preloadNearbyMedia(host: HTMLElement) {
	let observer: IntersectionObserver;
	const pending = new Set(host.querySelectorAll('img[loading="lazy"], video[preload="none"]'));
	const connect = () => {
		observer?.disconnect();
		const root = mediaScrollRoot(host);
		const margin = Math.max(800, Math.min(innerHeight, root?.clientHeight || innerHeight));
		observer = new IntersectionObserver(
			entries => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const media = entry.target;
					observer.unobserve(media);
					pending.delete(media);
					if (media instanceof HTMLImageElement) media.loading = 'eager';
					else if (media instanceof HTMLVideoElement && media.preload === 'none') {
						media.preload = 'auto';
						media.load();
					}
				}
			},
			{ root, rootMargin: `${margin}px 0px` }
		);
		for (const media of pending) observer.observe(media);
	};
	connect();
	// The parent's scroll enhancement is installed after child effects, and can
	// change again at the desktop breakpoint or with reduced-motion preferences.
	const experience = host.closest('[data-project-experience]');
	const layout = new MutationObserver(connect);
	if (experience) layout.observe(experience, { attributes: true, attributeFilter: ['data-enhanced'] });
	return () => {
		observer.disconnect();
		layout.disconnect();
	};
}
