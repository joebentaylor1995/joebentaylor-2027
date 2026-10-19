'use client';

// Imports
// ------------
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { preloadProject } from '@utils/preloadProject';
import { preloadProjects } from '@utils/preloadProjects';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Intent preloading also covers internal links rendered inside rich text.
export default function LinkPreloader() {
	const router = useRouter();
	useEffect(() => {
		const prepareProjects = () => {
			if (location.pathname !== '/') router.prefetch('/');
			if (/^\/projects\/?$/.test(location.pathname)) return;
			router.prefetch('/projects');
			preloadProjects();
		};
		if (isLoaderSettled()) prepareProjects();
		else window.addEventListener(LOADER_SETTLED, prepareProjects, { once: true });
		return () => window.removeEventListener(LOADER_SETTLED, prepareProjects);
	}, [router]);
	useEffect(() => {
		const warmed = new Map<string, number>();
		const prepare = (event: Event) => {
			const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
			if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
			const url = new URL(link.href, location.href);
			if (
				url.origin !== location.origin ||
				url.pathname.startsWith('/studio') ||
				(url.pathname === location.pathname && url.search === location.search)
			)
				return;
			const href = url.pathname + url.search;
			if (Date.now() - (warmed.get(href) || 0) < 30000) return;
			warmed.set(href, Date.now());
			router.prefetch(href);
			if (/^\/projects\/?$/.test(url.pathname)) preloadProjects();
			void preloadProject(href);
		};
		for (const name of ['pointerover', 'focusin', 'touchstart'])
			document.addEventListener(name, prepare, { passive: true });
		return () => {
			for (const name of ['pointerover', 'focusin', 'touchstart']) document.removeEventListener(name, prepare);
		};
	}, [router]);
	return null;
}
