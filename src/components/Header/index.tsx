'use client';

import ContactModal from '@parts/ContactModal';
import { GlobalContext } from '@parts/Contexts';
// Imports
// ------------
import Logo from '@parts/Logo';
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import Link from 'next/link';
import { use, useEffect, useRef, ViewTransition } from 'react';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const Header = ({ projects }: I.HeaderProps) => {
	// Context
	const { profileOpen, setProfileOpen, contactOpen, setContactOpen, pagePath: pathname } = use(GlobalContext);
	const isDarkPage = /^\/(cookies|terms-privacy|llms)\/?$/.test(pathname) || /^\/projects(?:\/|$)/.test(pathname);
	// State
	// Refs
	const ref = useRef<HTMLElement>(null);
	const entered = useRef(false);

	// Effects
	// biome-ignore lint/correctness/useExhaustiveDependencies: resync when navigation replaces the page scroller.
	useEffect(() => {
		const header = ref.current;
		if (!header) return;
		const update = (event?: Event) => {
			const target = event?.target;
			if (target instanceof Element && !target.closest('#page')) return;
			const scroller = document.querySelector('#page .lenis');
			const scroll = scroller ? scroller.scrollTop : window.scrollY;
			const progress = Math.max(0, Math.min(1, scroll / 96));
			header.style.setProperty('--header-blur-opacity', String(progress * progress * (3 - 2 * progress)));
		};
		update();
		// Capture native scroll from the nested Lenis wrapper as well as reduced-motion window scrolling.
		document.addEventListener('scroll', update, { capture: true, passive: true });
		return () => document.removeEventListener('scroll', update, true);
	}, [pathname]);

	// Animations
	useAnimation(
		({ reduced }) => {
			const header = ref.current;
			if (!header) return;
			if (reduced || entered.current || isLoaderSettled()) {
				gsap.set(header, { y: 0, autoAlpha: 1 });
				header.dataset.headerEntrance = 'complete';
				entered.current = true;
				return;
			}
			header.dataset.headerEntrance = 'waiting';
			const entrance = gsap.fromTo(
				header,
				{ y: -24, autoAlpha: 0 },
				{
					y: 0,
					autoAlpha: 1,
					duration: 0.7,
					ease: 'power3.out',
					paused: true,
					onStart: () => {
						header.dataset.headerEntrance = 'entering';
					},
					onComplete: () => {
						entered.current = true;
						header.dataset.headerEntrance = 'complete';
					},
				}
			);
			const reveal = () => {
				entrance.play();
			};
			window.addEventListener(LOADER_SETTLED, reveal);
			// Match the loader's fail-open limit if its initialization is interrupted.
			const fallback = window.setTimeout(reveal, 6000);
			return () => {
				window.removeEventListener(LOADER_SETTLED, reveal);
				window.clearTimeout(fallback);
			};
		},
		{ scope: ref },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	// Render
	return (
		<>
			<ViewTransition
				name='site-header'
				update={{ 'project-mesh': 'none', 'next-project': 'headerStill', default: 'none' }}
				default='none'
			>
				<header
					ref={ref}
					className={s.jacket}
					data-profile={profileOpen ? 'open' : 'closed'}
					data-tone={isDarkPage ? 'light' : 'dark'}
				>
					<div className={s.blur} aria-hidden='true' data-header-blur>
						<span />
						<span />
						<span />
						<span />
						<span />
						<span />
					</div>
					<nav className={s.left} aria-label='Homepage navigation'>
						<Link href='/' aria-label='Go to home page'>
							<Logo className={s.logo} />
						</Link>

						<div>
							<em data-type='captionS'>Available for hire</em>
							<span data-type='captionS'>Based in Doncaster, UK</span>
						</div>
					</nav>

					<nav className={s.right} aria-label='Page navigation'>
						<button
							type='button'
							aria-label='Open Profile'
							aria-haspopup='dialog'
							aria-expanded={profileOpen}
							aria-controls='profile-panel'
							onClick={() => setProfileOpen(true)}
							data-type='bodyS'
						>
							Profile
						</button>
						{/* NOTE • “Projects live” in Sanity's Global settings switches this. Until
						    then it points at Dribbble with a “Coming soon” label */}
						{projects.isLive ? (
							<Link
								href='/projects'
								aria-current={/^\/projects\/?$/.test(pathname) ? 'page' : undefined}
								className={s.projects}
								data-type='bodyS'
							>
								Projects
							</Link>
						) : (
							<a
								href={projects.comingSoonUrl}
								target='_blank'
								rel='noopener noreferrer'
								aria-label='Projects on Dribbble — projects page coming soon (opens in a new tab)'
								className={s.projects}
								data-type='bodyS'
							>
								Projects
								<span className={s.soon} data-type='captionS' aria-hidden='true'>
									Coming soon
								</span>
							</a>
						)}
						<button
							type='button'
							aria-label='Open Booking Form'
							aria-haspopup='dialog'
							aria-expanded={contactOpen}
							onClick={() => setContactOpen(true)}
							data-type='bodyS'
						>
							Let's Talk
						</button>
					</nav>
				</header>
			</ViewTransition>
			{contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
		</>
	);
};

// Exports
// ------------
Header.displayName = 'Header';
export default Header;
