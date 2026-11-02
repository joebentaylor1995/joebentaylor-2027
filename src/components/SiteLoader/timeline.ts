// Imports
// ------------
import { readIntroProfiles } from '@parts/Hero/Background/intro-storage';
import { sceneIntros } from '@parts/Hero/Background/scene-intro';
import { HERO_DESKTOP_QUERY } from '@parts/Hero/layout';
import { gsap } from 'gsap';
import type { RefObject } from 'react';
import { landLoader, revealScene, settleLoader } from './events';
import { renderFade } from './fade-reveal';
import { createIntro, INTRO_FPS, INTRO_FRAMES, INTRO_LAST_FRAME, type IntroIds } from './intro';
import { LOGO_BOX } from './logoPaths';
import { MOBILE_SCALE_DURATION, MOBILE_SCALE_EASE } from './mobile-intro';
import { type LoaderSettings, loaderControl, loaderSettings } from './settings';
import { renderRevealWindow } from './window-reveal';

// Types
// ------------
type LoaderTimeline = gsap.core.Timeline;
type RenderIntro = ReturnType<typeof createIntro>;
// Holds whichever wait is live, so the animation's cleanup can cancel it
export type SceneWait = { stop: () => void };
export type LoaderScene = ReturnType<typeof readLoaderScene>;

// Constants
// ------------
const FALLBACK_LOGO_WIDTH = 120;
// The wordmark lands on the static mark at this timeline time
const LANDED_AT = INTRO_LAST_FRAME / INTRO_FPS;
const REDUCED_FADE_DURATION = 0.15;
const PROJECTS_IFRAME = 'iframe[title="Interactive projects"]';
const WAVE_DURATION = 1.35;
const WAVE_EASE = 'power2.inOut';
// Share of the viewport diagonal the wave travels on phones
const MOBILE_WAVE_REACH = 0.53;
// Half the ring's 200px CSS box, so radius / this is the scale that matches the wave
const RING_RADIUS = 100;
const RING_OPACITY = 0.45;
const RING_FADE_AT = 0.9;
const RING_FADE_DURATION = 0.45;
// In the preview, the ring has faded out over the reveal's last third
const PREVIEW_RING_FADE_RATE = 3;
// Paint frames to wait after the scene is ready, before starting either clock
const FRAMES_BEFORE_RELEASE = 2;
const HOMEPAGE_SCENE_DEADLINE_MS = 15000;
const PAGE_SCENE_DEADLINE_MS = 2000;
const ASSET_DEADLINE_MS = 1500;

// Scene
// ------------
// Elements the timeline drives, plus the measurements and page context that decide
// which reveal plays. Read once per build.
export const readLoaderScene = (root: HTMLElement, finished: RefObject<boolean>) => {
	const circle = root.querySelector('[data-circle-aperture]');
	const revealWindow = root.querySelector('[data-window-aperture]');
	const wash = root.querySelector('[data-logo-wash]');
	const mark = root.querySelector('[data-loader-mark]');
	const ring = root.querySelector('[data-loader-ring]');
	const svg = root.querySelector<SVGSVGElement>('[data-loader-svg]');
	const intro = root.querySelector('[data-intro]');
	const final = root.querySelector('[data-final]');

	const logoWidth = mark?.getBoundingClientRect().width || FALLBACK_LOGO_WIDTH;
	const width = window.innerWidth;
	const height = window.innerHeight;
	const mobile = !window.matchMedia(HERO_DESKTOP_QUERY).matches;
	const homepage = window.location.pathname === '/';
	const projectsListing = /^\/projects\/?$/.test(window.location.pathname);
	const waveSettings = readIntroProfiles()[mobile ? 'mobile' : 'desktop'];
	// NOTE • Phones skip the wave (and its WebGL refraction) on every page: the loader fades out
	// over the ready scene, exactly as on the homepage
	const pageReveal = !mobile && !homepage && !projectsListing;
	const windowReveal = pageReveal && loaderSettings.revealEffect === 'window';
	const fadeReveal = pageReveal && loaderSettings.revealEffect === 'fade';

	return {
		root,
		finished,
		circle,
		revealWindow,
		wash,
		mark,
		ring,
		svg,
		intro,
		final,
		logoWidth,
		width,
		height,
		mobile,
		homepage,
		projectsListing,
		waveSettings,
		waveDuration: projectsListing ? 1 / waveSettings.speed : WAVE_DURATION,
		waveRadius: Math.hypot(width, height) * (mobile ? MOBILE_WAVE_REACH : 1),
		page: homepage ? null : document.getElementById('page'),
		windowReveal,
		fadeReveal,
		entrancePath: window.location.pathname,
		projectHero: !homepage && !windowReveal ? document.querySelector<HTMLElement>('[data-project-hero]') : null,
	};
};

