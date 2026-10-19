import type Lenis from 'lenis';

export function lockProjectScroll(lenis?: Lenis) {
	const wasStopped = lenis?.isStopped;
	// Lenis' stopped class uses overflow: clip, which discards the viewport's
	// scroll position. Hidden blocks input while retaining programmatic scrolling.
	const root = lenis?.rootElement;
	const rootOverflow = root?.style.overflow ?? '';
	if (root) root.style.overflow = 'hidden';
	lenis?.stop();
	const scroller = document.querySelector<HTMLElement>('#page');
	const overflow = scroller?.style.overflow ?? '';
	if (scroller) scroller.style.overflow = 'hidden';
	const preventScroll = (event: Event) => event.preventDefault();
	const preventKeys = (event: KeyboardEvent) => {
		if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key))
			event.preventDefault();
	};
	window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
	window.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
	window.addEventListener('keydown', preventKeys, true);
	return () => {
		window.removeEventListener('wheel', preventScroll, true);
		window.removeEventListener('touchmove', preventScroll, true);
		window.removeEventListener('keydown', preventKeys, true);
		if (scroller) scroller.style.overflow = overflow;
		if (lenis && !wasStopped) lenis.start();
		if (root) root.style.overflow = rootOverflow;
	};
}
