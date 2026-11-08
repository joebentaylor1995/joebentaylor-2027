// Imports
// ------------
import type Lenis from 'lenis';

// Exports
// ------------
// Freezes all user scrolling (wheel, touch, keys) and returns a function that restores it
export function lockProjectScroll(lenis?: Lenis) {
	const wasStopped = lenis?.isStopped;

	// NOTE • Lenis' stopped class uses overflow: clip, which discards the viewport's
	// scroll position. Hidden blocks input while retaining programmatic scrolling.
	const root = lenis?.rootElement;
	const rootOverflow = root?.style.overflow ?? '';
	if (root) root.style.overflow = 'hidden';
	lenis?.stop();

	const scroller = document.querySelector<HTMLElement>('#page');
	const overflow = scroller?.style.overflow ?? '';
	if (scroller) scroller.style.overflow = 'hidden';

	// NOTE • Tools that drive a transition while it runs (the ?waveTuner panel) opt out with
	// data-scroll-lock-exempt, so their own scrolling and keys still work
	const isExempt = (event: Event) =>
		event.target instanceof Element && event.target.closest('[data-scroll-lock-exempt]') !== null;
	const preventScroll = (event: Event) => {
		if (!isExempt(event)) event.preventDefault();
	};
	const preventKeys = (event: KeyboardEvent) => {
		if (isExempt(event)) return;
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
