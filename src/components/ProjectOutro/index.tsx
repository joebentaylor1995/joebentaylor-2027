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
// NOTE • The project modal's ending — it invites a conversation instead of the next case study
// NOTE • Two lines, as on the profile's call to action
const CONTACT_LINES = ['Ready?', 'Let’s grow.'];
const CONTACT_MATRIX = 'Let’s grow';

// NOTE • Matches ProjectExperience: the call to action fills over the last
// 35% of a screen before the outro's bottom reaches the bottom of the view
const OUTRO_FILL_RANGE = 0.35;

const ProjectOutro = ({ review, nextProject, cta = 'next' }: ProjectOutroProps) => {
	const { lenisRef, setContactOpen } = use(GlobalContext);
	const isContact = cta === 'contact';
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

	// NOTE • In the project modal nothing scrubs the page, so the outro fills
	// from the panel's own scroll — ProjectExperience drives it everywhere else
	useEffect(() => {
		const root = ref.current;
		const panel = root?.closest<HTMLElement>('#profile-panel');
		if (!root || !panel) return;
		const update = () => {
			const distance = root.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
			const progress = Math.min(1, Math.max(0, 1 - distance / (panel.clientHeight * OUTRO_FILL_RANGE)));
			root.style.setProperty('--project-outro-progress', String(progress));
		};
		// NOTE • Re-measures when the panel's content first appears (it mounts hidden) or reflows
		const resize = new ResizeObserver(update);
		resize.observe(root);
		resize.observe(panel);
		panel.addEventListener('scroll', update, { passive: true });
		return () => {
			resize.disconnect();
			panel.removeEventListener('scroll', update);
			root.style.removeProperty('--project-outro-progress');
		};
	}, []);

	// Animations
	useAnimation(
		({ reduced }) => {
			const root = ref.current;
			const portrait = root?.querySelector('[data-outro-portrait]');
			const next = root?.querySelector<HTMLElement>('[data-next-project], [data-contact-cta]');
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
		<section
			ref={ref}
			className={s.jacket}
			aria-label={isContact ? 'Project review and contact' : 'Project review and next project'}
			data-project-outro
			data-cta={cta}
		>
			{isContact ? <Matrix title={CONTACT_MATRIX} /> : nextProject && <Matrix title={nextProject.title} />}
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
				{isContact ? (
					<button
						type='button'
						className={s.next}
						data-type='displayL'
						onClick={() => setContactOpen(true)}
						data-contact-cta
					>
						{CONTACT_LINES.map(line => (
							<span key={line} className={s.wave} data-line>
								{line}
							</span>
						))}
					</button>
				) : nextProject ? (
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
