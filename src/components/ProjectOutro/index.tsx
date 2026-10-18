'use client';

import { GlobalContext } from '@parts/Contexts';
// Imports
// ------------
import PageTitleReveal from '@parts/PageTitleReveal';
import { mq } from '@tackl';
import { navigateNextProject } from '@utils/projectHandoff';
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useRef } from 'react';
// Styles + Interfaces
// ------------
import type { ProjectOutroProps } from './interface';
import Matrix from './Matrix';
import s from './styles.module.scss';

// Component
// ------------
const ProjectOutro = ({ review, nextProject }: ProjectOutroProps) => {
	const { lenisRef } = use(GlobalContext);
	const router = useRouter();
	// Refs
	const ref = useRef<HTMLElement>(null);

	// Effects
	useEffect(() => {
		const root = ref.current;
		if (!root) return;
		const credit = review ? root.querySelector('figcaption') : null;
		const measure = () => {
			const top = credit ? credit.getBoundingClientRect().bottom - root.getBoundingClientRect().top : 0;
			root.style.setProperty('--outro-gradient-top', `${top}px`);
		};
		const observer = new ResizeObserver(measure);
		observer.observe(root);
		if (credit) observer.observe(credit);
		const reviewElement = root.querySelector('figure');
		if (reviewElement) observer.observe(reviewElement);
		measure();
		return () => observer.disconnect();
	}, [review]);

	// Animations
	useAnimation(
		({ reduced }) => {
			const root = ref.current;
			const portrait = root?.querySelector('[data-outro-portrait]');
			const next = root?.querySelector<HTMLElement>('[data-next-project]');
			if (!root || !portrait || !next || reduced) return;
			const reveal = gsap.fromTo(
				portrait,
				{ scale: 0 },
				{ scale: 1, duration: 0.8, ease: 'power3.out', paused: true }
			);
			const observer = new IntersectionObserver(
				([entry]) => {
					if (!entry.isIntersecting || entry.intersectionRatio < 0.3) return;
					reveal.play();
					observer.disconnect();
				},
				{ threshold: 0.3 }
			);
			// Observe the untransformed wrapper so scale zero can still enter view.
			observer.observe(portrait.parentElement as HTMLElement);
			const hover = gsap.to(next, { '--hover-fill': 111, duration: 0.8, ease: 'power2.inOut', paused: true });
			const enter = () => {
				if (matchMedia(`${mq.up.l} and (hover: hover) and (pointer: fine)`).matches) hover.play();
			};
			const leave = () => {
				hover.reverse();
			};
			next.addEventListener('pointerenter', enter);
			next.addEventListener('pointerleave', leave);
			next.addEventListener('focus', enter);
			next.addEventListener('blur', leave);
			return () => {
				observer.disconnect();
				next.removeEventListener('pointerenter', enter);
				next.removeEventListener('pointerleave', leave);
				next.removeEventListener('focus', enter);
				next.removeEventListener('blur', leave);
			};
		},
		{ scope: ref },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	// Render
	return (
		<section ref={ref} className={s.jacket} aria-label='Project review and next project' data-project-outro>
			{nextProject && <Matrix title={nextProject.title ?? 'Next Project'} />}
			{review && (
				<figure className={s.review}>
					<div className={s.portraitSlot}>
						<div className={s.portrait} data-outro-portrait>
							<Image
								className={s.portraitImage}
								src={review.image}
								alt={review.author}
								fill
								sizes='64px'
							/>
						</div>
					</div>
					<blockquote className={s.quote} data-type='bodyL'>
						<p>
							<PageTitleReveal variant='words' trigger='view' replay>
								{review.quote}
							</PageTitleReveal>
						</p>
					</blockquote>
					<figcaption data-type='bodyM'>
						<p>
							<PageTitleReveal variant='wave' trigger='view' transparentStart>
								{review.author}
							</PageTitleReveal>
						</p>
						<p className={s.role}>
							<PageTitleReveal variant='wave' trigger='view' transparentStart>
								{review.role}
							</PageTitleReveal>
						</p>
					</figcaption>
				</figure>
			)}
			<div className={s.nextArea} data-next-project-area>
				{nextProject ? (
					<Link
						className={s.next}
						data-type='displayL'
						href={nextProject.href}
						prefetch={true}
						transitionTypes={['next-project']}
						onNavigate={event => {
							event.preventDefault();
							void navigateNextProject(
								nextProject.href,
								() => router.push(nextProject.href, { transitionTypes: ['next-project'] }),
								lenisRef.current?.lenis
							);
						}}
						data-next-project
					>
						<span className={s.wave}>Next Project</span>
					</Link>
				) : (
					<span className={s.next} data-type='displayL' data-disabled='true' data-next-project>
						<span className={s.wave}>Next Project</span>
					</span>
				)}
			</div>
		</section>
	);
};

// Exports
// ------------
ProjectOutro.displayName = 'ProjectOutro';
export default ProjectOutro;
