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
import { introDefaults, introReplays, introSettings, sceneIntros } from '../Background/scene-intro';
import { HERO_DESKTOP_QUERY } from '../layout';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const Content = ({ heading, description }: I.ContentProps) => {
	const router = useRouter();
	const ref = useRef<HTMLElement>(null);
	const entered = useRef(false);
	const projectsPrefetched = useRef(false);
	// Cached routes retain refs, but their entrance must replay when reactivated.
	useLayoutEffect(
		() => () => {
			entered.current = false;
		},
		[]
	);
	useAnimation(
		({ reduced, heroDesktop }) => {
			const root = ref.current;
			if (!root) return;
			const host = root.parentElement;
			if (!host) return;
			const cover = host.querySelector<HTMLElement>('[data-scene-cover]');
			const config = () => introSettings.get(host) ?? introDefaults;
			const simpleIntro = reduced || !heroDesktop;
			// Navigation has its own whole-page lens; first load and replay keep this wave.
			let navigationIntro = !isLoaderPending();
			const intro = {
				portrait: simpleIntro || navigationIntro ? 1 : 0,
				marqueeBoost: simpleIntro || navigationIntro ? 0 : 5,
				waterReveal: simpleIntro || navigationIntro ? 1 : 0,
				colour: !reduced && !heroDesktop ? 1 : 0,
			};
			sceneIntros.set(host, intro);
			const tick = () => {
				root.dataset.textFrame = String(Number(root.dataset.textFrame || 0) + 1);
				const radius =
					Math.hypot(window.innerWidth * 0.5, window.innerHeight * 0.52) * 1.05 * intro.waterReveal;
				cover?.style.setProperty('--reveal-radius', `${radius}px`);
			};
			const title = root.querySelector('h1 span');
			const star = root.querySelector('svg');
			const wipe = root.querySelector('[data-heading-wipe]');
			const words = root.querySelectorAll('[data-reveal-word]');
			const copyrightIcon = host.querySelector('[data-copyright-icon]');
			const copyrightLines = host.querySelectorAll('[data-copyright-line]');
			const copyright = host.querySelector('[data-copyright]');
			const resetCopyright = () => {
				gsap.set(copyrightIcon, { opacity: 0 });
				gsap.set(copyrightLines, {
					scaleX: 0,
					transformOrigin: index => (index === 0 ? 'right center' : 'left center'),
				});
				for (const side of ['left', 'right']) {
					for (let digit = 0; digit < 4; digit++) gsap.set(copyright, { [`--${side}-${digit}`]: '110%' });
				}
			};
			const prefetchProjects = () => {
				if (projectsPrefetched.current) return;
				projectsPrefetched.current = true;
				// Give the homepage entrance priority before warming the next route.
				router.prefetch('/projects');
			};
			if (reduced) {
				entered.current = true;
				gsap.set(cover, { opacity: 0 });
				if (cover) cover.dataset.complete = 'true';
				root.dataset.entrance = 'complete';
				tick();
				prefetchProjects();
				return;
			}
			root.dataset.entrance = 'running';
			if (cover) {
				if (heroDesktop && !navigationIntro) delete cover.dataset.complete;
				else cover.dataset.complete = 'true';
			}
			gsap.set(cover, { opacity: 1 });
			cover?.style.setProperty('--reveal-radius', '0px');
			gsap.set(title, { opacity: 0 });
			gsap.set(star, { opacity: 0, rotation: -90, scale: 0.6, transformOrigin: '50% 50%' });
			gsap.set(words, { y: 0, yPercent: 105, opacity: 0 });
			gsap.set(wipe, { scaleX: 0, transformOrigin: 'left center' });
			resetCopyright();
			const tl = gsap.timeline({
				delay: heroDesktop ? 0.15 : 0,
				onUpdate: tick,
				onComplete: () => {
					entered.current = true;
					root.dataset.entrance = 'complete';
					tick();
					prefetchProjects();
				},
			});
			const buildTimeline = () => {
				const timing = config();
				const uncoverAt = timing.headingStart + timing.headingCoverDuration;
				const copyrightStart = timing.headingStart;
				// Begin with the loader exit; colour settles just after both scales land.
				if (!heroDesktop) tl.to(intro, { colour: 0, duration: MOBILE_COLOUR_DURATION, ease: 'sine.inOut' }, 0);
				if (heroDesktop && !navigationIntro)
					tl.to(
						intro,
						{
							waterReveal: 1,
							duration: 1 / config().speed,
							ease: config().ease,
							onComplete: () => {
								if (cover) cover.dataset.complete = 'true';
							},
						},
						config().start
					)
						.to(intro, { portrait: 1, duration: 1.2, ease: 'power3.out' }, 0.3)
						.to(intro, { marqueeBoost: 0, duration: 1.6, ease: 'power3.out' }, 1.5);
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
					)
					.to(copyrightIcon, { opacity: 1, duration: timing.copyrightFade, ease: 'sine.out' }, copyrightStart)
					.to(
						copyrightLines,
						{ scaleX: 1, duration: timing.copyrightLineDuration, ease: 'power3.inOut' },
						copyrightStart + 0.12
					);
				// Inherited variables avoid mutating the streamed year before it hydrates.
				for (let digit = 0; digit < 4; digit++) {
					tl.to(
						copyright,
						{
							[`--left-${3 - digit}`]: '0%',
							[`--right-${digit}`]: '0%',
							duration: 0.5,
							ease: 'power3.out',
						},
						copyrightStart + 0.3 + digit * timing.copyrightDigitStagger
					);
				}
			};
			buildTimeline();
			// Responsive contexts rebuild their tweens; retain the revealed scene.
			if (entered.current) tl.progress(1).pause();
			else if (isLoaderPending()) tl.pause(0);
			const replayIntro = () => {
				navigationIntro = false;
				tl.pause(0);
				tl.clear();
				resetCopyright();
				intro.waterReveal = simpleIntro ? 1 : 0;
				intro.portrait = simpleIntro ? 1 : 0;
				intro.marqueeBoost = simpleIntro ? 0 : 5;
				intro.colour = heroDesktop ? 0 : 1;
				root.dataset.entrance = 'running';
				if (cover && heroDesktop) delete cover.dataset.complete;
				gsap.set(title, { opacity: 0 });
				gsap.set(star, { opacity: 0, rotation: -90, scale: 0.6 });
				gsap.set(words, { y: 0, yPercent: 105, opacity: 0 });
				gsap.set(wipe, { scaleX: 0, transformOrigin: 'left center' });
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
	const descriptionParts = splitStega(description || '');

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
