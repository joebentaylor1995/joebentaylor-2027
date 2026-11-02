'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { mq } from '@tackl';
import { lockProjectScroll } from '@utils/lockProjectScroll';
import { releaseNavigationScene } from '@utils/navigationScene';
import { gsap } from 'gsap';
import { type ReactNode, use, useEffect, useMemo, useRef, ViewTransition } from 'react';
import { readWaveSettings, WAVE_SETTINGS_CHANGED, type WaveSettings, wavePreview } from './settings';
import s from './styles.module.scss';
import { edgeGuardTexture, lensScale, waveTexture } from './texture';

// Constants
// ------------
// NOTE • Phones swap the wave for a plain crossfade, animated in CSS (src/css/_page-transitions.scss).
// Cleanup drops data-navigation-wave, which switches that CSS off, so keep the two durations in step.
const CROSSFADE_DURATION = 600;

// Helpers
// ------------
// The lens's images. Both are cached, so this is cheap unless the settings or viewport changed.
function prepareLens(settings: WaveSettings, map: SVGFEImageElement | null, guard: SVGFEImageElement | null) {
	map?.setAttribute('href', waveTexture(settings));
	guard?.setAttribute('href', edgeGuardTexture(settings, innerWidth, innerHeight));
	guard?.setAttribute('width', String(innerWidth));
	guard?.setAttribute('height', String(innerHeight));
}

// One frame of the wave: the reveal mask and the lens, for a point (0–1) through it.
// The page transition and the settings panel's preview both draw with it.
function paintWave(
	settings: WaveSettings,
	progress: number,
	map: SVGFEImageElement | null,
	displacement: SVGFEDisplacementMapElement | null,
	applyMask: (mask: string) => void
) {
	// The wave grows from (x, y): origin settings are percentages, with originY measured from the bottom
	const width = innerWidth,
		height = innerHeight;
	const x = (width * settings.originX) / 100,
		y = height * (1 - settings.originY / 100);

	// `feather` is the soft band at the wave's edge; the wave ends once it has cleared the farthest corner
	const feather = Math.max(1, height * 0.16 * settings.width * settings.softness);
	const end = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + feather;
	// Grow from zero immediately; a negative radius hides the first part
	// of the animation and feels like a delay after the click.
	const radius = end * gsap.parseEase(settings.ease)(progress);
	const edge = Math.min(feather, radius);

	// Reveal mask: opaque inside the wave, fading to transparent across the feathered edge
	applyMask(
		`radial-gradient(circle at ${x}px ${y}px, #000 ${Math.max(0, radius - edge)}px, transparent ${Math.max(0.01, radius + edge)}px)`
	);

	// Place the lens image so its ring (at 0.65 of the texture radius, see texture.ts) sits on the wave's edge
	const size = Math.max(1, radius) / 0.65;
	map?.setAttribute('x', String(x - size));
	map?.setAttribute('y', String(y - size));
	map?.setAttribute('width', String(size * 2));
	map?.setAttribute('height', String(size * 2));

	// Lens strength peaks mid-wave and eases to zero at both ends
	displacement?.setAttribute('scale', String(lensScale(settings, height) * Math.sin(Math.PI * progress)));
}

