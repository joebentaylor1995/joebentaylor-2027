'use client';

// Imports
// ------------
import { mediaScrollRoot } from '@utils/preloadNearbyMedia';
import { useEffect, useRef } from 'react';

// Styles + Interfaces
// ------------
import type { MatrixProps, MatrixSettings } from './interface';
import s from './styles.module.scss';

// Constants
// ------------
// Engine tunables for the footer rain (speeds are multipliers, hoverDuration is seconds)
const DEFAULTS: MatrixSettings = {
	speed: 1.55,
	size: 9,
	intensity: 0.75,
	enabled: true,
	hoverEnabled: true,
	hoverSpeed: 3.7,
	hoverGlow: 0.9,
	hoverSize: 1.15,
	hoverScramble: 1,
	hoverDrift: 0,
	hoverPulse: 0.6,
	hoverDuration: 0.33,
};

// Component
// ------------
// Decorative glyph-rain canvas for the project footer. The WebGL engine is lazy-loaded once the
// footer nears the viewport and only runs when the visitor has not asked for reduced motion.
export default function Matrix({ title }: MatrixProps) {
	// Refs
	const canvas = useRef<HTMLCanvasElement>(null);

	// Effects
	useEffect(() => {
		const element = canvas.current;
		const host = element?.closest<HTMLElement>('[data-project-outro]');
		if (!element || !host) return;

		const motion = matchMedia('(prefers-reduced-motion: no-preference)');

		// Teardown handles for whichever setup pass is currently live
		let dispose: (() => void) | undefined;
		let observer: IntersectionObserver | undefined;
		let request: AbortController | undefined;

		// Abort a pending load, stop observing and dispose the running engine
		const clear = () => {
			request?.abort();
			observer?.disconnect();
			dispose?.();
			dispose = undefined;
		};

		// (Re)start: wait until the footer is near the viewport, then import and create the engine
		const setup = () => {
			clear();
			if (!motion.matches) return;

			const controller = new AbortController();
			request = controller;

			const load = async () => {
				try {
					const { createMatrixFooter } = await import('./engine');
					if (!controller.signal.aborted) dispose = createMatrixFooter(element, host, title, () => DEFAULTS);
				} catch {
					/* Keep the plain background if the preview is unavailable. */
				}
			};

			observer = new IntersectionObserver(
				entries => {
					if (entries.some(entry => entry.isIntersecting)) {
						observer?.disconnect();
						void load();
					}
				},
				{ root: mediaScrollRoot(host), rootMargin: '600px' }
			);
			observer.observe(host);
		};

		setup();

		// Re-run setup when the surrounding experience toggles its enhanced layout or motion preference changes
		const experience = host.closest('[data-project-experience]');
		const layout = new MutationObserver(setup);
		if (experience) layout.observe(experience, { attributes: true, attributeFilter: ['data-enhanced'] });
		motion.addEventListener('change', setup);
		return () => {
			clear();
			layout.disconnect();
			motion.removeEventListener('change', setup);
		};
	}, [title]);

	// Render
	return (
		<div className={s.jacket} aria-hidden='true'>
			<canvas ref={canvas} data-footer-matrix />
		</div>
	);
}
