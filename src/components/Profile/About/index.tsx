'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { defaults, getSettings, subscribe } from '@parts/ProfileReveal/Settings/store';
import SpecialHeading from '@parts/SpecialHeading';
import { useAnimation } from '@utils/useAnimation';
import Grid, { Col } from '@waffl';
import gsap from 'gsap';
import Image from 'next/image';
import { type CSSProperties, use, useRef, useSyncExternalStore } from 'react';
import type { AboutImage } from '@/data/site';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
// NOTE • Covers the viewport at any ratio — the 115svh floor suits the tallest
// art-directed crop, so no frame is ever upscaled
const FRAME_SIZES =
	'(min-width: 1600px) max(75.9vw, 115svh), (min-width: 971px) max(1214px, 115svh), max(125vw, 115svh)';

const About = ({ paragraphs, images }: { paragraphs: string[]; images: AboutImage[] }) => {
	// Context + Refs
	const present = use(ProfilePresenceContext);
	const {
		aboutScrollDistance,
		aboutStartZoom,
		aboutFinalOpacity,
		aboutIntroParallax,
		aboutExitParallax,
		aboutPreviousZoom,
	} = useSyncExternalStore(subscribe, getSettings, () => defaults);
	const sectionRef = useRef<HTMLElement>(null);

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
			gsap.fromTo(
				firstImage,
				{ yPercent: aboutIntroParallax },
				{
					yPercent: 0,
					ease: 'none',
					scrollTrigger: {
						trigger: section,
						scroller,
						start: 'top bottom',
						end: 'top top',
						scrub: true,
						invalidateOnRefresh: true,
					},
				}
			);
			gsap.set(frames.slice(1), { scale: 0 });
			const timeline = gsap.timeline({
				defaults: { ease: 'none' },
				scrollTrigger: {
					trigger: section,
					scroller,
					start: 'top top',
					end: () => `+=${height() * (aboutScrollDistance / 100)}`,
					scrub: true,
					invalidateOnRefresh: true,
				},
			});
			for (let index = 1; index < frames.length; index++) {
				timeline.to(frames[index], { scale: 1, duration: aboutScrollDistance / 400 });
				timeline.fromTo(
					frames[index].querySelector('[data-about-zoom]'),
					{ scale: aboutStartZoom / 100 },
					{ scale: 1, duration: aboutScrollDistance / 400 },
					'<'
				);
				timeline.fromTo(
					frames[index - 1].querySelector('[data-about-zoom]'),
					{ scale: 1 },
					{ scale: 1 + aboutPreviousZoom / 100, duration: aboutScrollDistance / 400, immediateRender: false },
					'<'
				);
				// Remove covered layers so the final portrait can fade against the dark background.
				timeline.set(frames[index - 1], { visibility: 'hidden' });
			}
			gsap.fromTo(
				frames.at(-1) as HTMLElement,
				{ opacity: 1 },
				{
					opacity: aboutFinalOpacity / 100,
					ease: 'none',
					scrollTrigger: {
						trigger: section.querySelector('[data-about-text]'),
						scroller,
						start: 'top bottom',
						end: 'bottom bottom',
						scrub: true,
						invalidateOnRefresh: true,
					},
				}
			);
			gsap.fromTo(
				frames.at(-1)?.querySelector('img') ?? null,
				{ yPercent: 0 },
				{
					yPercent: aboutExitParallax,
					ease: 'none',
					scrollTrigger: {
						trigger: section,
						scroller,
						start: 'bottom bottom',
						end: 'bottom top',
						scrub: true,
						invalidateOnRefresh: true,
					},
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
							{present && <Image src={src} quality={90} alt='' fill loading='lazy' sizes={FRAME_SIZES} />}
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
