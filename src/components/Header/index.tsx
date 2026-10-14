'use client';

import ContactModal from '@parts/ContactModal';
// Imports
// ------------
import Logo from '@parts/Logo';
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import Link from 'next/link';
import { useRef, useState } from 'react';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const Header = (_props: I.HeaderProps) => {
	// State
	const [contactOpen, setContactOpen] = useState(false);
	// Refs
	const ref = useRef<HTMLElement>(null);
	const entered = useRef(false);

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
			<header ref={ref} className={s.jacket}>
				<nav className={s.left} aria-label='Homepage navigation'>
					<Link href='/' aria-label='Go to home page'>
						<Logo />
					</Link>

					<div>
						<em data-type='captionS'>Available for hire</em>
						<span data-type='captionS'>Based in Doncaster, UK</span>
					</div>
				</nav>

				<nav className={s.right} aria-label='Page navigation'>
					<button type='button' aria-label='Open Profile' data-type='bodyS'>
						Profile
					</button>
					<Link href='/projects' aria-label='Go to Projects page' data-type='bodyS'>
						Projects
					</Link>
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
			{contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
		</>
	);
};

// Exports
// ------------
Header.displayName = 'Header';
export default Header;
