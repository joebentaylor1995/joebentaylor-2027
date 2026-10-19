'use client';

import { GlobalContext } from '@parts/Contexts';
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { lockProjectScroll } from '@utils/lockProjectScroll';
import { releaseNavigationScene } from '@utils/navigationScene';
import { gsap } from 'gsap';
import { type ReactNode, use, useEffect, useMemo, useRef, ViewTransition } from 'react';
import { readWaveSettings, WAVE_SETTINGS_CHANGED } from './settings';
import s from './styles.module.scss';
import { waveTexture } from './texture';

// Native snapshots retain canvases, video and font rendering without DOM rasterisation.
export default function NavigationWave({ children }: { children: ReactNode }) {
	const { pagePath: pathname } = use(GlobalContext);
	const previous = useRef(pathname);
	const routeChanged = previous.current !== pathname;
	// Streaming updates can invoke onUpdate again for the same navigation.
	const navigation = useMemo(() => ({ pathname, played: false }), [pathname]);
	useEffect(() => {
		previous.current = pathname;
		releaseNavigationScene();
	}, [pathname]);
	const map = useRef<SVGFEImageElement>(null);
	const displacement = useRef<SVGFEDisplacementMapElement>(null);
	useEffect(() => {
		const prepare = () => map.current?.setAttribute('href', waveTexture(readWaveSettings()));
		if (isLoaderSettled()) prepare();
		else window.addEventListener(LOADER_SETTLED, prepare, { once: true });
		window.addEventListener(WAVE_SETTINGS_CHANGED, prepare);
		return () => {
			window.removeEventListener(LOADER_SETTLED, prepare);
			window.removeEventListener(WAVE_SETTINGS_CHANGED, prepare);
		};
	}, []);
	return (
		<>
			<svg className={s.jacket} aria-hidden='true' width='0' height='0'>
				<defs>
					<filter
						id='navigation-wave-lens'
						x='-25%'
						y='-25%'
						width='150%'
						height='150%'
						colorInterpolationFilters='sRGB'
					>
						<feFlood floodColor='rgb(128,128,128)' result='neutral' />
						<feImage ref={map} result='lens' preserveAspectRatio='none' />
						<feMerge result='field'>
							<feMergeNode in='neutral' />
							<feMergeNode in='lens' />
						</feMerge>
						<feDisplacementMap
							ref={displacement}
							in='SourceGraphic'
							in2='field'
							scale='0'
							xChannelSelector='R'
							yChannelSelector='G'
						/>
					</filter>
				</defs>
			</svg>
			<ViewTransition
				name='navigation-surface'
				update={{ 'project-mesh': 'none', default: 'pageWave' }}
				default='none'
				onUpdate={(instance, types) => {
					if (!routeChanged || types.includes('project-mesh')) return;
					if (navigation.played) return;
					navigation.played = true;
					if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
					const settings = readWaveSettings();
					const width = innerWidth,
						height = innerHeight;
					const x = (width * settings.originX) / 100,
						y = height * (1 - settings.originY / 100);
					const feather = Math.max(1, height * 0.16 * settings.width * settings.softness);
					const end = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + feather;
					const duration = settings.duration;
					const ease = gsap.parseEase(settings.ease);
					const root = document.documentElement;
					root.dataset.navigationWave = 'running';
					root.dataset.navigationWaveLens = String(settings.bend > 0 && settings.strength > 0);
					root.dataset.navigationWaveProgress = '0';
					const releaseScroll = lockProjectScroll();
					map.current?.setAttribute('href', waveTexture(settings));
					// Gradients interpolate discretely in mask-image keyframes. Keep the
					// native animation as the clock, and move mask and lens together below.
					const animation = root.animate([{ opacity: 1 }, { opacity: 1 }], {
						duration,
						fill: 'both',
						pseudoElement: `::view-transition-new(${instance.name})`,
					});
					const hold = root.animate([{ opacity: 1 }, { opacity: 1 }], {
						duration,
						pseudoElement: `::view-transition-old(${instance.name})`,
					});
					let raf = 0;
					const tick = () => {
						const progress = Math.min(1, Number(animation.currentTime || 0) / duration);
						root.dataset.navigationWaveProgress = String(progress);
						// Grow from zero immediately; a negative radius hides the first part
						// of the animation and feels like a delay after the click.
						const radius = end * ease(progress);
						const edge = Math.min(feather, radius);
						root.style.setProperty(
							'--navigation-wave-mask',
							`radial-gradient(circle at ${x}px ${y}px, #000 ${Math.max(0, radius - edge)}px, transparent ${Math.max(0.01, radius + edge)}px)`
						);
						const size = Math.max(1, radius) / 0.65;
						map.current?.setAttribute('x', String(x - size));
						map.current?.setAttribute('y', String(y - size));
						map.current?.setAttribute('width', String(size * 2));
						map.current?.setAttribute('height', String(size * 2));
						displacement.current?.setAttribute(
							'scale',
							String(height * 0.09 * settings.bend * settings.strength * Math.sin(Math.PI * progress))
						);
						if (progress < 1) raf = requestAnimationFrame(tick);
					};
					tick();
					let cleaned = false;
					const cleanup = () => {
						if (cleaned) return;
						cleaned = true;
						cancelAnimationFrame(raf);
						releaseScroll();
						displacement.current?.setAttribute('scale', '0');
						delete root.dataset.navigationWave;
						delete root.dataset.navigationWaveProgress;
						delete root.dataset.navigationWaveLens;
						root.style.removeProperty('--navigation-wave-mask');
					};
					void animation.finished.then(cleanup, cleanup);
					return () => {
						cleanup();
						animation.cancel();
						hold.cancel();
					};
				}}
			>
				{children}
			</ViewTransition>
		</>
	);
}
