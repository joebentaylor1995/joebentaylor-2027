'use client';

import { GlobalContext } from '@parts/Contexts';
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { mq } from '@tackl';
import { lockProjectScroll } from '@utils/lockProjectScroll';
import { releaseNavigationScene } from '@utils/navigationScene';
import { gsap } from 'gsap';
import { type ReactNode, use, useEffect, useMemo, useRef, ViewTransition } from 'react';
import { readWaveSettings, WAVE_SETTINGS_CHANGED, type WaveSettings, wavePreview } from './settings';
import s from './styles.module.scss';
import { waveTexture } from './texture';

// NOTE • Phones swap the wave for a plain crossfade, animated in CSS (src/css/_page-transitions.scss).
// Cleanup drops data-navigation-wave, which switches that CSS off, so keep the two durations in step.
const CROSSFADE_DURATION = 600;

// One frame of the wave: the reveal mask and the lens, for a point (0–1) through it.
// The page transition and the settings panel's preview both draw with it.
function paintWave(
	settings: WaveSettings,
	progress: number,
	map: SVGFEImageElement | null,
	displacement: SVGFEDisplacementMapElement | null
) {
	const width = innerWidth,
		height = innerHeight;
	const x = (width * settings.originX) / 100,
		y = height * (1 - settings.originY / 100);
	const feather = Math.max(1, height * 0.16 * settings.width * settings.softness);
	const end = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + feather;
	// Grow from zero immediately; a negative radius hides the first part
	// of the animation and feels like a delay after the click.
	const radius = end * gsap.parseEase(settings.ease)(progress);
	const edge = Math.min(feather, radius);
	document.documentElement.style.setProperty(
		'--navigation-wave-mask',
		`radial-gradient(circle at ${x}px ${y}px, #000 ${Math.max(0, radius - edge)}px, transparent ${Math.max(0.01, radius + edge)}px)`
	);
	const size = Math.max(1, radius) / 0.65;
	map?.setAttribute('x', String(x - size));
	map?.setAttribute('y', String(y - size));
	map?.setAttribute('width', String(size * 2));
	map?.setAttribute('height', String(size * 2));
	displacement?.setAttribute(
		'scale',
		String(height * 0.09 * settings.bend * settings.strength * Math.sin(Math.PI * progress))
	);
}

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
	useEffect(() => {
		// The settings panel previews any point of the wave on the live page (CSS in
		// _page-transitions.scss), so its controls stay visible while tuning
		const root = document.documentElement;
		wavePreview.paint = progress => {
			const settings = readWaveSettings();
			map.current?.setAttribute('href', waveTexture(settings));
			root.dataset.navigationWavePreview = 'true';
			root.dataset.navigationWaveLens = String(settings.bend > 0 && settings.strength > 0);
			paintWave(settings, progress, map.current, displacement.current);
		};
		wavePreview.clear = () => {
			delete root.dataset.navigationWavePreview;
			delete root.dataset.navigationWaveLens;
			root.style.removeProperty('--navigation-wave-mask');
			displacement.current?.setAttribute('scale', '0');
		};
		return () => {
			wavePreview.clear?.();
			wavePreview.paint = wavePreview.clear = null;
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
				update={{ 'project-mesh': 'none', 'project-modal': 'none', default: 'pageWave' }}
				default='none'
				onUpdate={(instance, types) => {
					if (!routeChanged || types.includes('project-mesh') || types.includes('project-modal')) return;
					if (navigation.played) return;
					navigation.played = true;
					if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
					const settings = readWaveSettings();
					const crossfade = matchMedia(mq.down.m).matches;
					const duration = crossfade ? CROSSFADE_DURATION : settings.duration;
					const root = document.documentElement;
					wavePreview.clear?.();
					root.dataset.navigationWave = 'running';
					root.dataset.navigationWaveLens = String(!crossfade && settings.bend > 0 && settings.strength > 0);
					root.dataset.navigationWaveProgress = '0';
					const releaseScroll = lockProjectScroll();
					if (!crossfade) map.current?.setAttribute('href', waveTexture(settings));
					// Gradients interpolate discretely in mask-image keyframes. Keep the
					// native animation as the clock, and move mask and lens together below.
					const animations = crossfade
						? []
						: [
								root.animate([{ opacity: 1 }, { opacity: 1 }], {
									duration,
									fill: 'both',
									pseudoElement: `::view-transition-new(${instance.name})`,
								}),
								root.animate([{ opacity: 1 }, { opacity: 1 }], {
									duration,
									pseudoElement: `::view-transition-old(${instance.name})`,
								}),
							];
					const started = performance.now();
					const elapsed = () =>
						crossfade ? performance.now() - started : Number(animations[0]?.currentTime || 0);
					let raf = 0;
					const tick = () => {
						const progress = Math.min(1, elapsed() / duration);
						root.dataset.navigationWaveProgress = String(progress);
						if (crossfade) {
							if (progress < 1) raf = requestAnimationFrame(tick);
							return;
						}
						paintWave(settings, progress, map.current, displacement.current);
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
					const finished = crossfade
						? new Promise(resolve => setTimeout(resolve, duration))
						: animations[0].finished;
					void finished.then(cleanup, cleanup);
					return () => {
						cleanup();
						for (const animation of animations) animation.cancel();
					};
				}}
			>
				{children}
			</ViewTransition>
		</>
	);
}