// The slow zoom can outlive the loader. Never apply it to a project
// reached through a subsequent, already-framed ribbon transition.
const zoomHero = ({ entrancePath }: LoaderScene) =>
	window.location.pathname === entrancePath ? document.querySelector<HTMLElement>('[data-project-hero]') : null;

// Mirrors the reveal's progress (0 to 1) onto the projects iframe or the project hero's water shader
const setProjectWave = ({ projectsListing, waveSettings, projectHero, fadeReveal }: LoaderScene, progress: number) => {
	if (projectsListing) {
		document
			.querySelector<HTMLIFrameElement>(PROJECTS_IFRAME)
			?.contentWindow?.postMessage(
				{ type: 'projects:loader-wave', progress, settings: waveSettings },
				window.location.origin
			);
	}
	const entrance = projectHero && sceneIntros.get(projectHero);
	if (entrance) entrance.waterReveal = fadeReveal ? 1 : progress;
};

const setApertureRadius = ({ circle, wash, logoWidth }: LoaderScene, radius: number) => {
	circle?.setAttribute('r', String(radius));
	wash?.setAttribute('r', String(radius / (logoWidth / LOGO_BOX.width)));
};

const markLoaderComplete = ({ root, finished }: LoaderScene) => {
	finished.current = true;
	root.dataset.complete = 'true';
	settleLoader();
};

// Starting state
// ------------
// The animation re-ran after completing: keep the loader hidden
export const hideFinishedLoader = (root: HTMLElement) => {
	document.documentElement.removeAttribute('data-loader-boot');
	gsap.set(root, { autoAlpha: 0, pointerEvents: 'none' });
};

// Loader opaque, apertures closed, intro frames visible
export const resetLoaderVisuals = (scene: LoaderScene, windowMask: string, reduced: boolean | undefined) => {
	const { root, circle, revealWindow, wash, mark, ring, intro, final, width, height, windowReveal, fadeReveal } =
		scene;
	root.dataset.outro = fadeReveal ? 'fade' : windowReveal ? 'window' : 'wave';
	root.dataset.revealOrigin = loaderSettings.revealOrigin;
	delete root.dataset.webglReveal;
	delete root.dataset.revealing;
	gsap.set(root, { autoAlpha: 1, pointerEvents: 'auto' });
	gsap.set(root, { '--loader-window-mask': windowMask });
	gsap.set(circle, { attr: { cx: width / 2, cy: height / 2, r: 0 } });
	gsap.set(wash, { attr: { r: 0 } });
	gsap.set(ring, { scale: 0, opacity: 0 });
	gsap.set(intro, { visibility: 'visible' });
	gsap.set(final, { visibility: 'hidden' });
	gsap.set(mark, { opacity: 1 });
	renderRevealWindow(revealWindow, width, height, loaderSettings.revealOrigin, 0);
	if (fadeReveal && !reduced) renderFade(root, mark, zoomHero(scene), 0);
};

