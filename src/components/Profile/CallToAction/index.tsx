'use client';

// Imports
// ------------
import ContactModal from '@parts/ContactModal';
import { ContactContext } from '@parts/Contexts';
import { introDefaults } from '@parts/Hero/Background/scene-intro';
import { HERO_DESKTOP_QUERY } from '@parts/Hero/layout';
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import SpecialHeading from '@parts/SpecialHeading';
import { canHover } from '@utils/desktopHover';
import { prepareScene } from '@utils/prepareScene';
import { useAnimation } from '@utils/useAnimation';
import gsap from 'gsap';
import Image from 'next/image';
import { use, useEffect, useRef, useState } from 'react';
import type { ContactDetails } from '@/data/site';

// Styles + Interfaces
// ------------
import type { MatrixScene } from './interface';
import s from './styles.module.scss';

// NOTE • Link targets come from Sanity's Global settings (ContactContext);
// the icon artwork is fixed, so only platforms with an icon are shown
const ICONS = {
	linkedin: { label: 'Linkedin', width: 24, height: 24 },
	dribbble: { label: 'Dribbble', width: 24, height: 24 },
	github: { label: 'Github', width: 24.15, height: 23.4298 },
	resume: { label: 'Resume', width: 24, height: 24 },
	email: { label: 'Email', width: 23.1626, height: 24.0033 },
} as const;

type IconName = keyof typeof ICONS;

const RESUME_FILENAME = 'Joe Ben Taylor Resume.pdf';

// Range of the title lines' --tfw-fill and --hover-fill
const TITLE_FILL_START = -16;
const TITLE_FILL_END = 111;

// Scroll-in title fill and hover sweep (seconds)
const TITLE_FILL_DURATION = 1.1;
const TITLE_FILL_STAGGER = 0.25;
const HOVER_FILL_DURATION = 0.8;
const HOVER_FILL_STAGGER = 0.12;

// Copyright timeline start times and digit rise (seconds, %)
const RULES_START = 0.12;
const DIGITS_START = 0.3;
const DIGIT_DURATION = 0.5;
const DIGIT_RISE_PERCENT = 110;

// Digits on the left of the ©, which the wave radiates out from
const DIGITS_BEFORE_ICON = 4;

// Share of an element in view before its timeline plays
const REVEAL_THRESHOLD = 0.2;

// Scroll distance (px) from the panel's end over which --connect-bottom-progress runs
const BOTTOM_PROGRESS_DISTANCE = 160;

const CLOCK_REFRESH_MS = 30_000;

// Narrows a platform string to one that has icon artwork
const hasIcon = (platform: string): platform is IconName => platform in ICONS;

// Social links with an icon, then the resume download, then email, each merged with its icon size and label
const toLinks = ({ socials, resumeUrl, email }: ContactDetails) =>
	[
		...socials
			.filter(({ platform }) => hasIcon(platform))
			.map(({ platform, url }) => ({ icon: platform, href: url })),
		// NOTE • Sanity's CDN serves ?dl= as a download — the download attribute
		// is ignored cross-origin
		...(resumeUrl
			? [
					{
						icon: 'resume',
						href: resumeUrl.startsWith('https:') ? `${resumeUrl}?dl=${RESUME_FILENAME}` : resumeUrl,
					},
				]
			: []),
		{ icon: 'email', href: `mailto:${email}` },
	].map(link => ({ ...link, ...ICONS[link.icon as IconName], icon: link.icon as IconName }));

