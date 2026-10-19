'use client';

import { readIntroProfiles } from '@parts/Hero/Background/intro-storage';
import { sceneIntros } from '@parts/Hero/Background/scene-intro';
import { HERO_DESKTOP_QUERY } from '@parts/Hero/layout';
// Imports
// ------------
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import { useEffect, useId, useRef, useState } from 'react';
import { landLoader, resetLoader, revealScene, settleLoader } from './events';
import { renderFade } from './fade-reveal';
import { BAR_SLOTS, CUT_SLOTS, createIntro, INTRO_FPS, INTRO_FRAMES, INTRO_LAST_FRAME, type IntroIds } from './intro';
import { BEN, JOE, LOGO, LOGO_BOX } from './logoPaths';
import { MOBILE_SCALE_DURATION, MOBILE_SCALE_EASE } from './mobile-intro';
import { LOADER_REPLAY, loaderControl, loaderSettings } from './settings';
// Styles
// ------------
import s from './styles.module.scss';
import { renderRevealWindow } from './window-reveal';

// Constants
// ------------
// NOTE • The wash mask was tuned on the 68px-wide logo; the mark now draws in
// the logo's native 405-unit artboard, so its blur scales with it.
const ARTBOARD_SCALE = LOGO_BOX.width / 68;
const WASH_BLUR = 1.2 * ARTBOARD_SCALE;

