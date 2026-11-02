'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import { PerformanceContext } from '@parts/Contexts/Performance';
import { observeScenePause } from '@utils/observeScenePause';
import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { ReactLenis, useLenis } from 'lenis/react';
import { use, useEffect } from 'react';

// Styles + Interfaces
// ------------
import 'lenis/dist/lenis.css';
import type * as I from './interface';

// Plugins
// ------------
gsap.registerPlugin(ScrollTrigger);

// Helpers
// ------------
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

		// NOTE • ScrollTrigger reads and writes scroll through Lenis; the page scrolls inside this wrapper, not the window
		ScrollTrigger.scrollerProxy(wrapper, {
			scrollTop(value?: number) {
				if (value !== undefined) {
					lenis.scrollTo(value, { immediate: true });
				}
				return lenis.scroll;
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
		lenis.on('scroll', ScrollTrigger.update);

		// Lenis rides GSAP's shared ticker (autoRaf is off); it is detached while the scene is paused
		const update = (time: number) => lenis.raf(time * 1000);
		const stopObservingPause = observeScenePause(wrapper, paused => {
			gsap.ticker.remove(update);
			if (!paused) gsap.ticker.add(update);
		});

		ScrollTrigger.refresh();

		return () => {
			lenis.off('scroll', ScrollTrigger.update);
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

	// Render
	// NOTE • prefers-reduced-motion: skip Lenis entirely — native scrolling
	// takes over (see the reduced-motion overrides in src/css/global.scss) and
	// the constant rAF loop never starts. ScrollTrigger falls back to the
	// default window scroller.
	if (isReducedMotion) return children;

	return (
		<ReactLenis ref={lenisRef} options={{ autoRaf: false }}>
			{children}
			<LenisGsapBridge />
		</ReactLenis>
	);
};

// Exports
// ------------
SmoothScroll.displayName = 'SmoothScroll';
export default SmoothScroll;