// Component
// ------------
// Closing 'Connect' section of the profile: a lazy-loaded blue digital-rain portrait behind the contact
// links, the "Ready? Let's grow." button that opens the contact modal, and the animated copyright years.
const CallToAction = () => {
	// Context
	const present = use(ProfilePresenceContext);
	const links = toLinks(use(ContactContext));

	// Refs
	const sectionRef = useRef<HTMLElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// State
	const [time, setTime] = useState('');
	const [year, setYear] = useState('2026');
	const [contactOpen, setContactOpen] = useState(false);

	// Animations
	// Title lines fill in and the copyright years roll in when each scrolls into view;
	// the title also fills on hover/focus. Reduced motion shows the filled title straight away.
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
				gsap.set(lines, { '--tfw-fill': TITLE_FILL_END });
				return;
			}

			// Scroll-in: both timelines start paused and are played by the observer below
			const fill = gsap.fromTo(
				lines,
				{ '--tfw-fill': TITLE_FILL_START },
				{
					'--tfw-fill': TITLE_FILL_END,
					duration: TITLE_FILL_DURATION,
					stagger: TITLE_FILL_STAGGER,
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
					RULES_START
				);

			// Digits rise in a wave radiating outwards from the © (the digits next to it go first)
			digits.forEach((digit, index) => {
				years.fromTo(
					digit,
					{ yPercent: DIGIT_RISE_PERCENT },
					{ yPercent: 0, duration: DIGIT_DURATION, ease: 'power3.out' },
					DIGITS_START +
						(index < DIGITS_BEFORE_ICON ? DIGITS_BEFORE_ICON - 1 - index : index - DIGITS_BEFORE_ICON) *
							introDefaults.copyrightDigitStagger
				);
			});

			// Play each timeline once, the first time its element is in view in the profile panel
			const observer = new IntersectionObserver(
				entries => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						(entry.target === title ? fill : years).play();
						observer.unobserve(entry.target);
					}
				},
				{ root: section.closest('#profile-panel'), threshold: REVEAL_THRESHOLD }
			);
			observer.observe(title);
			observer.observe(copyright);

			// Hover: a second fill sweeps over the title lines (mouse and keyboard focus only, not touch)
			const hoverWave = gsap.to(lines, {
				'--hover-fill': TITLE_FILL_END,
				duration: HOVER_FILL_DURATION,
				stagger: HOVER_FILL_STAGGER,
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

			// NOTE • Only the listeners and observer need manual cleanup; the context reverts the tweens
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
	// Exposes how close the panel is to its bottom (0..1 over the last 160px) as --connect-bottom-progress.
	// NOTE • Why: only the heroDesktop layout reads the variable (styles.module.scss), yet every
	// panel scroll event measured the panel and rewrote it, on every device. It is now measured
	// only while that layout applies, and written only when it changes.
	useEffect(() => {
		const section = sectionRef.current;
		const panel = section?.closest<HTMLElement>('#profile-panel');
		if (!present || !section || !panel) return;

		const layout = window.matchMedia(HERO_DESKTOP_QUERY);
		let written = '';

		const update = () => {
			const remaining = panel.scrollHeight - panel.clientHeight - panel.scrollTop;
			const progress = String(Math.max(0, Math.min(1, 1 - remaining / BOTTOM_PROGRESS_DISTANCE)));
			if (progress === written) return;
			written = progress;
			section.style.setProperty('--connect-bottom-progress', progress);
		};

		const observer = new ResizeObserver(update);
		const sync = () => {
			panel.removeEventListener('scroll', update);
			observer.disconnect();
			if (!layout.matches) return;
			update();
			panel.addEventListener('scroll', update, { passive: true });
			observer.observe(panel);
			observer.observe(section);
		};

		sync();
		layout.addEventListener('change', sync);

		return () => {
			layout.removeEventListener('change', sync);
			panel.removeEventListener('scroll', update);
			observer.disconnect();
			section.style.removeProperty('--connect-bottom-progress');
		};
	}, [present]);

	// London time and year, refreshed periodically
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
		const timer = setInterval(update, CLOCK_REFRESH_MS);
		return () => clearInterval(timer);
	}, [present]);

	// Lazy-loads the WebGL portrait engine once the section is prepared, and only renders while on screen
	useEffect(() => {
		const section = sectionRef.current,
			canvas = canvasRef.current;
		if (!present || !section || !canvas) return;

		let disposed = false,
			loading = false,
			visible = false;
		let scene: MatrixScene | undefined;

		// NOTE • Freeze on the last frame unless the profile is fully open: rendering under the
		// panel's clip-path wipe drops frames on phones, and a closed panel stays mounted for a
		// moment (see ProfileReveal's kept presence) with nothing of it on screen
		const reveal = section.closest('#profile-panel')?.parentElement;
		const shut = () => Boolean(reveal) && reveal?.dataset.state !== 'open';
		const sync = () => scene?.setVisible(visible && !shut());

		// Import the engine once; a failed import switches the section to its static fallback
		const load = () => {
			if (loading || disposed) return Promise.resolve();
			loading = true;
			return import('./engine')
				.then(({ createMatrix }) => {
					if (disposed) return;
					scene = createMatrix(canvas, section);
					sync();
					// The queue waits for the GL setup, so the next scene isn't built alongside it
					return scene.prepared;
				})
				.catch(() => {
					if (!disposed) section.dataset.state = 'fallback';
				});
		};

		// 'matrixrestore' rebuilds the scene from scratch (dispatched on the section by other code)
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
				sync();
			},
			{ root: section.closest('#profile-panel'), threshold: 0 }
		);
		observer.observe(section);

		const states = new MutationObserver(sync);
		if (reveal) states.observe(reveal, { attributes: true, attributeFilter: ['data-state'] });

		return () => {
			disposed = true;
			stopPreparing();
			observer.disconnect();
			states.disconnect();
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
								download={link.icon === 'resume' ? RESUME_FILENAME : undefined}
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
