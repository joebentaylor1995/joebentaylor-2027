'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { mq } from '@tackl';
import { lockProjectScroll } from '@utils/lockProjectScroll';
import { releaseNavigationScene } from '@utils/navigationScene';
import { type ReactNode, use, useEffect, useMemo, useRef, ViewTransition } from 'react';
import { waveEase } from './easing';
import {
	holdWave,
	readWaveSettings,
	WAVE_SETTINGS_CHANGED,
	WAVE_TIMELINE,
	type WaveSettings,
	wavePreview,
	waveTimeline,
} from './settings';
import s from './styles.module.scss';
import { edgeGuardTexture, lensEnvelope, lensScale, prepareTextures, waveTexture } from './texture';

// Constants
// ------------
// NOTE • Phones swap the wave for a plain crossfade, animated in CSS (src/css/_page-transitions.scss).
// Cleanup drops data-navigation-wave, which switches that CSS off, so keep the two durations in step.
const CROSSFADE_DURATION = 600;

// Helpers
// ------------
// NOTE • Writes only real changes: every write to a filter primitive invalidates the filter, and
// re-setting an feImage's href makes it resolve its image again, each navigation, for nothing
function setAttributeIfChanged(element: Element | null, name: string, value: string) {
	if (element && element.getAttribute(name) !== value) element.setAttribute(name, value);
}

// The lens's images. Both are cached, so this is cheap unless the settings or viewport changed.
function prepareLens(settings: WaveSettings, map: SVGFEImageElement | null, guard: SVGFEImageElement | null) {
	setAttributeIfChanged(map, 'href', waveTexture(settings));
	setAttributeIfChanged(guard, 'href', edgeGuardTexture(settings, innerWidth, innerHeight));
	setAttributeIfChanged(guard, 'width', String(innerWidth));
	setAttributeIfChanged(guard, 'height', String(innerHeight));
}

// One frame of the wave: the reveal mask and the lens, for a point (0–1) through it.
// The page transition and the settings panel's preview both draw with it. `ease` is
// settings.ease, resolved once by the caller rather than on every frame.
function paintWave(
	settings: WaveSettings,
	ease: (progress: number) => number,
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
	const eased = ease(progress);
	const radius = end * eased;
	const edge = Math.min(feather, radius);

	// Reveal mask: opaque inside the wave, fading to transparent across the feathered edge
	applyMask(
		`radial-gradient(circle at ${x}px ${y}px, #000 ${Math.max(0, radius - edge)}px, transparent ${Math.max(0.01, radius + edge)}px)`
	);

	// Place the lens image so its ring (at 0.65 of the texture radius, see texture.ts) sits on the wave's edge
	const size = Math.max(1, radius) / 0.65;
	setAttributeIfChanged(map, 'x', String(x - size));
	setAttributeIfChanged(map, 'y', String(y - size));
	setAttributeIfChanged(map, 'width', String(size * 2));
	setAttributeIfChanged(map, 'height', String(size * 2));

	// Lens strength, from the same eased point as the radius (see lensEnvelope)
	setAttributeIfChanged(displacement, 'scale', String(lensScale(settings, height) * lensEnvelope(eased)));
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
		let cancelled = false;
		// Phones crossfade, so they never draw the lens
		const usesLens = () => !matchMedia(mq.down.m).matches;
		const prepare = () => {
			if (usesLens()) prepareLens(readWaveSettings(), map.current, guard.current);
		};
		// NOTE • The first maps are made in idle time: drawn and PNG-encoded synchronously, they
		// were one long task on the very frame the loader settles, as the header, cookie bar and
		// title entrances start. prepare() then finds them cached. A navigation before they are
		// ready draws them synchronously in onUpdate, exactly as it always could.
		const prepareWhenIdle = () => {
			if (!usesLens()) return;
			void prepareTextures(readWaveSettings(), innerWidth, innerHeight, () => cancelled).then(() => {
				if (!cancelled) prepare();
			});
		};

		if (isLoaderSettled()) prepareWhenIdle();
		else window.addEventListener(LOADER_SETTLED, prepareWhenIdle, { once: true });
		window.addEventListener(WAVE_SETTINGS_CHANGED, prepare);

		return () => {
			cancelled = true;
			window.removeEventListener(LOADER_SETTLED, prepareWhenIdle);
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
			paintWave(settings, waveEase(settings.ease), progress, map.current, displacement.current, mask =>
				root.style.setProperty('--navigation-wave-mask', mask)
			);
		};
		wavePreview.clear = () => {
			delete root.dataset.navigationWavePreview;
			delete root.dataset.navigationWaveLens;
			root.style.removeProperty('--navigation-wave-mask');
			setAttributeIfChanged(displacement.current, 'scale', '0');
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
					// NOTE • setKeyframes copies the frame, so one object serves both keyframes and every
					// frame. An unchanged mask (e.g. while the transition's clock hasn't started) is
					// skipped, since re-keying the effect restyles the pseudo-element for nothing.
					const frame = { opacity: 1, maskImage: '' };
					const applyMask = (mask: string) => {
						if (!(reveal instanceof KeyframeEffect) || mask === frame.maskImage) return;
						frame.maskImage = mask;
						reveal.setKeyframes([frame, frame]);
					};

					// Hand the clock to the tuner (?waveTuner): held at its playhead, or slowed down
					if (!crossfade) {
						for (const animation of animations) animation.playbackRate = waveTimeline.rate;
						waveTimeline.current = { animations, duration, ease: settings.ease };
						if (waveTimeline.hold !== null) holdWave(waveTimeline.hold);
						window.dispatchEvent(new Event(WAVE_TIMELINE));
					}

					// Redraw the wave each frame from the animation's own clock. A paused clock (the
					// tuner holding it) keeps drawing, even at the end, so scrubbing it back still shows.
					const ease = waveEase(settings.ease);
					let raf = 0;
					const tick = () => {
						const progress = Math.min(1, Number(animations[0]?.currentTime || 0) / duration);
						paintWave(settings, ease, progress, map.current, displacement.current, applyMask);
						if (progress < 1 || animations[0]?.playState === 'paused') raf = requestAnimationFrame(tick);
					};
					if (!crossfade) tick();

					// Runs once, whether the animation finishes, fails, or React cancels the transition
					let cleaned = false;
					const cleanup = () => {
						if (cleaned) return;
						cleaned = true;
						cancelAnimationFrame(raf);
						releaseScroll();
						setAttributeIfChanged(displacement.current, 'scale', '0');
						delete root.dataset.navigationWave;
						delete root.dataset.navigationWaveLens;
						if (waveTimeline.current?.animations !== animations) return;
						waveTimeline.current = null;
						window.dispatchEvent(new Event(WAVE_TIMELINE));
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
