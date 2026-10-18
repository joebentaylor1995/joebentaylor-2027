'use client';

// Imports
// ------------
import Cal, { getCalApi } from '@calcom/embed-react';
import { ContactContext } from '@parts/Contexts';
import { use, useEffect, useRef, useState } from 'react';
import { bookingUrl } from '../config';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
const Calendar = () => {
	// Context
	const { bookingLink } = use(ContactContext);

	// Refs
	const embedRef = useRef<HTMLDivElement>(null);

	// State
	const [isReady, setIsReady] = useState(false);
	const [isListening, setIsListening] = useState(false);

	// Effects
	useEffect(() => {
		const embed = embedRef.current;
		if (!embed) return;
		const configureFrame = () => {
			const frame = embed.querySelector('iframe');
			if (!frame) return;
			// Cal only forwards iframeAttrs.id. Set these before the inserted frame paints.
			// Cal auto-sizes the document; its internal time-slot list can still scroll.
			frame.setAttribute('scrolling', 'no');
			frame.title = 'Book a 30-minute call with Joe Ben Taylor';
		};
		const observer = new MutationObserver(configureFrame);
		observer.observe(embed, { childList: true, subtree: true });
		configureFrame();
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		let disposed = false;
		let unsubscribe: (() => void) | undefined;
		let hasLoaded = false;
		let hasDimensions = false;
		let revealTimer: ReturnType<typeof setTimeout> | undefined;
		const reveal = () => {
			clearTimeout(revealTimer);
			if (hasLoaded && hasDimensions) {
				// Cal resizes its iframe after loading; keep partial layouts hidden.
				revealTimer = setTimeout(() => {
					if (!disposed) setIsReady(true);
				}, 150);
			}
		};
		const ready = () => {
			hasLoaded = true;
			reveal();
		};
		const resized = () => {
			hasDimensions = true;
			reveal();
		};
		void getCalApi({ namespace: 'contact' }).then(cal => {
			if (disposed) return;
			cal('on', { action: 'linkReady', callback: ready });
			cal('on', { action: '__dimensionChanged', callback: resized });
			unsubscribe = () => {
				cal('off', { action: 'linkReady', callback: ready });
				cal('off', { action: '__dimensionChanged', callback: resized });
			};
			// Subscribe before mounting the embed, including when its script is cached.
			setIsListening(true);
		});
		return () => {
			disposed = true;
			clearTimeout(revealTimer);
			unsubscribe?.();
		};
	}, []);

	// Render
	return (
		<div className={s.jacket} data-state={isReady ? 'ready' : 'loading'} aria-busy={!isReady}>
			<div ref={embedRef} className={s.embed} inert={!isReady} aria-hidden={!isReady}>
				{isListening && (
					<Cal
						namespace='contact'
						calLink={bookingLink}
						config={{
							theme: 'dark',
							layout: 'month_view',
							overlayCalendar: 'true',
						}}
					/>
				)}
			</div>
			{!isReady && (
				<div data-type='bodyM' className={s.loading}>
					<p role='status'>Loading calendar…</p>
					<a
						data-type='bodyS'
						className={s.fallback}
						href={bookingUrl(bookingLink)}
						target='_blank'
						rel='noopener noreferrer'
					>
						Calendar not loading? Book on Cal.com ↗
					</a>
				</div>
			)}
		</div>
	);
};

// Exports
// ------------
Calendar.displayName = 'Calendar';
export default Calendar;
