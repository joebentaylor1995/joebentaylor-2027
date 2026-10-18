'use client';

import { mediaScrollRoot } from '@utils/preloadNearbyMedia';
import { useEffect, useRef } from 'react';
import type { MatrixProps, MatrixSettings } from './interface';
import s from './styles.module.scss';

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

export default function Matrix({ title }: MatrixProps) {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const element = canvas.current;
		const host = element?.closest<HTMLElement>('[data-project-outro]');
		if (!element || !host) return;
		const motion = matchMedia('(prefers-reduced-motion: no-preference)');
		let dispose: (() => void) | undefined;
		let observer: IntersectionObserver | undefined;
		let request: AbortController | undefined;
		const clear = () => {
			request?.abort();
			observer?.disconnect();
			dispose?.();
			dispose = undefined;
		};
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
					/* Keep the plain gradient if the preview is unavailable. */
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
	return (
		<div className={s.jacket} aria-hidden='true'>
			<canvas ref={canvas} data-footer-matrix />
		</div>
	);
}
