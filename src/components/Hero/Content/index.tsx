'use client';

// Imports
// ------------
import { isLoaderPending, LOADER_REVEAL } from '@parts/SiteLoader/events';
import { MOBILE_COLOUR_DURATION } from '@parts/SiteLoader/mobile-intro';
import SpecialHeading from '@parts/SpecialHeading';
import { splitStega } from '@utils/stega';
import { useAnimation } from '@utils/useAnimation';
import Grid from '@waffl';
import { gsap } from 'gsap';
import { useRouter } from 'next/navigation';
import { Fragment, useLayoutEffect, useRef } from 'react';
import { type IntroSettings, introDefaults, introReplays, introSettings, sceneIntros } from '../Background/scene-intro';
import { HERO_DESKTOP_QUERY } from '../layout';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Constants
// ------------
// Marquee speed added at the start of the wave intro, which the timeline tweens back to 0
const MARQUEE_INTRO_BOOST = 5;
// Cover circle: the distance to its far corner as viewport fractions, and how far past that it grows
const COVER_REACH_X = 0.5;
const COVER_REACH_Y = 0.52;
const COVER_OVERSHOOT = 1.05;
const DESKTOP_ENTRANCE_DELAY = 0.15;
const PORTRAIT_AT = 0.3;
const PORTRAIT_DURATION = 1.2;
const MARQUEE_SETTLE_AT = 1.5;
const MARQUEE_SETTLE_DURATION = 1.6;
const STAR_START_ROTATION = -90;
const STAR_START_SCALE = 0.6;
// Words sit just below their overflow mask
const WORD_START_Y_PERCENT = 105;
// Copyright: four digits per side, and each step's offset from the heading start
const COPYRIGHT_DIGITS = 4;
const COPYRIGHT_LINE_OFFSET = 0.12;
const COPYRIGHT_DIGIT_OFFSET = 0.3;
const COPYRIGHT_DIGIT_DURATION = 0.5;

