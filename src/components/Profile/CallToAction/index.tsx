'use client';

import ContactModal from '@parts/ContactModal';
import { introDefaults } from '@parts/Hero/Background/scene-intro';
// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import SpecialHeading from '@parts/SpecialHeading';
import { canHover } from '@utils/desktopHover';
import { prepareScene } from '@utils/prepareScene';
import { useAnimation } from '@utils/useAnimation';
import gsap from 'gsap';
import Image from 'next/image';
import { use, useEffect, useRef, useState } from 'react';

// Styles + Interfaces
// ------------
import type { MatrixScene } from './interface';
import s from './styles.module.scss';

const links = [
	{ label: 'Linkedin', href: 'https://www.linkedin.com/in/joebentaylor/', icon: 'linkedin', width: 24, height: 24 },
	{ label: 'Dribbble', href: 'https://dribbble.com/joebentaylor', icon: 'dribbble', width: 24, height: 24 },
	{ label: 'Github', href: 'https://github.com/joebentaylor1995', icon: 'github', width: 24.15, height: 23.4298 },
	{ label: 'Resume', href: '/downloads/joe-ben-taylor-resume.pdf', icon: 'resume', width: 24, height: 24 },
	{ label: 'Email', href: 'mailto:hey@joebentaylor.co.uk', icon: 'email', width: 23.1626, height: 24.0033 },
];