// Timeline
// ------------
export const createLoaderTimeline = (scene: LoaderScene) =>
	gsap.timeline({
		paused: true,
		onComplete: () => {
			if (scene.finished.current) return;
			if (scene.projectsListing) setProjectWave(scene, 1);
			markLoaderComplete(scene);
		},
	});

// Reduced motion (or no SVG) skips the intro and just shows the final mark then fades
export const addReducedExit = ({ root, final }: LoaderScene, tl: LoaderTimeline) => {
	gsap.set(final, { visibility: 'visible' });
	tl.call(revealScene).to(root, { autoAlpha: 0, pointerEvents: 'none', duration: REDUCED_FADE_DURATION });
};

// The glitch intro, then the reveal that suits this page
export const addIntroAndReveal = (
	scene: LoaderScene,
	tl: LoaderTimeline,
	svg: SVGSVGElement,
	ids: IntroIds,
	sceneWait: SceneWait
) => {
	const { root, mobile, homepage, projectsListing, projectHero, windowReveal, fadeReveal } = scene;
	const render = createIntro(svg, ids);
	render({});
	// cutAt is when the reveal begins on non-homepage routes: after the last frame, but never before pageRevealAt
	const cutAt = Math.max(LANDED_AT, loaderSettings.pageRevealAt);
	const { revealGap, revealDuration, revealOrigin } = loaderSettings;

	loaderControl.preview = createPreview(scene, tl, render, cutAt, revealDuration, revealOrigin);
	addIntroFrames(scene, tl, render);

	// Timestamp the reveal starts: phones go on landing, the homepage waits revealGap after it, other pages wait for cutAt
	const revealAt = fadeReveal ? cutAt : mobile ? LANDED_AT : homepage ? LANDED_AT + revealGap : cutAt;
	// NOTE • Wave reveals need the first GPU frame. A project fade can reveal
	// the existing hero image immediately while its water shader warms up.
	if (homepage || projectsListing || (projectHero && !fadeReveal)) addSceneGate(scene, tl, revealAt, sceneWait);

	tl.set(root, { attr: { 'data-revealing': 'true' } }, revealAt);
	if (!homepage && !fadeReveal) tl.call(revealScene, [], revealAt);

	if (fadeReveal) addFadeReveal(scene, tl, revealAt, revealDuration);
	else if (windowReveal) addWindowReveal(scene, tl, revealAt, revealDuration, revealOrigin);
	else if (mobile) addPhoneFade(scene, tl, revealAt);
	else addWaveReveal(scene, tl, revealAt);
};

// One timeline call per source frame, then the swap onto the static mark
const addIntroFrames = ({ intro, final }: LoaderScene, tl: LoaderTimeline, render: RenderIntro) => {
	for (const [frame, state] of Object.entries(INTRO_FRAMES)) {
		tl.call(render, [state], Number(frame) / INTRO_FPS);
	}
	// The wordmark lands exactly on the static mark, so it swaps in with no jump.
	tl.set(intro, { visibility: 'hidden' }, LANDED_AT)
		.set(final, { visibility: 'visible' }, LANDED_AT)
		.call(landLoader, [], LANDED_AT);
};

