'use client';

/**
 * CookieBar Component
 * ==================
 * A cookie consent manager: Accept All, Accept Necessary, or choose per
 * category. Nothing optional is pre-selected, and rejecting is one click,
 * just like accepting.
 *
 * - Gate scripts and embeds with <ConsentGate category='analytics'> or
 *   hasConsent('analytics') from './consent'
 * - Let visitors change their mind: call openCookieSettings() from a
 *   "Cookie settings" link (e.g. in the footer)
 * - Withdrawing a category clears readable cookies and reloads the page, so
 *   scripts that already ran are unloaded
 *
 * @component
 */

import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
// Imports
// ------------
import { cn } from '@utils/cn';
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { getConsent, noConsent, OPTIONAL_CATEGORIES, onOpenCookieSettings, saveConsent } from './consent';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Constants
// ------------
const CATEGORIES: Record<I.ConsentCategory, { label: string; description: string }> = {
	necessary: {
		label: 'Necessary',
		description: 'Required for the site to work properly. Always on.',
	},
	analytics: {
		label: 'Analytics',
		description: 'Helps me understand how visitors use the site.',
	},
	marketing: {
		label: 'Calendar',
		description: 'Allow the embedded Cal.com booking calendar.',
	},
};

// NOTE • Cookies to keep when a category is withdrawn — add your necessary
// first-party cookies here (httpOnly cookies are out of reach anyway)
const NECESSARY_COOKIES: string[] = [];

// Helpers
// ------------
const allConsent = (): I.Consent =>
	Object.fromEntries(OPTIONAL_CATEGORIES.map(category => [category, true])) as I.Consent;

const isWithdrawn = (previous: I.Consent | null, next: I.Consent): boolean =>
	OPTIONAL_CATEGORIES.some(category => previous?.[category] && !next[category]);