// Component
// ------------
const CallToAction = () => {
	// Context
	const present = use(ProfilePresenceContext);
	// Refs
	const sectionRef = useRef<HTMLElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// State
	const [time, setTime] = useState('');
	const [year, setYear] = useState('2026');
	const [contactOpen, setContactOpen] = useState(false);
	// Animations
	useAnimation(
		({ reduced }) => {
			const section = sectionRef.current;
			if (!section || !present) return;
			const title = section.querySelector<HTMLElement>('[data-connect-title]');
			const copyright = section.querySelector<HTMLElement>('[data-connect-copyright]');
			if (!title || !copyright) return;
			const lines = title.querySelectorAll('[data-connect-line]');
			const digits = copyright.querySelectorAll('[data-year-digit]');
			const rules = copyright.querySelectorAll('[data-year-rule]');
			const icon = copyright.querySelector('[data-year-icon]');
			if (reduced) {
				gsap.set(lines, { '--tfw-fill': 111 });
				return;
			}
			const fill = gsap.fromTo(
				lines,
				{ '--tfw-fill': -16 },
				{
					'--tfw-fill': 111,
					duration: 1.1,
					stagger: 0.25,
					ease: 'expo.out',
					paused: true,
				}
			);
			const years = gsap.timeline({ paused: true });
			years
				.fromTo(
					icon,
					{ opacity: 0 },
					{ opacity: 1, duration: introDefaults.copyrightFade, ease: 'sine.out' },
					0
				)
				.fromTo(
					rules,
					{ scaleX: 0, transformOrigin: i => (i === 0 ? 'right center' : 'left center') },
					{ scaleX: 1, duration: introDefaults.copyrightLineDuration, ease: 'power3.inOut' },
					0.12
				);
			digits.forEach((digit, index) => {
				years.fromTo(
					digit,
					{ yPercent: 110 },
					{ yPercent: 0, duration: 0.5, ease: 'power3.out' },
					0.3 + (index < 4 ? 3 - index : index - 4) * introDefaults.copyrightDigitStagger
				);
			});
			const observer = new IntersectionObserver(
				entries => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						(entry.target === title ? fill : years).play();
						observer.unobserve(entry.target);
					}
				},
				{ root: section.closest('#profile-panel'), threshold: 0.2 }
			);
			observer.observe(title);
			observer.observe(copyright);
			const hoverWave = gsap.to(lines, {
				'--hover-fill': 111,
				duration: 0.8,
				stagger: 0.12,
				ease: 'power2.inOut',
				paused: true,
			});
			const enter = (event: Event) => {
				if (event instanceof PointerEvent && (!canHover() || event.pointerType !== 'mouse')) return;
				if (event.type === 'focus' && !title.matches(':focus-visible')) return;
				hoverWave.play();
			};
			const leave = () => {
				if (!title.matches(':hover, :focus-visible')) hoverWave.reverse();
			};
			title.addEventListener('pointerenter', enter);
			title.addEventListener('focus', enter);
			title.addEventListener('pointerleave', leave);
			title.addEventListener('blur', leave);
			return () => {
				observer.disconnect();
				title.removeEventListener('pointerenter', enter);
				title.removeEventListener('focus', enter);
				title.removeEventListener('pointerleave', leave);
				title.removeEventListener('blur', leave);
			};
		},
		{ scope: sectionRef, dependencies: [present], revertOnUpdate: true },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);
	// Effects
	useEffect(() => {
		const section = sectionRef.current;
		const panel = section?.closest<HTMLElement>('#profile-panel');
		if (!present || !section || !panel) return;
		const update = () => {
			const remaining = panel.scrollHeight - panel.clientHeight - panel.scrollTop;
			const progress = Math.max(0, Math.min(1, 1 - remaining / 160));
			section.style.setProperty('--connect-bottom-progress', String(progress));
		};
		update();
		panel.addEventListener('scroll', update, { passive: true });
		const observer = new ResizeObserver(update);
		observer.observe(panel);
		observer.observe(section);
		return () => {
			panel.removeEventListener('scroll', update);
			observer.disconnect();
			section.style.removeProperty('--connect-bottom-progress');
		};
	}, [present]);
	useEffect(() => {
		if (!present) return;
		const update = () => {
			const now = new Date();
			setTime(
				new Intl.DateTimeFormat('en-GB', {
					timeZone: 'Europe/London',
					hour: '2-digit',
					minute: '2-digit',
				}).format(now)
			);
			setYear(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric' }).format(now));
		};
		update();
		const timer = setInterval(update, 30_000);
		return () => clearInterval(timer);
	}, [present]);
	useEffect(() => {
		const section = sectionRef.current,
			canvas = canvasRef.current;
		if (!present || !section || !canvas) return;
		let disposed = false,
			loading = false,
			visible = false;
		let scene: MatrixScene | undefined;
		const load = () => {
			if (loading || disposed) return Promise.resolve();
			loading = true;
			return import('./engine')
				.then(({ createMatrix }) => {
					if (disposed) return;
					scene = createMatrix(canvas, section);
					scene.setVisible(visible);
				})
				.catch(() => {
					if (!disposed) section.dataset.state = 'fallback';
				});
		};
		const restore = () => {
			scene?.destroy();
			scene = undefined;
			loading = false;
			load();
		};
		section.addEventListener('matrixrestore', restore);
		const stopPreparing = prepareScene(section, load);
		const observer = new IntersectionObserver(
			([entry]) => {
				visible = entry.isIntersecting;
				scene?.setVisible(visible);
			},
			{ root: section.closest('#profile-panel'), threshold: 0 }
		);
		observer.observe(section);
		return () => {
			disposed = true;
			stopPreparing();
			observer.disconnect();
			scene?.destroy();
			section.removeEventListener('matrixrestore', restore);
			section.dataset.state = 'loading';
		};
	}, [present]);

	// Render
	return (
		<section ref={sectionRef} className={s.jacket} data-connect data-state='loading' aria-label='Connect'>
			<canvas
				ref={canvasRef}
				className={s.canvas}
				role='img'
				aria-label='A portrait formed from blue digital rain'
			/>
			<div className={s.top}>
				<SpecialHeading text='Connect' revealOnView />
				<div className={s.details}>
					<div className={s.location} data-type='bodyL'>
						<p>Doncaster</p>
						<div className={s.locationMeta}>
							<p>United Kingdom</p>
							<time title='Current time in Doncaster'>{time || '—'}</time>
						</div>
					</div>
					<nav className={s.links} aria-label='Connect with Joe'>
						{links.map(link => (
							<a
								key={link.icon}
								data-cursor-sticky
								href={link.href}
								data-type='bodyL'
								download={link.icon === 'resume' ? 'Joe Ben Taylor Resume.pdf' : undefined}
								target={link.href.startsWith('https:') ? '_blank' : undefined}
								rel={link.href.startsWith('https:') ? 'noopener noreferrer' : undefined}
							>
								{link.label}
								<span className={s.icon} data-icon={link.icon} data-cursor-anchor>
									<Image
										src={`/images/connect/${link.icon}.svg`}
										width={link.width}
										height={link.height}
										alt=''
									/>
								</span>
							</a>
						))}
					</nav>
				</div>
			</div>
			<div className={s.bottom}>
				<div className={s.outro}>
					<button
						className={s.cta}
						type='button'
						data-type='displayL'
						data-connect-title
						data-cursor-cta
						aria-haspopup='dialog'
						aria-expanded={contactOpen}
						onClick={() => setContactOpen(true)}
					>
						<span className={s.titleLine} data-connect-line>
							Ready?
						</span>
						<span className={s.titleLine} data-connect-line>
							Let’s grow.
						</span>
					</button>
					<div className={s.smallPrint} data-type='bodyS'>
						<p>Proof that everyone scrolls</p>
						<div className={s.legal}>
							<a href='/cookies' data-cursor-soft>
								Cookies
							</a>
							<a href='/terms-privacy' data-cursor-soft>
								Terms &amp; Privacy
							</a>
							<a href='/llms' data-cursor-soft>
								LLMs
							</a>
						</div>
					</div>
				</div>
				<div className={s.timeline} data-type='bodyS' data-connect-copyright>
					<span>
						<span className={s.yearText}>1995</span>
						{Array.from('1995'.matchAll(/\d/g), match => (
							<span className={s.digitClip} key={match.index} aria-hidden='true'>
								<span data-year-digit>{match[0]}</span>
							</span>
						))}
					</span>
					<span className={s.rule} data-year-rule />
					<span data-year-icon>©</span>
					<span className={s.rule} data-year-rule />
					<span>
						<span className={s.yearText}>{year}</span>
						{Array.from(year.matchAll(/\d/g), match => (
							<span className={s.digitClip} key={match.index} aria-hidden='true'>
								<span data-year-digit>{match[0]}</span>
							</span>
						))}
					</span>
				</div>
			</div>
			{contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
		</section>
	);
};

// Exports
// ------------
CallToAction.displayName = 'CallToAction';
export default CallToAction;
