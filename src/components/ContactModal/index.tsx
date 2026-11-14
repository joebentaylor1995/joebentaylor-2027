'use client';

// Imports
// ------------
import ConsentGate from '@parts/ConsentGate';
import { ContactContext, GlobalContext } from '@parts/Contexts';
import { getConsent, noConsent, saveConsent } from '@parts/CookieBar/consent';
import { canHover } from '@utils/desktopHover';
import Image from 'next/image';
import type { PointerEvent } from 'react';
import { lazy, Suspense, use, useEffect, useRef, useState } from 'react';
import { bookingUrl } from './config';
// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Config
// ------------
const Calendar = lazy(() => import('./Calendar'));
const CLOSE_MAGNET_STRENGTH = 0.22;
const CLOSE_MAGNET_LIMIT = 5;

// Helpers
// ------------
// Created on first use, then reused: its `matches` stays live, so there's no need for a
// new MediaQueryList on every pointermove
let reducedMotionQuery: MediaQueryList | undefined;
const prefersReducedMotion = () => {
	reducedMotionQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)');
	return reducedMotionQuery.matches;
};

// Component
// ------------
const ContactModal = ({ onClose }: I.ContactModalProps) => {
	// Context
	const { lenisRef } = use(GlobalContext);
	const { bookingLink } = use(ContactContext);

	// Refs
	const dialogRef = useRef<HTMLDialogElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	// The close button's box while the pointer is over it (null until measured)
	const closeBoundsRef = useRef<DOMRect | null>(null);

	// State
	const [isClosing, setIsClosing] = useState(false);

	// Effects
	useEffect(() => {
		const dialog = dialogRef.current;
		const previousFocus = document.activeElement;
		const page = document.getElementById('page');
		const overflow = page?.style.overflow;
		const lenis = lenisRef.current?.lenis;
		const wasStopped = lenis?.isStopped;
		const scrollRoot = lenis?.rootElement;
		const scrollOverflow = scrollRoot?.style.overflow ?? '';
		// NOTE • Lenis' stopped class sets overflow: clip, which stops the wrapper being a scroll
		// container: the page behind jumped to the top as the backdrop faded in (and back once it
		// faded out), and the scroller was torn down and rebuilt. Inline 'auto' (the wrapper's own
		// value) keeps the container, its position and its composited scrolling, as ProfileReveal
		// does; the page still can't scroll behind the modal dialog, which makes it inert, and
		// Lenis is stopped. When the page Lenis is already stopped (opened over the profile), its
		// owner has done this already.
		if (scrollRoot && !wasStopped) scrollRoot.style.overflow = 'auto';
		dialog?.showModal();
		lenis?.stop();
		if (page) page.style.overflow = 'hidden';
		return () => {
			dialog?.close();
			if (page) page.style.overflow = overflow ?? '';
			if (lenis && !wasStopped) lenis.start();
			if (scrollRoot && !wasStopped) scrollRoot.style.overflow = scrollOverflow;
			if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
		};
	}, [lenisRef]);

	// NOTE • The close button is fixed, so its box only moves when the viewport changes
	useEffect(() => {
		const forgetCloseBounds = () => {
			closeBoundsRef.current = null;
		};
		window.addEventListener('resize', forgetCloseBounds);
		return () => window.removeEventListener('resize', forgetCloseBounds);
	}, []);

	useEffect(() => {
		if (!isClosing) return;
		let cancelled = false;
		// Wait for the actual CSS fade, including an interrupted entrance.
		// Reduced motion has no animations, so it closes immediately.
		const animations = dialogRef.current?.getAnimations() ?? [];
		void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
			if (!cancelled) onClose();
		});
		return () => {
			cancelled = true;
		};
	}, [isClosing, onClose]);

	// Handlers
	const allowCalendar = () => saveConsent({ ...(getConsent() ?? noConsent()), marketing: true });
	const close = () => setIsClosing(true);
	const resetCloseMagnet = () => {
		closeBoundsRef.current = null;
		closeButtonRef.current?.style.removeProperty('--magnetic-x');
		closeButtonRef.current?.style.removeProperty('--magnetic-y');
	};
	const moveCloseMagnet = (event: PointerEvent<HTMLButtonElement>) => {
		if (!canHover() || event.pointerType !== 'mouse' || prefersReducedMotion()) return;
		const button = event.currentTarget;
		// NOTE • Measured once per hover: the previous move's --magnetic-* writes left style
		// dirty, so reading the box on every move forced a style recalc. The magnet moves the
		// icon inside, never the button itself, so the box is the same every time.
		closeBoundsRef.current ??= button.getBoundingClientRect();
		const bounds = closeBoundsRef.current;
		const pull = (distance: number) =>
			Math.max(-CLOSE_MAGNET_LIMIT, Math.min(CLOSE_MAGNET_LIMIT, distance * CLOSE_MAGNET_STRENGTH));
		button.style.setProperty('--magnetic-x', `${pull(event.clientX - bounds.left - bounds.width / 2)}px`);
		button.style.setProperty('--magnetic-y', `${pull(event.clientY - bounds.top - bounds.height / 2)}px`);
	};

	// Render
	return (
		<dialog
			ref={dialogRef}
			className={s.jacket}
			aria-label='Book a call with Joe Ben Taylor'
			data-state={isClosing ? 'closing' : 'open'}
			onCancel={event => {
				event.preventDefault();
				close();
			}}
			data-lenis-prevent
		>
			<button
				ref={closeButtonRef}
				type='button'
				className={s.closeButton}
				onClick={close}
				onPointerMove={moveCloseMagnet}
				onPointerLeave={resetCloseMagnet}
				onPointerCancel={resetCloseMagnet}
				onBlur={resetCloseMagnet}
				disabled={isClosing}
				aria-label='Close booking form'
			>
				<span className={s.closeIcon} aria-hidden='true'>
					<Image src='/icons/contact-close.svg' width={15} height={15} alt='' />
				</span>
			</button>
			<div className={s.content} inert={isClosing}>
				<ConsentGate
					category='marketing'
					fallback={
						<section className={s.permission}>
							<h2 data-type='titleS'>Let’s talk.</h2>
							<p data-type='bodyM'>Book a 30-minute call to talk about your next project.</p>
							<p data-type='bodyS'>
								The calendar is provided by Cal.com. Allow calendar cookies to load it here, or book
								directly on Cal.com.
							</p>
							<button data-type='bodyS' type='button' className={s.allowButton} onClick={allowCalendar}>
								Allow cookies and load calendar
							</button>
							<a
								data-type='bodyS'
								href={bookingUrl(bookingLink)}
								target='_blank'
								rel='noopener noreferrer'
							>
								Book on Cal.com ↗
							</a>
						</section>
					}
				>
					<Suspense
						fallback={
							<p data-type='bodyM' className={s.loading} role='status'>
								Loading calendar…
							</p>
						}
					>
						<Calendar />
					</Suspense>
				</ConsentGate>
			</div>
		</dialog>
	);
};

// Exports
// ------------
ContactModal.displayName = 'ContactModal';
export default ContactModal;