// NOTE • Best-effort — expires every readable cookie except the necessary
// ones, across the host and its parent-domain variant
const expireCookies = (): void => {
	const domains = ['', window.location.hostname, `.${window.location.hostname}`];

	for (const cookie of document.cookie.split(';')) {
		const name = cookie.split('=')[0]?.trim();
		if (!name || NECESSARY_COOKIES.includes(name)) continue;
		for (const domain of domains) {
			// biome-ignore lint/suspicious/noDocumentCookie: expiring a cookie is done by writing document.cookie directly
			document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${domain ? `;domain=${domain}` : ''}`;
		}
	}
};

// Component
// ------------
const CookieBar = ({
	title = 'Cookies',
	message = 'I use essential cookies to run this website and optional cookies for analytics and the booking calendar.',
	privacyHref = '/cookies',
	className,
}: I.CookieBarProps) => {
	// Refs
	const choicesRef = useRef<HTMLFieldSetElement>(null);
	const bannerRef = useRef<HTMLElement>(null);
	const enteredRef = useRef(false);

	// State
	// NOTE • Rendered on the server so the banner paints with the page; for
	// returning visitors the head script in app/(site)/layout.tsx has already
	// marked <html>, and CSS keeps it hidden until it's removed below
	const [isOpen, setIsOpen] = useState(true);
	const [isChoosing, setIsChoosing] = useState(false);
	const [isReopened, setIsReopened] = useState(false);
	const [choices, setChoices] = useState<I.Consent>(noConsent);

	// Derived
	const id = useId();
	const titleId = `${id}-title`;

	// Handlers
	const commit = (consent: I.Consent) => {
		const previous = getConsent();
		saveConsent(consent);
		setIsOpen(false);
		setIsChoosing(false);
		setIsReopened(false);

		// NOTE • Scripts that already ran can't be unloaded — clear what they
		// left behind and start the page fresh without them
		if (isWithdrawn(previous, consent)) {
			expireCookies();
			window.location.reload();
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		// NOTE • Only a reopened panel can be dismissed without choosing — a
		// first visit needs an answer
		if (event.key === 'Escape' && isReopened) {
			setIsOpen(false);
			setIsReopened(false);
		}
	};

	const toggleChoice = (category: I.OptionalCategory) => {
		setChoices(current => ({ ...current, [category]: !current[category] }));
	};

	// Effects
	// NOTE • Drop the server-rendered banner when a valid choice exists
	useEffect(() => {
		if (getConsent()) setIsOpen(false);
	}, []);

	// NOTE • openCookieSettings() reopens straight onto the preferences
	useEffect(
		() =>
			onOpenCookieSettings(() => {
				setChoices(getConsent() ?? noConsent());
				setIsChoosing(true);
				setIsReopened(true);
				setIsOpen(true);
			}),
		[]
	);

	// NOTE • "Let me choose" disappears once clicked, so hand focus to the
	// first choice rather than dropping it on <body>
	useEffect(() => {
		if (isChoosing) choicesRef.current?.querySelector<HTMLInputElement>('input:enabled')?.focus();
	}, [isChoosing]);

	// Animations
	useAnimation(
		({ reduced }) => {
			const banner = bannerRef.current;
			if (!banner || !isOpen) {
				enteredRef.current = false;
				return;
			}
			if (enteredRef.current) return;
			banner.dataset.entrance = 'waiting';
			banner.inert = true;
			gsap.set(banner, { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' });
			const complete = () => {
				enteredRef.current = true;
				banner.inert = false;
				banner.dataset.entrance = 'complete';
				if (isReopened) choicesRef.current?.querySelector<HTMLInputElement>('input:enabled')?.focus();
			};
			const entrance = gsap.timeline({ paused: true, onComplete: complete });
			entrance
				.set(banner, { autoAlpha: 1 })
				.to(banner, { clipPath: 'inset(0 0% 0 0)', duration: reduced ? 0 : 0.65, ease: 'power3.inOut' })
				.fromTo(
					banner.children,
					{ y: reduced ? 0 : 12, opacity: 0 },
					{ y: 0, opacity: 1, duration: reduced ? 0 : 0.45, stagger: reduced ? 0 : 0.06, ease: 'power3.out' },
					reduced ? 0 : 0.16
				);
			const reveal = () => {
				banner.dataset.entrance = 'entering';
				entrance.play();
			};
			if (isLoaderSettled()) reveal();
			else window.addEventListener(LOADER_SETTLED, reveal, { once: true });
			return () => {
				window.removeEventListener(LOADER_SETTLED, reveal);
				banner.inert = false;
			};
		},
		{ scope: bannerRef, dependencies: [isOpen, isReopened], revertOnUpdate: true },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	// Render
	if (!isOpen) return null;

	return (
		<section
			ref={bannerRef}
			className={cn(s.jacket, className)}
			aria-labelledby={titleId}
			data-reopened={isReopened || undefined}
			data-lenis-prevent
			onKeyDown={handleKeyDown}
		>
			<div className={s.introduction}>
				<h2 id={titleId} data-type='bodyS' className={s.title}>
					<Link href={privacyHref} prefetch={false}>
						<Image src='/images/cookies/link.svg' width={8} height={8} alt='' />
						{title}
					</Link>
				</h2>
				<p data-type='bodyS' className={s.message}>
					{message}
				</p>
				{!isChoosing && (
					<button data-type='captionS' type='button' className={s.link} onClick={() => setIsChoosing(true)}>
						Let me choose
					</button>
				)}
			</div>

			{isChoosing && (
				<fieldset ref={choicesRef} className={s.choices}>
					<legend className={s.legend}>Cookie preferences</legend>

					<label className={s.choice}>
						<input type='checkbox' checked disabled />
						<span data-type='captionS' className={s.label}>
							{CATEGORIES.necessary.label}
						</span>
						<span data-type='captionS' className={s.description}>
							{CATEGORIES.necessary.description}
						</span>
					</label>

					{OPTIONAL_CATEGORIES.map(category => (
						<label key={category} className={s.choice}>
							<input
								type='checkbox'
								checked={choices[category]}
								onChange={() => toggleChoice(category)}
							/>
							<span data-type='captionS' className={s.label}>
								{CATEGORIES[category].label}
							</span>
							<span data-type='captionS' className={s.description}>
								{CATEGORIES[category].description}
							</span>
						</label>
					))}
				</fieldset>
			)}

			<div className={s.actions}>
				<button data-type='bodyS' type='button' onClick={() => commit(allConsent())}>
					Accept All
				</button>

				{isChoosing ? (
					<button data-type='bodyS' type='button' onClick={() => commit(choices)}>
						Save Choices
					</button>
				) : (
					<button data-type='bodyS' type='button' onClick={() => commit(noConsent())}>
						Accept Necessary
					</button>
				)}
			</div>
		</section>
	);
};

// Exports
// ------------
CookieBar.displayName = 'CookieBar';
export default CookieBar;