// Pauses the timeline at the reveal until the scene behind the loader has drawn
const addSceneGate = (scene: LoaderScene, tl: LoaderTimeline, revealAt: number, sceneWait: SceneWait) => {
	const { root, mobile, homepage, projectsListing, projectHero, fadeReveal } = scene;
	tl.addPause(revealAt, () => {
		const hero = projectsListing
			? document.querySelector<HTMLIFrameElement>(PROJECTS_IFRAME)
			: (projectHero ?? document.querySelector('[data-scene-cover]')?.parentElement);
		const readyAttribute = projectsListing ? 'data-ribbon-ready' : 'data-liquid-ready';
		const sceneReady = () => hero?.getAttribute(readyAttribute) === 'true';
		const resume = () => {
			sceneWait.stop();
			setProjectWave(scene, mobile ? 1 : 0);
			// Let the first GPU frame and overlay change paint before starting either clock.
			let frames = 0;
			const release = () => {
				if (++frames < FRAMES_BEFORE_RELEASE) return;
				gsap.ticker.remove(release);
				if (!fadeReveal && !mobile && sceneReady()) {
					root.dataset.webglReveal = 'true';
				}
				if (!fadeReveal) revealScene();
				tl.resume();
			};
			gsap.ticker.add(release);
			sceneWait.stop = () => gsap.ticker.remove(release);
		};
		if (!hero || sceneReady()) {
			resume();
			return;
		}
		const observer = new MutationObserver(() => {
			if (sceneReady()) resume();
		});
		observer.observe(hero, { attributes: true, attributeFilter: [readyAttribute] });
		// Network-bound hero textures can arrive well after the logo lands.
		// Keep a deadline so unavailable WebGL still falls back to native content.
		const timeout = window.setTimeout(resume, homepage ? HOMEPAGE_SCENE_DEADLINE_MS : PAGE_SCENE_DEADLINE_MS);
		sceneWait.stop = () => {
			observer.disconnect();
			window.clearTimeout(timeout);
		};
	});
};

// Reveal variants
// ------------
const addFadeReveal = (scene: LoaderScene, tl: LoaderTimeline, revealAt: number, revealDuration: number) => {
	const { root, mark } = scene;
	const fade = { elapsed: 0 };
	const fadeTime = Math.max(revealDuration, loaderSettings.heroZoomDuration);
	tl.call(revealScene, [], revealAt)
		.to(
			fade,
			{
				elapsed: fadeTime,
				duration: fadeTime,
				ease: 'none',
				onUpdate: () => renderFade(root, mark, zoomHero(scene), fade.elapsed),
			},
			revealAt
		)
		.call(() => markLoaderComplete(scene), [], revealAt + revealDuration);
};

const addWindowReveal = (
	{ root, revealWindow, width, height, page }: LoaderScene,
	tl: LoaderTimeline,
	revealAt: number,
	revealDuration: number,
	revealOrigin: LoaderSettings['revealOrigin']
) => {
	const opening = { progress: 0 };
	tl.to(
		opening,
		{
			progress: 1,
			duration: revealDuration,
			ease: 'none',
			onUpdate: () => renderRevealWindow(revealWindow, width, height, revealOrigin, opening.progress, page),
		},
		revealAt
	).set(root, { autoAlpha: 0, pointerEvents: 'none' }, revealAt + revealDuration);
};

const addPhoneFade = ({ root }: LoaderScene, tl: LoaderTimeline, revealAt: number) => {
	tl.to(
		root,
		{
			autoAlpha: 0,
			pointerEvents: 'none',
			duration: MOBILE_SCALE_DURATION,
			ease: MOBILE_SCALE_EASE,
		},
		revealAt
	);
};

// One wavefront removes the stationary logo and opens the scene.
const addWaveReveal = (scene: LoaderScene, tl: LoaderTimeline, revealAt: number) => {
	const { root, ring, projectsListing, waveSettings, waveDuration, waveRadius } = scene;
	const wave = { radius: 0 };
	// quickSetter does not expand the CSSPlugin's multi-property "scale" alias.
	const setRingScaleX = gsap.quickSetter(ring, 'scaleX');
	const setRingScaleY = gsap.quickSetter(ring, 'scaleY');
	tl.set(ring, { opacity: RING_OPACITY }, revealAt)
		.to(
			wave,
			{
				radius: waveRadius,
				duration: waveDuration,
				ease: projectsListing ? waveSettings.ease : WAVE_EASE,
				onUpdate: () => {
					setProjectWave(scene, wave.radius / waveRadius);
					setRingScaleX(wave.radius / RING_RADIUS);
					setRingScaleY(wave.radius / RING_RADIUS);
					setApertureRadius(scene, wave.radius);
				},
			},
			revealAt
		)
		.to(ring, { opacity: 0, duration: RING_FADE_DURATION }, revealAt + RING_FADE_AT)
		.set(root, { autoAlpha: 0, pointerEvents: 'none' }, revealAt + waveDuration);
};

