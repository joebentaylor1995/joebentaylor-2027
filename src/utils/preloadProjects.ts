import { preload } from 'react-dom';

// The ribbon is a separate document, so Next's route prefetch cannot warm its assets.
const RIBBON_URL = '/projects-ribbon/index.html';
const CATALOG_LIFETIME = 60_000;
let started = false;

declare global {
	interface Window {
		getPreloadedProjects?: () => Promise<unknown> | undefined;
	}
}

export function preloadProjects() {
	if (started) return;
	started = true;
	const created = Date.now();
	const catalog = fetch('/api/projects-ribbon/', { signal: AbortSignal.timeout(10_000) }).then(response => {
		if (!response.ok) throw new Error('Projects preload unavailable');
		return response.json() as Promise<unknown>;
	});
	window.getPreloadedProjects = () => (Date.now() - created < CATALOG_LIFETIME ? catalog : undefined);
	void catalog
		.then(async data => {
			if (!data || typeof data !== 'object') return;
			const items = [
				...('featured' in data && Array.isArray(data.featured) ? data.featured : []),
				...('all' in data && Array.isArray(data.all) ? data.all : []),
			];
			const posters = new Set<string>();
			for (const item of items) {
				if (item && typeof item === 'object' && 'poster' in item && typeof item.poster === 'string')
					posters.add(new URL(item.poster, new URL(RIBBON_URL, location.origin)).href);
			}
			await Promise.allSettled(
				Array.from(posters, src => {
					const image = new Image();
					image.crossOrigin = 'anonymous';
					image.fetchPriority = 'low';
					image.src = src;
					return image.decode();
				})
			);
		})
		.catch(() => {
			window.getPreloadedProjects = undefined;
			started = false;
		});
	void fetch(RIBBON_URL)
		.then(response => response.text())
		.then(html => {
			const document = new DOMParser().parseFromString(html, 'text/html');
			for (const element of document.querySelectorAll('script[src], link[rel="stylesheet"][href]')) {
				const source = element.getAttribute('src') || element.getAttribute('href');
				if (source)
					preload(new URL(source, new URL(RIBBON_URL, location.origin)).href, {
						as: element.tagName === 'SCRIPT' ? 'script' : 'style',
						fetchPriority: 'low',
					});
			}
		})
		.catch(() => undefined);
}
