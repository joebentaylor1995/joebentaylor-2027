import { getImageProps } from 'next/image';

const pending = new Map<string, { time: number; ready: Promise<void> }>();

// Warm the same responsive, quality-90 image the destination hero will use.
export function preloadProject(href: string): Promise<void> {
	const url = new URL(href, location.href);
	if (url.origin !== location.origin || !/^\/projects\/[^/]+\/?$/.test(url.pathname)) return Promise.resolve();
	const key = `${url.pathname}:${innerWidth}:${devicePixelRatio}`;
	const cached = pending.get(key);
	if (cached && Date.now() - cached.time < 60000) return cached.ready;
	const ready = (async () => {
		try {
			const slug = url.pathname.split('/').filter(Boolean).at(-1);
			const response = await fetch(`/api/projects-ribbon/?project=${encodeURIComponent(slug || '')}`, {
				signal: AbortSignal.timeout(6000),
			});
			if (!response.ok) throw new Error('Project preload failed');
			const data = await response.json();
			if (typeof data.hero !== 'string') throw new Error('Missing hero');
			const { props } = getImageProps({ src: data.hero, alt: '', fill: true, sizes: '100vw', quality: 90 });
			const image = new Image();
			image.sizes = props.sizes || '100vw';
			image.srcset = props.srcSet || '';
			image.src = props.src;
			await image.decode();
		} catch {
			pending.delete(key);
		}
	})();
	if (pending.size >= 4) pending.delete(pending.keys().next().value as string);
	pending.set(key, { time: Date.now(), ready });
	return ready;
}

export async function waitForProjectPreload(href: string) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			preloadProject(href),
			new Promise<void>(resolve => {
				timer = setTimeout(resolve, 2500);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}