// Tweak panel preview
// ------------
const previewWave = (scene: LoaderScene, progress: number) => {
	const { ring, mark, waveRadius } = scene;
	const eased = gsap.parseEase(WAVE_EASE)(progress);
	setProjectWave(scene, eased);
	const radius = waveRadius * eased;
	setApertureRadius(scene, radius);
	gsap.set(ring, {
		scale: radius / RING_RADIUS,
		opacity: progress > 0 ? RING_OPACITY * Math.min(1, (1 - progress) * PREVIEW_RING_FADE_RATE) : 0,
	});
	gsap.set(mark, { opacity: 1 });
};

// Scrubs the loader to an arbitrary time for the tweak panel's preview
const createPreview =
	(
		scene: LoaderScene,
		tl: LoaderTimeline,
		render: RenderIntro,
		cutAt: number,
		revealDuration: number,
		revealOrigin: LoaderSettings['revealOrigin']
	) =>
	(time: number) => {
		const { root, circle, revealWindow, wash, mark, ring, intro, final, width, height, page } = scene;
		const { windowReveal, fadeReveal } = scene;
		tl.pause();
		loaderControl.previewTime = time;
		delete root.dataset.complete;
		root.style.animation = 'none';
		gsap.set(root, { autoAlpha: 1, pointerEvents: 'auto' });
		gsap.set(circle, { attr: { r: 0 } });
		gsap.set(wash, { attr: { r: 0 } });
		gsap.set(ring, { opacity: 0 });

		const progress = Math.max(0, Math.min(1, (time - cutAt) / (windowReveal ? revealDuration : WAVE_DURATION)));
		root.dataset.revealing = String(progress > 0);
		if (fadeReveal) {
			renderFade(root, mark, zoomHero(scene), time - cutAt);
		} else if (windowReveal) {
			renderRevealWindow(revealWindow, width, height, revealOrigin, progress, page);
			gsap.set(mark, { opacity: 1 });
		} else {
			previewWave(scene, progress);
		}

		const landed = time >= LANDED_AT;
		gsap.set(intro, { visibility: landed ? 'hidden' : 'visible' });
		gsap.set(final, { visibility: landed ? 'visible' : 'hidden' });
		for (const [frame, state] of Object.entries(INTRO_FRAMES)) {
			if (Number(frame) / INTRO_FPS <= time) render(state);
		}
	};

// Start
// ------------
// Fonts and eager images must be ready before the timeline plays, with a deadline for
// slow or failed requests. Returns a function that cancels the wait.
export const playWhenAssetsReady = (tl: LoaderTimeline) => {
	let active = true;
	let started = false;
	const start = () => {
		if (!active || started) return;
		started = true;
		// The loader is mounted, styled and opaque before releasing the document cover.
		document.documentElement.removeAttribute('data-loader-boot');
		window.clearTimeout(deadline);
		tl.play();
	};
	tl.timeScale(loaderSettings.speed);
	loaderControl.timeline = tl;
	const deadline = window.setTimeout(start, ASSET_DEADLINE_MS);
	const images = Array.from(document.images).filter(
		image => image.loading === 'eager' || image.fetchPriority === 'high'
	);
	void Promise.all([document.fonts.ready, ...images.map(image => image.decode().catch(() => undefined))]).then(
		start,
		start
	);

	return () => {
		active = false;
		window.clearTimeout(deadline);
	};
};

// Cleanup
// ------------
// Leaves the scene fully revealed, whatever point the loader was unmounted at
export const finishSceneReveal = (scene: LoaderScene) => {
	const { width, height, page } = scene;
	setProjectWave(scene, 1);
	renderRevealWindow(null, width, height, loaderSettings.revealOrigin, 1, page);
};
