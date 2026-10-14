'use client';

// Imports
// ------------

import SpecialHeading from '@parts/SpecialHeading';
import { useAnimation } from '@utils/useAnimation';
import Grid, { Col } from '@waffl';
import { gsap } from 'gsap';
import { Fragment, useRef } from 'react';
import { introDefaults, introReplays, introSettings, sceneIntros } from '../Background/scene-intro';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const Content = ({ heading, description }: I.ContentProps) => {
	const ref = useRef<HTMLElement>(null);
	useAnimation(
		({ reduced }) => {
			const root = ref.current;
			if (!root) return;
			const host = root.parentElement;
			if (!host) return;
			const cover = host.querySelector<HTMLElement>('[data-scene-cover]');
			const config = () => introSettings.get(host) ?? introDefaults;
			const intro = { portrait: reduced ? 1 : 0, marqueeBoost: reduced ? 0 : 5, waterReveal: reduced ? 1 : 0 };
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
			if (reduced) {
				gsap.set(cover, { opacity: 0 });
				if (cover) cover.dataset.complete = 'true';
				root.dataset.entrance = 'complete';
				tick();
				return;
			}
			root.dataset.entrance = 'running';
			if (cover) delete cover.dataset.complete;
			gsap.set(cover, { opacity: 1 });
			cover?.style.setProperty('--reveal-radius', '0px');
			gsap.set(title, { opacity: 0 });
			gsap.set(star, { opacity: 0, rotation: -90, scale: 0.6, transformOrigin: '50% 50%' });
			gsap.set(words, { yPercent: 105, opacity: 0 });
			gsap.set(wipe, { scaleX: 0, transformOrigin: 'left center' });
			resetCopyright();
			const tl = gsap.timeline({
				delay: 0.15,
				onUpdate: tick,
				onComplete: () => {
					root.dataset.entrance = 'complete';
					tick();
				},
			});
			const buildTimeline = () => {
				const timing = config();
				const uncoverAt = timing.headingStart + timing.headingCoverDuration;
				const copyrightStart = timing.headingStart;
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
					0.1
				)
					.to(intro, { portrait: 1, duration: 1.2, ease: 'power3.out' }, 0.3)
					.to(intro, { marqueeBoost: 0, duration: 1.6, ease: 'power3.out' }, 1.5)
					.to(
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
			introReplays.set(host, () => {
				tl.pause(0);
				tl.clear();
				resetCopyright();
				intro.waterReveal = 0;
				intro.portrait = 0;
				intro.marqueeBoost = 5;
				root.dataset.entrance = 'running';
				if (cover) delete cover.dataset.complete;
				gsap.set(title, { opacity: 0 });
				gsap.set(star, { opacity: 0, rotation: -90, scale: 0.6 });
				gsap.set(words, { yPercent: 105, opacity: 0 });
				gsap.set(wipe, { scaleX: 0, transformOrigin: 'left center' });
				buildTimeline();
				tick();
				tl.restart();
			});
			return () => {
				introReplays.delete(host);
			};
		},
		{ scope: ref, dependencies: [heading, description], revertOnUpdate: true },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);
	return (
		<section ref={ref} className={s.content} data-hero-content>
			<Grid>
				<Col as='hgroup' $l='1/5'>
					<div className={s.heading}>
						<SpecialHeading text={heading} tag='h1' />
						<span className={s.wipe} data-heading-wipe aria-hidden='true' />
					</div>
					<p data-type='bodyL'>
						{Array.from((description || '').matchAll(/\S+|\s+/g), match => ({
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
					</p>
				</Col>
			</Grid>
		</section>
	);
};

// Exports
// ------------
Content.displayName = 'Content';
export default Content;