// Component
// ------------
// Page transition: wraps the page in a React <ViewTransition> and, on a route change, reveals the
// new page through a growing circular mask while an SVG displacement filter (the "lens") bends the
// pixels at the wave's edge. Phones get a plain crossfade instead.
// Native snapshots retain canvases, video and font rendering without DOM rasterisation.
export default function NavigationWave({ children }: { children: ReactNode }) {
	// Context
	const { pagePath: pathname } = use(GlobalContext);

	// Route tracking: `previous` holds the last route that was shown, so a render with a different
	// pathname is a navigation
	const previous = useRef(pathname);
	const routeChanged = previous.current !== pathname;
	// Streaming updates can invoke onUpdate again for the same navigation.
	const navigation = useMemo(() => ({ pathname, played: false }), [pathname]);

	// Remember the route that was just shown, and let the hero's WebGL resume
	useEffect(() => {
		previous.current = pathname;
		releaseNavigationScene();
	}, [pathname]);

	// Refs to the SVG filter's nodes: the lens image, the edge guard image and the displacement map
	const map = useRef<SVGFEImageElement>(null);
	const guard = useRef<SVGFEImageElement>(null);
	const displacement = useRef<SVGFEDisplacementMapElement>(null);

	// Effects
	// Generate the lens images ahead of the first navigation, and again when settings change
	useEffect(() => {
		// Phones crossfade, so they never draw the lens
		const prepare = () => {
			if (!matchMedia(mq.down.m).matches) prepareLens(readWaveSettings(), map.current, guard.current);
		};

		if (isLoaderSettled()) prepare();
		else window.addEventListener(LOADER_SETTLED, prepare, { once: true });
		window.addEventListener(WAVE_SETTINGS_CHANGED, prepare);

		return () => {
			window.removeEventListener(LOADER_SETTLED, prepare);
			window.removeEventListener(WAVE_SETTINGS_CHANGED, prepare);
		};
	}, []);

	// Expose paint/clear hooks so the settings panel can scrub the wave on the live page
	useEffect(() => {
		// The settings panel previews any point of the wave on the live page (CSS in
		// _page-transitions.scss), so its controls stay visible while tuning
		const root = document.documentElement;
		wavePreview.paint = progress => {
			const settings = readWaveSettings();
			prepareLens(settings, map.current, guard.current);
			root.dataset.navigationWavePreview = 'true';
			root.dataset.navigationWaveLens = String(settings.bend > 0 && settings.strength > 0);
			paintWave(settings, progress, map.current, displacement.current, mask =>
				root.style.setProperty('--navigation-wave-mask', mask)
			);
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

	// Render
	return (
		<>
			<svg className={s.jacket} aria-hidden='true' width='0' height='0'>
				<defs>
					<filter
						id='navigation-wave-lens'
						x='0'
						y='0'
						width='100%'
						height='100%'
						colorInterpolationFilters='sRGB'
					>
						<feFlood floodColor='rgb(128,128,128)' result='neutral' />
						<feImage ref={map} result='lens' preserveAspectRatio='none' />
						<feImage ref={guard} result='guard' x='0' y='0' preserveAspectRatio='none' />
						<feMerge result='field'>
							<feMergeNode in='neutral' />
							<feMergeNode in='lens' />
							<feMergeNode in='guard' />
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
					// Only real page changes play the wave: project transitions have their own animation,
					// and each navigation plays once. Reduced-motion users get no transition.
					if (!routeChanged || types.includes('project-mesh') || types.includes('project-modal')) return;
					if (navigation.played) return;
					navigation.played = true;
					if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

					const settings = readWaveSettings();
					const crossfade = matchMedia(mq.down.m).matches;
					const duration = crossfade ? CROSSFADE_DURATION : settings.duration;
					const root = document.documentElement;

					// These data attributes switch on the transition CSS in _page-transitions.scss
					wavePreview.clear?.();
					root.dataset.navigationWave = 'running';
					root.dataset.navigationWaveLens = String(!crossfade && settings.bend > 0 && settings.strength > 0);
					const releaseScroll = lockProjectScroll();
					if (!crossfade) prepareLens(settings, map.current, guard.current);

					// Gradients interpolate discretely in mask-image keyframes. Keep the
					// native animation as the clock, and move mask and lens together below.
					// The mask goes straight onto that animation: a variable on the root
					// would restyle the whole document every frame.
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
					const reveal = animations[0]?.effect;
					const applyMask = (mask: string) => {
						if (reveal instanceof KeyframeEffect)
							reveal.setKeyframes([
								{ opacity: 1, maskImage: mask },
								{ opacity: 1, maskImage: mask },
							]);
					};

					// Redraw the wave each frame from the animation's own clock
					let raf = 0;
					const tick = () => {
						const progress = Math.min(1, Number(animations[0]?.currentTime || 0) / duration);
						paintWave(settings, progress, map.current, displacement.current, applyMask);
						if (progress < 1) raf = requestAnimationFrame(tick);
					};
					if (!crossfade) tick();

					// Runs once, whether the animation finishes, fails, or React cancels the transition
					let cleaned = false;
					const cleanup = () => {
						if (cleaned) return;
						cleaned = true;
						cancelAnimationFrame(raf);
						releaseScroll();
						displacement.current?.setAttribute('scale', '0');
						delete root.dataset.navigationWave;
						delete root.dataset.navigationWaveLens;
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
