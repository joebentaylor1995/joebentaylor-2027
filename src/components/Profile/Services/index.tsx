'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import SpecialHeading from '@parts/SpecialHeading';
import { useAnimation } from '@utils/useAnimation';
import Grid, { Col } from '@waffl';
import gsap from 'gsap';
import Image from 'next/image';
import { use, useRef } from 'react';
import type { ProfilePanelContent } from '@/data/site';

// Styles
// ------------
import s from './styles.module.scss';

// Types
// ------------
interface ServicesProps {
	intro: ProfilePanelContent['servicesIntro'];
	services: ProfilePanelContent['services'];
}

// Component
// ------------
const Services = ({ intro, services }: ServicesProps) => {
	// Context + Refs
	const present = use(ProfilePresenceContext);
	const sectionRef = useRef<HTMLElement>(null);

	// Animations
	useAnimation(
		({ reduceMotion }) => {
			const section = sectionRef.current;
			const scroller = section?.closest('#profile-panel');
			if (!present || !section || !scroller || reduceMotion) return;
			for (const row of section.querySelectorAll<HTMLElement>('[data-service]')) {
				const title = row.querySelector('[data-service-title]');
				const image = row.querySelector('[data-service-image]');
				const offset = () =>
					-((image as HTMLElement).offsetWidth + parseFloat(getComputedStyle(row).columnGap));
				gsap.set(title, { x: offset, opacity: 0.4 });
				gsap.set(image, { scale: 0 });
				gsap.timeline({
					defaults: { duration: 0.5, ease: 'none' },
					scrollTrigger: {
						trigger: row,
						scroller,
						start: 'top 65%',
						end: 'bottom 55%',
						scrub: 0.5,
						invalidateOnRefresh: true,
					},
				})
					.to(title, { x: 0, opacity: 1 }, 0)
					.to(image, { scale: 1 }, 0)
					.to(title, { x: offset, opacity: 0.4 }, 0.5)
					.to(image, { scale: 0 }, 0.5);
			}
			gsap.fromTo(
				section.querySelectorAll('mark'),
				{ opacity: 0.4 },
				{
					opacity: 1,
					duration: 0.65,
					stagger: 0.18,
					ease: 'power2.out',
					scrollTrigger: {
						trigger: section.querySelector('[data-services-intro]'),
						scroller,
						start: 'top 85%',
						once: true,
					},
				}
			);
		},
		{ scope: sectionRef, dependencies: [present], revertOnUpdate: true },
		{ reduceMotion: '(prefers-reduced-motion: reduce)' }
	);

	// Render
	return (
		<section ref={sectionRef} className={s.jacket} data-services aria-label='Services'>
			<Grid columnsDesktop={8}>
				<Col l='1/4' className={s.heading}>
					<SpecialHeading text='Services' revealOnView />
				</Col>
				<Col l='4/9'>
					<p className={s.intro} data-type='bodyL' data-services-intro>
						{intro.map(({ text, highlight }, index) =>
							// biome-ignore lint/suspicious/noArrayIndexKey: segments are static, ordered text runs
							highlight ? <mark key={index}>{text}</mark> : text
						)}
					</p>
					<ul className={s.list}>
						{services.map(({ title, image }) => (
							<li key={title} className={s.service} data-service data-type='titleL'>
								<div className={s.image} data-service-image>
									{image && (
										<Image
											src={image}
											alt=''
											fill
											quality={90}
											sizes='(min-width: 1600px) 4.5vw, (min-width: 1024px) 72px, 51px'
										/>
									)}
								</div>
								<h3 className={s.title} data-service-title data-type='titleL'>
									{title}
								</h3>
							</li>
						))}
					</ul>
				</Col>
			</Grid>
		</section>
	);
};

// Exports
// ------------
Services.displayName = 'Services';
export default Services;