// Component
// ------------
// NOTE • The hero's text: heading, star, intro paragraph and the copyright line. Its
// entrance is one GSAP timeline that plays when the site loader reveals the scene (or at
// once if navigating in, on mobile or with reduced motion). The timings come from the
// scene's intro settings so the tweak panel can replay it live.
const Content = ({ heading, description }: I.ContentProps) => {
	// Context
	const router = useRouter();

	// Refs
	const ref = useRef<HTMLElement>(null);
	const entered = useRef(false);
	const projectsPrefetched = useRef(false);

	// Effects
	// Cached routes retain refs, but their entrance must replay when reactivated.
	useLayoutEffect(
		() => () => {
			entered.current = false;
		},
		[]
	);

	// Animations
	useAnimation(
		({ reduced, heroDesktop }) => {
			const root = ref.current;
			if (!root) return;
			const host = root.parentElement;
			if (!host) return;
			// The scene cover is the mask the water reveal opens (grown by --reveal-radius)
			const cover = host.querySelector<HTMLElement>('[data-scene-cover]');
			const config = () => introSettings.get(host) ?? introDefaults;
			// Reduced motion and mobile skip the water wave and portrait zoom (their values start at the end state)
			const simpleIntro = reduced || !heroDesktop;
			// Navigation has its own whole-page lens; first load and replay keep this wave.
			let navigationIntro = !isLoaderPending();
			// Where each intro value starts; with no wave, the wave's values begin at their end state
			const introStart = (skipWave: boolean) => ({
				portrait: skipWave ? 1 : 0,
				marqueeBoost: skipWave ? 0 : MARQUEE_INTRO_BOOST,
				waterReveal: skipWave ? 1 : 0,
				colour: !reduced && !heroDesktop ? 1 : 0,
			});
			// Shared with the renderer through sceneIntros; the timeline tweens each value to its final state
			const intro = introStart(simpleIntro || navigationIntro);
			sceneIntros.set(host, intro);

			// Per frame: bumps data-text-frame and sizes the cover circle (--reveal-radius) to reach the viewport corners as the wave grows
			const tick = () => {
				root.dataset.textFrame = String(Number(root.dataset.textFrame || 0) + 1);
				const radius =
					Math.hypot(window.innerWidth * COVER_REACH_X, window.innerHeight * COVER_REACH_Y) *
					COVER_OVERSHOOT *
					intro.waterReveal;
				cover?.style.setProperty('--reveal-radius', `${radius}px`);
			};

			// Elements the entrance animates
			const title = root.querySelector('h1 span');
			const star = root.querySelector('svg');
			const wipe = root.querySelector('[data-heading-wipe]');
			const words = root.querySelectorAll('[data-reveal-word]');
			const copyrightIcon = host.querySelector('[data-copyright-icon]');
			const copyrightLines = host.querySelectorAll('[data-copyright-line]');
			const copyright = host.querySelector('[data-copyright]');
			// Heading, star and words back to their hidden start; the first run also pins the star's origin
			const hideEntrance = (starVars: gsap.TweenVars = {}) => {
				gsap.set(title, { opacity: 0 });
				gsap.set(star, { opacity: 0, rotation: STAR_START_ROTATION, scale: STAR_START_SCALE, ...starVars });
				gsap.set(words, { y: 0, yPercent: WORD_START_Y_PERCENT, opacity: 0 });
				gsap.set(wipe, { scaleX: 0, transformOrigin: 'left center' });
			};
			// Copyright: icon fades in, rule lines draw outward, and the year's digits slide in
			const resetCopyright = () => {
				gsap.set(copyrightIcon, { opacity: 0 });
				gsap.set(copyrightLines, {
					scaleX: 0,
					transformOrigin: index => (index === 0 ? 'right center' : 'left center'),
				});
				for (const side of ['left', 'right']) {
					for (let digit = 0; digit < COPYRIGHT_DIGITS; digit++)
						gsap.set(copyright, { [`--${side}-${digit}`]: '110%' });
				}
			};

			const prefetchProjects = () => {
				if (projectsPrefetched.current) return;
				projectsPrefetched.current = true;
				// Give the homepage entrance priority before warming the next route.
				router.prefetch('/projects');
			};

			// Reduced motion: show everything in its final state
			if (reduced) {
				entered.current = true;
				gsap.set(cover, { opacity: 0 });
				if (cover) cover.dataset.complete = 'true';
				root.dataset.entrance = 'complete';
				tick();
				prefetchProjects();
				return;
			}

			// Set the starting state, then build the timeline paused or running (see below)
			root.dataset.entrance = 'running';
			if (cover) {
				if (heroDesktop && !navigationIntro) delete cover.dataset.complete;
				else cover.dataset.complete = 'true';
			}
			gsap.set(cover, { opacity: 1 });
			cover?.style.setProperty('--reveal-radius', '0px');
			hideEntrance({ transformOrigin: '50% 50%' });
			resetCopyright();

			const tl = gsap.timeline({
				delay: heroDesktop ? DESKTOP_ENTRANCE_DELAY : 0,
				onUpdate: tick,
				onComplete: () => {
					entered.current = true;
					root.dataset.entrance = 'complete';
					tick();
					prefetchProjects();
				},
			});

			// Wave, portrait zoom and marquee settle: desktop first load and replay only
			const addSceneTweens = (timing: IntroSettings) => {
				tl.to(
					intro,
					{
						waterReveal: 1,
						duration: 1 / timing.speed,
						ease: timing.ease,
						onComplete: () => {
							if (cover) cover.dataset.complete = 'true';
						},
					},
					timing.start
				)
					.to(intro, { portrait: 1, duration: PORTRAIT_DURATION, ease: 'power3.out' }, PORTRAIT_AT)
					.to(
						intro,
						{ marqueeBoost: 0, duration: MARQUEE_SETTLE_DURATION, ease: 'power3.out' },
						MARQUEE_SETTLE_AT
					);
			};

			// Wipe across the heading, then the star and the paragraph's words
			const addTextTweens = (timing: IntroSettings) => {
				const uncoverAt = timing.headingStart + timing.headingCoverDuration;
				tl.to(
					wipe,
					{ scaleX: 1, duration: timing.headingCoverDuration, ease: 'power3.inOut' },
					timing.headingStart
				)
					.set(title, { opacity: 1 }, uncoverAt)
					.set(wipe, { transformOrigin: 'right center' }, uncoverAt)
					.to(wipe, { scaleX: 0, duration: timing.headingRevealDuration, ease: 'power3.inOut' }, uncoverAt)
					.to(
						star,
						{ opacity: 1, rotation: 0, scale: 1, duration: timing.starDuration, ease: 'power3.out' },
						timing.starStart
					)
					.to(
						words,
						{
							yPercent: 0,
							y: 0,
							opacity: 1,
							duration: timing.wordDuration,
							stagger: timing.wordStagger,
							ease: 'power3.out',
						},
						timing.paragraphStart
					);
			};

			const addCopyrightTweens = (timing: IntroSettings) => {
				const copyrightStart = timing.headingStart;
				tl.to(
					copyrightIcon,
					{ opacity: 1, duration: timing.copyrightFade, ease: 'sine.out' },
					copyrightStart
				).to(
					copyrightLines,
					{ scaleX: 1, duration: timing.copyrightLineDuration, ease: 'power3.inOut' },
					copyrightStart + COPYRIGHT_LINE_OFFSET
				);

				// Inherited variables avoid mutating the streamed year before it hydrates.
				for (let digit = 0; digit < COPYRIGHT_DIGITS; digit++) {
					tl.to(
						copyright,
						{
							[`--left-${COPYRIGHT_DIGITS - 1 - digit}`]: '0%',
							[`--right-${digit}`]: '0%',
							duration: COPYRIGHT_DIGIT_DURATION,
							ease: 'power3.out',
						},
						copyrightStart + COPYRIGHT_DIGIT_OFFSET + digit * timing.copyrightDigitStagger
					);
				}
			};

			// Adds every tween, reading the live timings so the settings panel can rebuild it
			const buildTimeline = () => {
				const timing = config();
				// Begin with the loader exit; colour settles just after both scales land.
				if (!heroDesktop) tl.to(intro, { colour: 0, duration: MOBILE_COLOUR_DURATION, ease: 'sine.inOut' }, 0);
				if (heroDesktop && !navigationIntro) addSceneTweens(timing);
				addTextTweens(timing);
				addCopyrightTweens(timing);
			};
			buildTimeline();

			// Responsive contexts rebuild their tweens; retain the revealed scene.
			if (entered.current) tl.progress(1).pause();
			else if (isLoaderPending()) tl.pause(0);

			// Resets everything to the start and plays again; used by the loader reveal and the tweak panel
			const replayIntro = () => {
				navigationIntro = false;
				tl.pause(0);
				tl.clear();
				resetCopyright();
				Object.assign(intro, introStart(simpleIntro));
				root.dataset.entrance = 'running';
				if (cover && heroDesktop) delete cover.dataset.complete;
				hideEntrance();
				buildTimeline();
				tick();
				tl.restart();
			};

			introReplays.set(host, () => {
				tl.timeScale(1);
				replayIntro();
			});
			// Rebuild with restored settings, exactly as the settings-panel replay does.
			const revealLoader = () => replayIntro();
			window.addEventListener(LOADER_REVEAL, revealLoader);
			return () => {
				introReplays.delete(host);
				window.removeEventListener(LOADER_REVEAL, revealLoader);
			};
		},
		{ scope: ref, dependencies: [heading, description, router], revertOnUpdate: true },
		{ reduced: '(prefers-reduced-motion: reduce)', heroDesktop: HERO_DESKTOP_QUERY }
	);

	// Derived
	const descriptionParts = splitStega(description || '');

	// Render
	return (
		<section ref={ref} className={s.content} data-hero-content>
			<Grid>
				<hgroup>
					<div className={s.heading}>
						<SpecialHeading text={heading} tag='h1' />
						<span className={s.wipe} data-heading-wipe aria-hidden='true' />
					</div>
					{/* NOTE • Words are split from the clean text and the Visual Editing payload
					    is rendered once at the end, so the paragraph stays click-to-edit */}
					<p data-type='bodyL' data-sanity-edit-target>
						{Array.from(descriptionParts.clean.matchAll(/\S+|\s+/g), match => ({
							word: match[0],
							id: match.index,
						})).map(({ word, id }) =>
							/\s+/.test(word) ? (
								<Fragment key={id}>{word}</Fragment>
							) : (
								<span key={id} className={s.wordMask} data-word-mask>
									<span className={s.word} data-reveal-word>
										{word}
									</span>
								</span>
							)
						)}
						{descriptionParts.encoded}
					</p>
				</hgroup>
			</Grid>
		</section>
	);
};

// Exports
// ------------
Content.displayName = 'Content';
export default Content;
