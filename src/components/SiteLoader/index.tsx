'use client';

import { HERO_DESKTOP_QUERY } from '@parts/Hero/layout';
// Imports
// ------------
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import { useEffect, useId, useRef, useState } from 'react';
import { landLoader, revealScene, settleLoader } from './events';
import { BAR_SLOTS, CUT_SLOTS, createIntro, INTRO_FPS, INTRO_FRAMES, INTRO_LAST_FRAME, type IntroIds } from './intro';
import { BEN, JOE, LOGO, LOGO_BOX } from './logoPaths';
import { LOADER_REPLAY, loaderControl, loaderSettings } from './settings';

// Styles
// ------------
import s from './styles.module.scss';

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
			delete root.dataset.complete;
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
				gsap.set(root, { autoAlpha: 0, pointerEvents: 'none' });
				return;
			}
			const circle = root.querySelector('[data-circle-aperture]');
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
			delete root.dataset.webglReveal;
			gsap.set(root, { autoAlpha: 1, pointerEvents: 'auto' });
			gsap.set(circle, { attr: { cx: width / 2, cy: height / 2, r: 0 } });
			gsap.set(wash, { attr: { r: 0 } });
			gsap.set(ring, { scale: 0, opacity: 0 });
			const { revealGap, speed } = loaderSettings;
			let stopWaitingForScene = () => {};
			const tl = gsap.timeline({
				paused: true,
				onComplete: () => {
					finished.current = true;
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
				for (const [frame, state] of Object.entries(INTRO_FRAMES)) {
					tl.call(render, [state], Number(frame) / INTRO_FPS);
				}

				// The wordmark lands exactly on the static mark, so it swaps in with no jump.
				const landedAt = INTRO_LAST_FRAME / INTRO_FPS;
				tl.set(intro, { visibility: 'hidden' }, landedAt)
					.set(final, { visibility: 'visible' }, landedAt)
					.call(landLoader, [], landedAt);

				// One wavefront removes the stationary logo and opens the scene.
				const revealAt = landedAt + revealGap;
				const wave = { radius: 0 };
				const setRingScale = gsap.quickSetter(ring, 'scale');
				// Shader compilation and logo decoding can outlast the logo's hold.
				// Keep both reveals paused until the GPU has actually drawn a frame.
				tl.addPause(revealAt, () => {
					const hero = document.querySelector('[data-scene-cover]')?.parentElement;
					const resume = () => {
						stopWaitingForScene();
						if (mobile && hero?.dataset.liquidReady === 'true') root.dataset.webglReveal = 'true';
						// Let the first GPU frame and overlay change paint before starting either clock.
						let frames = 0;
						const release = () => {
							if (++frames < 2) return;
							gsap.ticker.remove(release);
							revealScene();
							tl.resume();
						};
						gsap.ticker.add(release);
						stopWaitingForScene = () => gsap.ticker.remove(release);
					};
					if (!hero || hero.dataset.liquidReady === 'true') {
						resume();
						return;
					}
					const observer = new MutationObserver(() => {
						if (hero.dataset.liquidReady === 'true') resume();
					});
					observer.observe(hero, { attributes: true, attributeFilter: ['data-liquid-ready'] });
					const timeout = window.setTimeout(resume, 2000);
					stopWaitingForScene = () => {
						observer.disconnect();
						window.clearTimeout(timeout);
					};
				});
				tl.set(ring, { opacity: 0.45 }, revealAt)
					.to(
						wave,
						{
							radius: Math.hypot(width, height) * (mobile ? 0.53 : 1),
							duration: 1.35,
							ease: 'power2.inOut',
							onUpdate: () => {
								setRingScale(wave.radius / 100);
								if (mobile && ring instanceof HTMLElement)
									ring.style.setProperty('--ring-width', `${1 / Math.max(1, wave.radius / 100)}px`);
								circle?.setAttribute('r', String(wave.radius));
								wash?.setAttribute('r', String(wave.radius / (logoWidth / LOGO_BOX.width)));
							},
						},
						revealAt
					)
					.to(ring, { opacity: 0, duration: 0.45 }, revealAt + 0.9)
					.set(root, { autoAlpha: 0, pointerEvents: 'none' }, revealAt + 1.35);
			}
			// Wait for first-view assets, with a deadline for slow or failed requests.
			let active = true;
			let started = false;
			const start = () => {
				if (!active || started) return;
				started = true;
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
				stopWaitingForScene();
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
