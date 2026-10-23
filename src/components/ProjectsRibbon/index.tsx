'use client';

import { GlobalContext } from '@parts/Contexts';
import { HERO_DESKTOP_QUERY } from '@parts/Hero/layout';
import ProjectHero from '@parts/ProjectHero';
import { heroFrame } from '@parts/ProjectHero/framing';
import type { ProjectHeroProps } from '@parts/ProjectHero/interface';
// Imports
// ------------
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { mq } from '@tackl';
import { afterHeroEntrance } from '@utils/afterHeroEntrance';
import { markProjectModalEntry } from '@utils/projectModal';
import { getImageProps } from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useEffect, useRef, useState } from 'react';
import { holdProjectHero } from './handoff';

// Styles
// ------------
import s from './styles.module.scss';

// Helpers
// ------------
// NOTE • Same props as ProjectHero's image, so the browser caches the very candidate the hero will pick
const warmHero = (src: string) => {
	const { props } = getImageProps({ src, alt: '', fill: true, sizes: '100vw', quality: 90 });
	const image = new Image();
	if (props.sizes) image.sizes = props.sizes;
	if (props.srcSet) image.srcset = props.srcSet;
	image.src = props.src;
	image.decode?.().catch(() => {});
};

// Component
// ------------
const ProjectsRibbon = () => {
	const { lenisRef, pagePath } = use(GlobalContext);
	const active = /^\/projects\/?$/.test(pagePath);
	// Refs
	const frame = useRef<HTMLIFrameElement>(null);
	const measure = useRef<HTMLDivElement>(null);
	const startRibbon = useRef<() => void>(null);
	const [preview, setPreview] = useState<{ request: number; project: ProjectHeroProps['project'] } | null>(null);
	// State
	const searchParams = useSearchParams();
	const router = useRouter();
	const project = searchParams.get('project');

	// Handlers
	const syncRoute = () => {
		if (frame.current?.contentWindow?.location.pathname !== '/projects-ribbon/index.html') return;
		frame.current?.contentWindow?.postMessage({ type: 'projects:active', active }, window.location.origin);
		if (active) frame.current?.contentWindow?.postMessage({ type: 'projects:route' }, window.location.origin);
	};

	// Effects
	useEffect(() => {
		if (!preview) return;
		let cancelled = false;
		const prepare = async () => {
			await document.fonts.ready;
			const image = measure.current?.querySelector('img');
			if (!image) return;
			try {
				await image.decode();
				if (cancelled) return;
				const framing = heroFrame(
					image.getBoundingClientRect().height,
					window.innerHeight,
					matchMedia(`${mq.up.l} and (prefers-reduced-motion: no-preference)`).matches
				);
				frame.current?.contentWindow?.postMessage(
					{
						type: 'projects:prepared',
						request: preview.request,
						heroHeight: framing.height,
						heroTop: framing.top,
						hero: image.currentSrc || image.src,
					},
					window.location.origin
				);
				setPreview(null);
			} catch {
				if (!cancelled)
					frame.current?.contentWindow?.postMessage(
						{ type: 'projects:prepared', request: preview.request, error: true },
						window.location.origin
					);
			}
		};
		void prepare();
		return () => {
			cancelled = true;
		};
	}, [preview]);

	useEffect(() => {
		// Header links stay interactive while their pointer motion reaches the canvas below.
		const forward = (event: PointerEvent) => {
			if (!active) return;
			if (!(event.target instanceof Element) || !event.target.closest('header')) return;
			const element = frame.current;
			const canvas = element?.contentDocument?.querySelector('canvas');
			if (!element || !canvas || element.dataset.ready !== 'true') return;
			const rect = element.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			canvas.dispatchEvent(
				new PointerEvent('pointermove', {
					bubbles: true,
					clientX: event.clientX - rect.left,
					clientY: event.clientY - rect.top,
					pointerType: event.pointerType,
					pointerId: event.pointerId,
				})
			);
		};
		window.addEventListener('pointermove', forward, { passive: true });
		return () => window.removeEventListener('pointermove', forward);
	}, [active]);

	useEffect(() => {
		const openProject = async (event: MessageEvent) => {
			// NOTE • Same origin is the trust boundary: WebKit can report this window, not the frame, as the source
			// of the ribbon's messages, and requiring the frame dropped `wave-ready` — the ribbon never appeared
			const fromRibbon = event.source === frame.current?.contentWindow || event.source === window;
			if (event.origin !== window.location.origin || !fromRibbon) return;
			if (event.data?.type === 'projects:error') {
				frame.current?.setAttribute('data-ready', 'true');
				return;
			}
			if (event.data?.type === 'projects:wave-ready') {
				frame.current?.setAttribute('data-ready', 'true');
				frame.current?.setAttribute('data-ribbon-ready', 'true');
				return;
			}
			// NOTE • The ribbon prefetches each featured case study in idle time: warm its route and
			// the exact hero image its page will request, so a tap starts the transition at once
			if (
				event.data?.type === 'projects:prefetch' &&
				typeof event.data.href === 'string' &&
				/^\/projects\/[^/]+\/?$/.test(event.data.href) &&
				typeof event.data.hero === 'string'
			) {
				router.prefetch(event.data.href);
				warmHero(event.data.hero);
				return;
			}
			if (
				event.data?.type === 'projects:prepare' &&
				typeof event.data.href === 'string' &&
				/^\/projects\/[^/]+\/?$/.test(event.data.href)
			) {
				router.prefetch(event.data.href);
				const data = event.data;
				if (
					typeof data.hero === 'string' &&
					typeof data.title === 'string' &&
					typeof data.description === 'string'
				) {
					setPreview({
						request: data.request,
						project: {
							title: data.title,
							description: data.description,
							hero: { src: data.hero, alt: data.title },
						},
					});
				}
				return;
			}
			// NOTE • A non-featured case study: open the profile panel on it (@modal slot), no hero handoff
			if (
				event.data?.type === 'projects:modal' &&
				typeof event.data.href === 'string' &&
				/^\/projects\/[^/]+\/?$/.test(event.data.href)
			) {
				const href = event.data.href.replace(/\/?$/, '/');
				markProjectModalEntry(href);
				router.push(href, { transitionTypes: ['project-modal'], scroll: false });
				return;
			}
			if (event.data?.type !== 'projects:open') return;
			if (typeof event.data.href !== 'string') return;
			const href = event.data.href;
			if (/^\/projects\/[^/]+\/?$/.test(href) && event.data.completed === true) {
				if (typeof event.data.hero !== 'string' || !Number.isFinite(event.data.heroHeight)) return;
				try {
					await holdProjectHero(
						event.data.hero,
						event.data.heroHeight,
						event.data.heroTop || 0,
						lenisRef.current?.lenis
					);
				} catch {
					// Navigation still works if the browser cannot decode the cover.
				}
				router.push(href, { transitionTypes: ['project-mesh'] });
			} else if (/^https?:\/\//.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
		};
		window.addEventListener('message', openProject);
		return () => window.removeEventListener('message', openProject);
	}, [router, lenisRef]);

	useEffect(() => {
		const element = frame.current;
		if (!element) return;
		// Prepare the canvas behind the first-visit loader so its wave can refract it.
		let started = false;
		const start = () => {
			if (started) return;
			started = true;
			// NOTE • Phones fade the loader out instead of waving it, so they never need the ribbon's refraction pass
			const playIntroduction =
				/^\/projects\/?$/.test(location.pathname) &&
				!isLoaderSettled() &&
				matchMedia(HERO_DESKTOP_QUERY).matches;
			// Replace avoids adding iframe-only entries to the browser's Back stack.
			element.contentWindow?.location.replace(
				`/projects-ribbon/index.html${playIntroduction ? '?loaderWave=1' : '?entrance=cascade'}`
			);
		};
		startRibbon.current = start;
		// Elsewhere the ribbon boots in the background, after the homepage's text entrance
		let stopWaiting = () => {};
		const prepare = () => {
			stopWaiting = afterHeroEntrance(start);
		};
		if (/^\/projects\/?$/.test(location.pathname)) start();
		else if (isLoaderSettled()) prepare();
		else window.addEventListener(LOADER_SETTLED, prepare, { once: true });
		return () => {
			window.removeEventListener(LOADER_SETTLED, prepare);
			stopWaiting();
			startRibbon.current = null;
			delete element.dataset.ribbonReady;
			// The layout owns this frame; only a document teardown unloads it.
			delete element.dataset.ready;
			element.contentWindow?.location.replace('about:blank');
		};
	}, []);

	useEffect(() => {
		// Visiting /projects before the background boot starts it straight away
		if (active) startRibbon.current?.();
		// Also handles Next.js navigation back to /projects from its header link.
		frame.current?.contentWindow?.postMessage({ type: 'projects:active', active }, window.location.origin);
		if (active)
			frame.current?.contentWindow?.postMessage({ type: 'projects:route', project }, window.location.origin);
	}, [project, active]);

	// Render
	return (
		<section
			className={s.jacket}
			aria-label='Projects'
			data-state={active ? 'active' : 'cached'}
			aria-hidden={!active}
			inert={!active}
			data-lenis-prevent
		>
			<iframe ref={frame} title='Interactive projects' onLoad={syncRoute} />
			{preview && (
				<div ref={measure} className={s.measure} aria-hidden='true' inert>
					<ProjectHero project={preview.project} preview />
				</div>
			)}
		</section>
	);
};

// Exports
// ------------
ProjectsRibbon.displayName = 'ProjectsRibbon';
export default ProjectsRibbon;