// Component
// ------------
const SiteLoader = () => {
	// Refs
	const ref = useRef<HTMLDivElement>(null);
	const finished = useRef(false);
	const id = useId().replaceAll(':', '');
	const ids: IntroIds = {
		joe: `${id}-joe`,
		ben: `${id}-ben`,
		logo: `${id}-logo`,
		band: `${id}-band`,
		blur: `${id}-blur`,
	};
	const cutIds = Array.from({ length: CUT_SLOTS }, (_, i) => `${id}-cut-${i}`);
	const barIds = Array.from({ length: BAR_SLOTS }, (_, i) => `${id}-bar-${i}`);

	// State
	// NOTE • Bumped by the ?loaderTweaks panel to rebuild and replay the loader
	const [replay, setReplay] = useState(0);

	// Effects
	useEffect(() => {
		const onReplay = () => {
			const root = ref.current;
			if (!root) return;
			finished.current = false;
			loaderControl.previewTime = null;
			if (window.location.pathname !== '/') resetLoader();
			delete root.dataset.complete;
			delete root.dataset.revealing;
			// The CSS fail-open would otherwise hide a replay that starts after it fired
			root.style.animation = 'none';
			setReplay(count => count + 1);
		};
		window.addEventListener(LOADER_REPLAY, onReplay);
		return () => window.removeEventListener(LOADER_REPLAY, onReplay);
	}, []);

	// Animations
	useAnimation(
		({ reduced }) => {
			const root = ref.current;
			if (!root) return;
			if (finished.current) {
				document.documentElement.removeAttribute('data-loader-boot');
				gsap.set(root, { autoAlpha: 0, pointerEvents: 'none' });
				return;
			}
			const circle = root.querySelector('[data-circle-aperture]');
			const revealWindow = root.querySelector('[data-window-aperture]');
			const wash = root.querySelector('[data-logo-wash]');
			const mark = root.querySelector('[data-loader-mark]');
			const ring = root.querySelector('[data-loader-ring]');
			const svg = root.querySelector<SVGSVGElement>('[data-loader-svg]');
			const intro = root.querySelector('[data-intro]');
			const final = root.querySelector('[data-final]');
			const logoWidth = mark?.getBoundingClientRect().width || 120;
			const width = window.innerWidth;
			const height = window.innerHeight;
			const mobile = !window.matchMedia(HERO_DESKTOP_QUERY).matches;
			const homepage = window.location.pathname === '/';
			const projectsListing = /^\/projects\/?$/.test(window.location.pathname);
			const waveSettings = readIntroProfiles()[mobile ? 'mobile' : 'desktop'];
			const waveDuration = projectsListing ? 1 / waveSettings.speed : 1.35;
			const page = homepage ? null : document.getElementById('page');
			const windowReveal = !homepage && !projectsListing && loaderSettings.revealEffect === 'window';
			const fadeReveal = !homepage && !projectsListing && loaderSettings.revealEffect === 'fade';
			const entrancePath = window.location.pathname;
			// The slow zoom can outlive the loader. Never apply it to a project
			// reached through a subsequent, already-framed ribbon transition.
			const zoomHero = () =>
				window.location.pathname === entrancePath
					? document.querySelector<HTMLElement>('[data-project-hero]')
					: null;
			const projectHero =
				!homepage && !windowReveal ? document.querySelector<HTMLElement>('[data-project-hero]') : null;
			const setProjectWave = (progress: number) => {
				if (projectsListing) {
					document
						.querySelector<HTMLIFrameElement>('iframe[title="Interactive projects"]')
						?.contentWindow?.postMessage(
							{ type: 'projects:loader-wave', progress, settings: waveSettings },
							window.location.origin
						);
				}
				const entrance = projectHero && sceneIntros.get(projectHero);
				if (entrance) entrance.waterReveal = fadeReveal ? 1 : progress;
			};
			root.dataset.outro = fadeReveal ? 'fade' : windowReveal ? 'window' : 'wave';
			root.dataset.revealOrigin = loaderSettings.revealOrigin;
			delete root.dataset.webglReveal;
			delete root.dataset.revealing;
			gsap.set(root, { autoAlpha: 1, pointerEvents: 'auto' });
			gsap.set(root, { '--loader-window-mask': `url("#${id}-scene")` });
			gsap.set(circle, { attr: { cx: width / 2, cy: height / 2, r: 0 } });
			gsap.set(wash, { attr: { r: 0 } });
			gsap.set(ring, { scale: 0, opacity: 0 });
			gsap.set(intro, { visibility: 'visible' });
			gsap.set(final, { visibility: 'hidden' });
			gsap.set(mark, { opacity: 1 });
			renderRevealWindow(revealWindow, width, height, loaderSettings.revealOrigin, 0);
			const { revealGap, speed } = loaderSettings;
			if (fadeReveal && !reduced) renderFade(root, mark, zoomHero(), 0);
			let stopWaitingForScene = () => {};
			const tl = gsap.timeline({
				paused: true,
				onComplete: () => {
					if (finished.current) return;
					finished.current = true;
					if (projectsListing) setProjectWave(1);
					root.dataset.complete = 'true';
					settleLoader();
				},
			});
			if (reduced || !svg) {
				gsap.set(final, { visibility: 'visible' });
				tl.call(revealScene).to(root, { autoAlpha: 0, pointerEvents: 'none', duration: 0.15 });
			} else {
				// The glitch intro: one discrete state per source frame.
				const render = createIntro(svg, ids);
				render({});
				const cutAt = Math.max(INTRO_LAST_FRAME / INTRO_FPS, loaderSettings.pageRevealAt);
				const { revealDuration, revealOrigin } = loaderSettings;
				loaderControl.preview = time => {
					tl.pause();
					loaderControl.previewTime = time;
					delete root.dataset.complete;
					root.style.animation = 'none';
					gsap.set(root, { autoAlpha: 1, pointerEvents: 'auto' });
					gsap.set(circle, { attr: { r: 0 } });
					gsap.set(wash, { attr: { r: 0 } });
					gsap.set(ring, { opacity: 0 });
					const progress = Math.max(0, Math.min(1, (time - cutAt) / (windowReveal ? revealDuration : 1.35)));
					root.dataset.revealing = String(progress > 0);
					if (fadeReveal) {
						renderFade(root, mark, zoomHero(), time - cutAt);
					} else if (windowReveal) {
						renderRevealWindow(revealWindow, width, height, revealOrigin, progress, page);
						gsap.set(mark, { opacity: 1 });
					} else {
						setProjectWave(gsap.parseEase('power2.inOut')(progress));
						const radius =
							Math.hypot(width, height) * (mobile ? 0.53 : 1) * gsap.parseEase('power2.inOut')(progress);
						circle?.setAttribute('r', String(radius));
						wash?.setAttribute('r', String(radius / (logoWidth / LOGO_BOX.width)));
						gsap.set(ring, {
							scale: radius / 100,
							opacity: progress > 0 ? 0.45 * Math.min(1, (1 - progress) * 3) : 0,
						});
						gsap.set(mark, { opacity: 1 });
					}
					const landed = time >= INTRO_LAST_FRAME / INTRO_FPS;
					gsap.set(intro, { visibility: landed ? 'hidden' : 'visible' });
					gsap.set(final, { visibility: landed ? 'visible' : 'hidden' });
					for (const [frame, state] of Object.entries(INTRO_FRAMES)) {
						if (Number(frame) / INTRO_FPS <= time) render(state);
					}
				};
				for (const [frame, state] of Object.entries(INTRO_FRAMES)) {
					tl.call(render, [state], Number(frame) / INTRO_FPS);
				}

				// The wordmark lands exactly on the static mark, so it swaps in with no jump.
				const landedAt = INTRO_LAST_FRAME / INTRO_FPS;
				tl.set(intro, { visibility: 'hidden' }, landedAt)
					.set(final, { visibility: 'visible' }, landedAt)
					.call(landLoader, [], landedAt);

				// One wavefront removes the stationary logo and opens the scene.
				const revealAt = fadeReveal ? cutAt : homepage ? landedAt + (mobile ? 0 : revealGap) : cutAt;
				const wave = { radius: 0 };
				// quickSetter does not expand the CSSPlugin's multi-property "scale" alias.
				const setRingScaleX = gsap.quickSetter(ring, 'scaleX');
				const setRingScaleY = gsap.quickSetter(ring, 'scaleY');
				// Wave reveals need the first GPU frame. A project fade can reveal
				// the existing hero image immediately while its water shader warms up.
				if (homepage || projectsListing || (projectHero && !fadeReveal))
					tl.addPause(revealAt, () => {
						const hero = projectsListing
							? document.querySelector<HTMLIFrameElement>('iframe[title="Interactive projects"]')
							: (projectHero ?? document.querySelector('[data-scene-cover]')?.parentElement);
						const readyAttribute = projectsListing ? 'data-ribbon-ready' : 'data-liquid-ready';
						const sceneReady = () => hero?.getAttribute(readyAttribute) === 'true';
						const resume = () => {
							stopWaitingForScene();
							setProjectWave(0);
							// Let the first GPU frame and overlay change paint before starting either clock.
							let frames = 0;
							const release = () => {
								if (++frames < 2) return;
								gsap.ticker.remove(release);
								if (!fadeReveal && (!homepage || !mobile) && sceneReady()) {
									root.dataset.webglReveal = 'true';
								}
								if (!fadeReveal) revealScene();
								tl.resume();
							};
							gsap.ticker.add(release);
							stopWaitingForScene = () => gsap.ticker.remove(release);
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
						const timeout = window.setTimeout(resume, homepage ? 15000 : 2000);
						stopWaitingForScene = () => {
							observer.disconnect();
							window.clearTimeout(timeout);
						};
					});
				tl.set(root, { attr: { 'data-revealing': 'true' } }, revealAt);
				if (!homepage && !fadeReveal) tl.call(revealScene, [], revealAt);
				if (fadeReveal) {
					const fade = { elapsed: 0 };
					tl.call(revealScene, [], revealAt)
						.to(
							fade,
							{
								elapsed: Math.max(revealDuration, loaderSettings.heroZoomDuration),
								duration: Math.max(revealDuration, loaderSettings.heroZoomDuration),
								ease: 'none',
								onUpdate: () => renderFade(root, mark, zoomHero(), fade.elapsed),
							},
							revealAt
						)
						.call(
							() => {
								finished.current = true;
								root.dataset.complete = 'true';
								settleLoader();
							},
							[],
							revealAt + revealDuration
						);
				} else if (windowReveal) {
					const opening = { progress: 0 };
					tl.to(
						opening,
						{
							progress: 1,
							duration: revealDuration,
							ease: 'none',
							onUpdate: () =>
								renderRevealWindow(revealWindow, width, height, revealOrigin, opening.progress, page),
						},
						revealAt
					).set(root, { autoAlpha: 0, pointerEvents: 'none' }, revealAt + revealDuration);
				} else if (homepage && mobile) {
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
				} else
					tl.set(ring, { opacity: 0.45 }, revealAt)
						.to(
							wave,
							{
								radius: Math.hypot(width, height) * (mobile ? 0.53 : 1),
								duration: waveDuration,
								ease: projectsListing ? waveSettings.ease : 'power2.inOut',
								onUpdate: () => {
									setProjectWave(wave.radius / (Math.hypot(width, height) * (mobile ? 0.53 : 1)));
									setRingScaleX(wave.radius / 100);
									setRingScaleY(wave.radius / 100);
									if (mobile && ring instanceof HTMLElement)
										ring.style.setProperty(
											'--ring-width',
											`${1 / Math.max(1, wave.radius / 100)}px`
										);
									circle?.setAttribute('r', String(wave.radius));
									wash?.setAttribute('r', String(wave.radius / (logoWidth / LOGO_BOX.width)));
								},
							},
							revealAt
						)
						.to(ring, { opacity: 0, duration: 0.45 }, revealAt + 0.9)
						.set(root, { autoAlpha: 0, pointerEvents: 'none' }, revealAt + waveDuration);
			}
			// Wait for first-view assets, with a deadline for slow or failed requests.
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
			tl.timeScale(speed);
			loaderControl.timeline = tl;
			const deadline = window.setTimeout(start, 1500);
			const images = Array.from(document.images).filter(
				image => image.loading === 'eager' || image.fetchPriority === 'high'
			);
			void Promise.all([
				document.fonts.ready,
				...images.map(image => image.decode().catch(() => undefined)),
			]).then(start, start);
			return () => {
				active = false;
				setProjectWave(1);
				renderRevealWindow(null, width, height, loaderSettings.revealOrigin, 1, page);
				stopWaitingForScene();
				loaderControl.preview = null;
				window.clearTimeout(deadline);
			};
		},
		{ scope: ref, dependencies: [replay], revertOnUpdate: true },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	// Render
	const maskBox = {
		x: -LOGO_BOX.width,
		y: -LOGO_BOX.width,
		width: LOGO_BOX.width * 3,
		height: LOGO_BOX.width * 2 + LOGO_BOX.height,
	};
	return (
		<div ref={ref} className={s.jacket} data-site-loader data-loader-overlay aria-hidden='true'>
			<svg className={s.veil} width='100%' height='100%' aria-hidden='true'>
				<defs>
					<mask id={`${id}-scene`} maskUnits='userSpaceOnUse'>
						<rect width='100%' height='100%' fill='white' />
						<circle data-circle-aperture cx='0' cy='0' r='0' fill='black' />
						<rect data-window-aperture x='0' y='0' width='0' height='0' rx='0' fill='black' />
					</mask>
				</defs>
				<rect width='100%' height='100%' className={s.dark} mask={`url(#${id}-scene)`} />
			</svg>
			<div className={s.centre}>
				<div className={s.mark} data-loader-mark>
					<svg
						className={s.logoViewport}
						viewBox={`0 0 ${LOGO_BOX.width} ${LOGO_BOX.height}`}
						data-loader-svg
						aria-hidden='true'
					>
						<defs>
							<g id={ids.joe} data-letters='joe'>
								{JOE.letters.map(d => (
									<path key={d} d={d} vectorEffect='non-scaling-stroke' />
								))}
							</g>
							<g id={ids.ben} data-letters='ben'>
								{BEN.letters.map(d => (
									<path key={d} d={d} vectorEffect='non-scaling-stroke' />
								))}
							</g>
							<g id={ids.logo}>
								{LOGO.letters.map(d => (
									<path key={d} d={d} vectorEffect='non-scaling-stroke' />
								))}
							</g>
							{cutIds.map(cutId => (
								<clipPath key={cutId} id={cutId} clipPathUnits='userSpaceOnUse'>
									<rect data-cut-rect />
								</clipPath>
							))}
							<clipPath id={ids.band} clipPathUnits='userSpaceOnUse'>
								<path data-clip-band />
							</clipPath>
							<filter id={ids.blur} x='-50%' y='-50%' width='200%' height='200%'>
								<feGaussianBlur data-blur stdDeviation='0' />
							</filter>
							<filter id={`${id}-edge`} x='-50%' y='-50%' width='200%' height='200%'>
								<feGaussianBlur stdDeviation={WASH_BLUR} />
							</filter>
							<mask id={`${id}-wash`} maskUnits='userSpaceOnUse' {...maskBox}>
								<rect {...maskBox} fill='white' />
								<circle
									data-logo-wash
									cx={LOGO_BOX.width / 2}
									cy={LOGO_BOX.height / 2}
									r='0'
									fill='black'
									filter={`url(#${id}-edge)`}
								/>
							</mask>
						</defs>

						<g className={s.intro} data-intro>
							<path className={s.rim} data-band-rim />
							<path className={s.band} data-band />
							<g data-stage-clip>
								<g data-stage>
									<use data-layer='ghost' />
									<use data-layer='shadow' />
									<use data-layer='main' />
									{cutIds.map(cutId => (
										<g key={cutId} clipPath={`url(#${cutId})`}>
											<use data-cut />
										</g>
									))}
								</g>
							</g>
							{barIds.map(barId => (
								<rect key={barId} className={s.bar} data-bar />
							))}
						</g>

						<g className={s.final} mask={`url(#${id}-wash)`} data-final>
							<use href={`#${ids.logo}`} />
						</g>
					</svg>
				</div>
			</div>
			<div className={s.ring} data-loader-ring />
			<noscript>
				<style>{`.${s.jacket}{display:none}`}</style>
			</noscript>
		</div>
	);
};

export default SiteLoader;
