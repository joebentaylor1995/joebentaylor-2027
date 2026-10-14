'use client';

// Imports
// ------------
import ConsentGate from '@parts/ConsentGate';
import { GlobalContext } from '@parts/Contexts';
import { getConsent, noConsent, saveConsent } from '@parts/CookieBar/consent';
import Image from 'next/image';
import type { PointerEvent } from 'react';
import { lazy, Suspense, use, useEffect, useRef, useState } from 'react';
import { BOOKING_URL } from './config';
// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Config
// ------------
const Calendar = lazy(() => import('./Calendar'));
const CLOSE_MAGNET_STRENGTH = 0.22;
const CLOSE_MAGNET_LIMIT = 5;

// Component
// ------------
const ContactModal = ({ onClose }: I.ContactModalProps) => {
	// Context
	const { lenisRef } = use(GlobalContext);

	// Refs
	const dialogRef = useRef<HTMLDialogElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);

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
		dialog?.showModal();
		lenis?.stop();
		if (page) page.style.overflow = 'hidden';
		return () => {
			dialog?.close();
			if (page) page.style.overflow = overflow ?? '';
			if (lenis && !wasStopped) lenis.start();
			if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
		};
	}, [lenisRef]);

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
		closeButtonRef.current?.style.removeProperty('--magnetic-x');
		closeButtonRef.current?.style.removeProperty('--magnetic-y');
	};
	const moveCloseMagnet = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const button = event.currentTarget;
		const bounds = button.getBoundingClientRect();
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
								The calendar is provided by Cal.com. Allow marketing cookies to load it here, or book
								directly on Cal.com.
							</p>
							<button type='button' className={s.allowButton} onClick={allowCalendar}>
								Allow cookies and load calendar
							</button>
							<a href={BOOKING_URL} target='_blank' rel='noopener noreferrer'>
								Book on Cal.com ↗
							</a>
						</section>
					}
				>
					<Suspense
						fallback={
							<p className={s.loading} role='status'>
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
