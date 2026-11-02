'use client';

// Imports
// ------------
import { useAnimation } from '@utils/useAnimation';
import { useEffect, useId, useRef, useState } from 'react';
import { resetLoader } from './events';
import { BAR_SLOTS, CUT_SLOTS, type IntroIds } from './intro';
import { BEN, JOE, LOGO, LOGO_BOX } from './logoPaths';
import { LOADER_REPLAY, loaderControl } from './settings';
// Styles + Interfaces
// ------------
import s from './styles.module.scss';
import {
	addIntroAndReveal,
	addReducedExit,
	createLoaderTimeline,
	finishSceneReveal,
	hideFinishedLoader,
	playWhenAssetsReady,
	readLoaderScene,
	resetLoaderVisuals,
	type SceneWait,
} from './timeline';

// Constants
// ------------
// NOTE • The wash mask was tuned on the 68px-wide logo; the mark now draws in
// the logo's native 405-unit artboard, so its blur scales with it.
const ARTBOARD_SCALE = LOGO_BOX.width / 68;
const WASH_BLUR = 1.2 * ARTBOARD_SCALE;

// Component
// ------------
// NOTE • The full-screen intro: a glitch-style wordmark animation that plays frame by
// frame, then a reveal (fade, window or circular wave, depending on the page) that
// uncovers the site. One GSAP timeline drives it all; it starts paused and is played
// once first-view assets are ready.
const SiteLoader = () => {
	// Refs
	const ref = useRef<HTMLDivElement>(null);
	const finished = useRef(false);
	const id = useId().replaceAll(':', '');
	// SVG ids must be unique per instance, so they hang off a React id
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
				hideFinishedLoader(root);
				return;
			}

			const scene = readLoaderScene(root, finished);
			resetLoaderVisuals(scene, `url("#${id}-scene")`, reduced);

			// Built paused, played once first-view assets are ready
			const sceneWait: SceneWait = { stop: () => {} };
			const tl = createLoaderTimeline(scene);
			if (reduced || !scene.svg) addReducedExit(scene, tl);
			else addIntroAndReveal(scene, tl, scene.svg, ids, sceneWait);
			const stopWaitingForAssets = playWhenAssetsReady(tl);

			return () => {
				stopWaitingForAssets();
				finishSceneReveal(scene);
				sceneWait.stop();
				loaderControl.preview = null;
			};
		},
		{ scope: ref, dependencies: [replay], revertOnUpdate: true },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	// Derived
	// Oversized mask area so the wash circle can grow past the logo's edges
	const maskBox = {
		x: -LOGO_BOX.width,
		y: -LOGO_BOX.width,
		width: LOGO_BOX.width * 3,
		height: LOGO_BOX.width * 2 + LOGO_BOX.height,
	};

	// Render
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

// Exports
// ------------
export default SiteLoader;
