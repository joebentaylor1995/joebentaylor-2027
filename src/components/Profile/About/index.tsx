'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { defaults, getSettings, subscribe } from '@parts/ProfileReveal/Settings/store';
import SpecialHeading from '@parts/SpecialHeading';
import { warmScene } from '@utils/prepareScene';
import { useAnimation } from '@utils/useAnimation';
import Grid, { Col } from '@waffl';
import gsap from 'gsap';
import Image, { getImageProps } from 'next/image';
import { type CSSProperties, use, useEffect, useRef, useSyncExternalStore } from 'react';
import type { AboutImage } from '@/data/site';

// Styles + Interfaces
// ------------
import s from './styles.module.scss';

// Constants
// ------------
// NOTE • Covers the viewport at any ratio — the 115svh floor suits the tallest
// art-directed crop, so no frame is ever upscaled
const FRAME_SIZES =
	'(min-width: 1600px) max(75.9vw, 115svh), (min-width: 971px) max(1214px, 115svh), max(125vw, 115svh)';

// Helpers
// ------------
// One portrait frame's image, as mounted and as warmed ahead of it
const frameImage = (src: string) => ({ src, quality: 90, alt: '', fill: true, sizes: FRAME_SIZES }) as const;

// Scroll-scrubbed trigger inside the profile panel, recalculated on refresh
const scrubTrigger = (scroller: Element, vars: ScrollTrigger.Vars): ScrollTrigger.Vars => ({
	scroller,
	scrub: true,
	invalidateOnRefresh: true,
	...vars,
});

// Component
// ------------
// NOTE • The portraits are stacked frames: scrolling zooms each new frame in over the last, then the final one fades out
const About = ({ paragraphs, images }: { paragraphs: string[]; images: AboutImage[] }) => {
	// Context
	const present = use(ProfilePresenceContext);

	// State
	// Tuning values from the profile settings store (live-editable); percentages unless noted
	const {
		aboutScrollDistance,
		aboutStartZoom,
		aboutFinalOpacity,
		aboutIntroParallax,
		aboutExitParallax,
		aboutPreviousZoom,
	} = useSyncExternalStore(subscribe, getSettings, () => defaults);

	// Refs
	const sectionRef = useRef<HTMLElement>(null);

	// Derived
	// NOTE • Keyed on the URLs so a re-render with the same portraits doesn't warm them again
	const frameKey = images.map(({ src }) => src).join('|');

	// Effects
	// NOTE • Why: the frames only mount once the profile is present, so the portraits (the largest
	// images in the panel) started downloading as it opened. A detached image with the same
	// srcset and sizes picks the same file, so warming it while the profile is closed leaves the
	// mounted frame to load from the cache.
	useEffect(
		() =>
			warmScene(sectionRef.current, () =>
				Promise.all(
					frameKey
						.split('|')
						.filter(Boolean)
						.map(src => {
							const { props } = getImageProps(frameImage(src));
							const image = document.createElement('img');
							if (props.sizes) image.sizes = props.sizes;
							if (props.srcSet) image.srcset = props.srcSet;
							image.src = props.src;
							return image.decode().catch(() => {});
						})
				)
			),
		[frameKey]
	);

	// Animations
	useAnimation(
		({ reduceMotion }) => {
			const section = sectionRef.current;
			const scroller = section?.closest('#profile-panel');
			if (!present || !section || !scroller || reduceMotion) return;

			const frames = gsap.utils.toArray<HTMLElement>('[data-about-frame]', section);
			const firstImage = frames[0]?.querySelector('img');

			if (!firstImage) return;

			const height = () => frames[0].getBoundingClientRect().height;

			// SECTION • Intro parallax on the first frame as the section scrolls in
			gsap.fromTo(
				firstImage,
				{ yPercent: aboutIntroParallax },
				{
					yPercent: 0,
					ease: 'none',
					scrollTrigger: scrubTrigger(scroller, { trigger: section, start: 'top bottom', end: 'top top' }),
				}
			);

			// SECTION • Pinned sequence: each later frame scales up over the one before
			gsap.set(frames.slice(1), { scale: 0 });

			const timeline = gsap.timeline({
				defaults: { ease: 'none' },
				scrollTrigger: scrubTrigger(scroller, {
					trigger: section,
					start: 'top top',
					end: () => `+=${height() * (aboutScrollDistance / 100)}`,
				}),
			});
			const frameDuration = aboutScrollDistance / 400;

			for (let index = 1; index < frames.length; index++) {
				timeline.to(frames[index], { scale: 1, duration: frameDuration });
				timeline.fromTo(
					frames[index].querySelector('[data-about-zoom]'),
					{ scale: aboutStartZoom / 100 },
					{ scale: 1, duration: frameDuration },
					'<'
				);
				timeline.fromTo(
					frames[index - 1].querySelector('[data-about-zoom]'),
					{ scale: 1 },
					{ scale: 1 + aboutPreviousZoom / 100, duration: frameDuration, immediateRender: false },
					'<'
				);
				// Remove covered layers so the final portrait can fade against the dark background.
				timeline.set(frames[index - 1], { visibility: 'hidden' });
			}

			// SECTION • Final portrait fades back as the text scrolls past
			gsap.fromTo(
				frames.at(-1) as HTMLElement,
				{ opacity: 1 },
				{
					opacity: aboutFinalOpacity / 100,
					ease: 'none',
					scrollTrigger: scrubTrigger(scroller, {
						trigger: section.querySelector('[data-about-text]'),
						start: 'top bottom',
						end: 'bottom bottom',
					}),
				}
			);

			// SECTION • Exit parallax on the final portrait
			gsap.fromTo(
				frames.at(-1)?.querySelector('img') ?? null,
				{ yPercent: 0 },
				{
					yPercent: aboutExitParallax,
					ease: 'none',
					scrollTrigger: scrubTrigger(scroller, {
						trigger: section,
						start: 'bottom bottom',
						end: 'bottom top',
					}),
				}
			);
		},
		{
			scope: sectionRef,
			dependencies: [
				present,
				aboutScrollDistance,
				aboutStartZoom,
				aboutFinalOpacity,
				aboutIntroParallax,
				aboutExitParallax,
				aboutPreviousZoom,
			],
			revertOnUpdate: true,
		},
		{ reduceMotion: '(prefers-reduced-motion: reduce)' }
	);

	// Render
	return (
		<section
			ref={sectionRef}
			className={s.jacket}
			data-about
			aria-label='About me'
			style={
				{
					'--about-scroll-distance': `${aboutScrollDistance}svh`,
					'--about-final-opacity': aboutFinalOpacity / 100,
				} as CSSProperties
			}
		>
			<div className={s.stage} aria-hidden='true'>
				{images.map(({ src, focus }, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: the sequence repeats its portrait; position is the identity
						key={index}
						className={s.frame}
						data-about-frame
						style={{ '--about-focus': focus } as CSSProperties}
					>
						<div className={s.zoom} data-about-zoom>
							{present && <Image {...frameImage(src)} loading='lazy' />}
						</div>
					</div>
				))}
			</div>
			<div className={s.journey} aria-hidden='true' />
			<div className={s.copy}>
				<Grid columnsDesktop={8}>
					<Col l='1/4' className={s.heading}>
						<SpecialHeading text='About' revealOnView />
					</Col>
					<Col l='4/9' className={s.text} data-about-text>
						{paragraphs.map(paragraph => (
							<p key={paragraph} data-type='bodyL'>
								{paragraph}
							</p>
						))}
					</Col>
				</Grid>
			</div>
		</section>
	);
};

// Exports
// ------------
About.displayName = 'About';
export default About;
