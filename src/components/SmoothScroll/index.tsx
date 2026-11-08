'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import { PerformanceContext } from '@parts/Contexts/Performance';
import { touchOnlyEventsTarget } from '@utils/desktopHover';
import { smoothFrameTime } from '@utils/frameClock';
import { observeScenePause } from '@utils/observeScenePause';
import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { ReactLenis, useLenis } from 'lenis/react';
import { use, useEffect, useState } from 'react';

// Styles + Interfaces
// ------------
import 'lenis/dist/lenis.css';
import type * as I from './interface';

// Plugins
// ------------
gsap.registerPlugin(ScrollTrigger);

// Helpers
// ------------
// Lenis' options, with its event target chosen for the input devices attached right now
const createOptions = () => {
	const eventsTarget = touchOnlyEventsTarget();
	return { autoRaf: false, ...(eventsTarget && { eventsTarget }) };
};

// Lenis keeps `reset` private; it is what Lenis' own touch handler runs to hand over to a finger
type LenisInternals = { reset: () => void };

// Touches inside these subtrees are left alone by Lenis' own handler too
const ignoresTouch = (node: EventTarget) =>
	node instanceof HTMLElement &&
	(node.hasAttribute('data-lenis-prevent') || node.hasAttribute('data-lenis-prevent-touch'));

/**
 * Wires Lenis + GSAP after the Lenis instance exists (created in ReactLenis useEffect).
 * Rendered after page children so its useEffect runs after deeper useGSAP hooks schedule work.
 */
const LenisGsapBridge = () => {
	// Context
	const lenis = useLenis();

	// Effects
	useEffect(() => {
		if (!lenis) return;

		const wrapper = lenis.rootElement;

		// NOTE • ScrollTrigger reads and writes scroll through Lenis; the page scrolls inside this wrapper, not the window.
		// It reads the offset the browser actually rendered: Lenis' own value is fractional, but
		// element scroll offsets snap to whole pixels (Chrome rounds, Safari truncates), so pins and
		// scrubs driven by `lenis.scroll` drifted up to a pixel against the page every frame.
		// The offset is read once whenever it changes, not on every ScrollTrigger read: those come
		// once per trigger per update, often after other triggers have written styles, and each
		// live read would then force a style recalc mid-update.
		let rendered = wrapper.scrollTop;
		const readRendered = () => {
			rendered = wrapper.scrollTop;
		};
		const onScroll = () => {
			readRendered();
			ScrollTrigger.update();
		};

		ScrollTrigger.scrollerProxy(wrapper, {
			scrollTop(value?: number) {
				if (value !== undefined) {
					lenis.scrollTo(value, { immediate: true });
					readRendered();
				}
				return rendered;
			},
			getBoundingClientRect() {
				return {
					top: 0,
					left: 0,
					width: wrapper.clientWidth,
					height: wrapper.clientHeight,
				};
			},
			pinType: 'transform',
		});

		ScrollTrigger.defaults({ scroller: wrapper });
		lenis.on('scroll', onScroll);
		// Scrolls Lenis doesn't emit (the browser clamping or anchoring), and refreshes that run
		// before the next scroll event
		wrapper.addEventListener('scroll', readRendered, { passive: true });
		ScrollTrigger.addEventListener('refreshInit', readRendered);

		// Lenis rides GSAP's shared ticker (autoRaf is off); it is detached while the scene is paused.
		// It steps on the vsync clock: GSAP's own time is whole milliseconds, which makes the
		// damping step wobble from frame to frame. It runs first in the tick, so the scroll and
		// the ScrollTrigger writes it emits land before tweens render and scenes read them;
		// otherwise scrubbed tweens trail the pins and the page by a frame.
		const update = () => lenis.raf(smoothFrameTime());
		const stopObservingPause = observeScenePause(wrapper, paused => {
			gsap.ticker.remove(update);
			if (!paused) gsap.ticker.add(update, false, true);
		});

		// Without its touch listeners (touch-only devices, see touchOnlyEventsTarget) Lenis can't
		// see a finger, so hand an in-flight programmatic smooth scroll over to it here, as Lenis'
		// own touchmove handler does: stop animating and let the native scroll carry on from
		// wherever it is (writing scrollTop here would yank a moving swipe back)
		const yieldToFinger = (event: TouchEvent) => {
			if (lenis.isScrolling !== 'smooth') return;
			const path = event.composedPath();
			if (path.slice(0, path.indexOf(wrapper)).some(ignoresTouch)) return;
			(lenis as unknown as LenisInternals).reset();
		};
		const listensForTouch = lenis.options.eventsTarget === wrapper;
		if (!listensForTouch) wrapper.addEventListener('touchmove', yieldToFinger, { passive: true });

		ScrollTrigger.refresh();

		return () => {
			lenis.off('scroll', onScroll);
			wrapper.removeEventListener('scroll', readRendered);
			ScrollTrigger.removeEventListener('refreshInit', readRendered);
			if (!listensForTouch) wrapper.removeEventListener('touchmove', yieldToFinger);
			gsap.ticker.remove(update);
			stopObservingPause();
			ScrollTrigger.defaults({ scroller: window });
			ScrollTrigger.scrollerProxy(wrapper, {});
		};
	}, [lenis]);

	// Render
	return null;
};

// Component
// ------------
const SmoothScroll = ({ children }: I.SmoothScrollProps) => {
	// Context
	const { lenisRef } = use(GlobalContext);
	const { isReducedMotion } = use(PerformanceContext);

	// State
	// NOTE • Decided once per mount: new options would recreate Lenis, and every component keyed on
	// it (the case study's pinned sequence) would rebuild and lose the visitor's scroll position.
	// An iPad that gains a trackpad mid-visit therefore scrolls natively until the next load.
	const [options] = useState(createOptions);

	// Render
	// NOTE • prefers-reduced-motion: skip Lenis entirely — native scrolling
	// takes over (see the reduced-motion overrides in src/css/global.scss) and
	// the constant rAF loop never starts. ScrollTrigger falls back to the
	// default window scroller.
	if (isReducedMotion) return children;

	return (
		<ReactLenis ref={lenisRef} options={options}>
			{children}
			<LenisGsapBridge />
		</ReactLenis>
	);
};

// Exports
// ------------
SmoothScroll.displayName = 'SmoothScroll';
export default SmoothScroll;
