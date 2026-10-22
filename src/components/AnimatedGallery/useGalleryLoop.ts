// Gallery loop
// ------------
// NOTE • The clock every gallery animation runs on. It shares GSAP's ticker
// (and so Lenis's frame), only ticks while the stage is on screen, never
// ticks for reduced-motion visitors, and pauses on request. Each animation
// just supplies `render`, which draws one frame for a given time.

// Imports
// ------------
import { mediaScrollRoot } from '@utils/preloadNearbyMedia';
import gsap from 'gsap';
import { type RefObject, useEffect, useRef } from 'react';

// Types
// ------------
export interface StageSize {
	width: number;
	height: number;
}

export type GalleryRender = (elapsed: number, size: StageSize) => void;

// Constants
// ------------
// NOTE • Caps a frame's time jump (a backgrounded tab), so cards never teleport
const MAX_DELTA = 0.1;

// Exports
// ------------
export const useGalleryLoop = (stageRef: RefObject<HTMLElement | null>, render: GalleryRender, isPaused: boolean) => {
	// NOTE • Survives pause/play, so the loop resumes where it stopped
	const elapsedRef = useRef(0);

	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const motion = matchMedia('(prefers-reduced-motion: no-preference)');
		const size: StageSize = { width: 0, height: 0 };
		let isOnScreen = false;
		let isTicking = false;

		const draw = () => render(elapsedRef.current, size);

		const measure = () => {
			size.width = stage.clientWidth;
			size.height = stage.clientHeight;
			draw();
			stage.dataset.ready = 'true';
		};

		const tick = (_time: number, deltaTime: number) => {
			elapsedRef.current += Math.min(deltaTime / 1000, MAX_DELTA);
			draw();
		};

		const sync = () => {
			const shouldTick = isOnScreen && motion.matches && !isPaused;
			if (shouldTick === isTicking) return;
			if (shouldTick) gsap.ticker.add(tick);
			else gsap.ticker.remove(tick);
			isTicking = shouldTick;
		};

		const resize = new ResizeObserver(measure);
		const visibility = new IntersectionObserver(([entry]) => {
			isOnScreen = Boolean(entry?.isIntersecting);
			sync();
		});
		// NOTE • Cards waiting off-stage are clipped, so native lazy loading would
		// never fetch them — load the lot once the block is a screen away
		const preload = new IntersectionObserver(
			entries => {
				if (!entries.some(entry => entry.isIntersecting)) return;
				for (const image of stage.querySelectorAll('img')) image.loading = 'eager';
				preload.disconnect();
			},
			{ root: mediaScrollRoot(stage), rootMargin: '100% 0px' }
		);

		resize.observe(stage);
		visibility.observe(stage);
		preload.observe(stage);
		motion.addEventListener('change', sync);
		measure();

		return () => {
			gsap.ticker.remove(tick);
			resize.disconnect();
			visibility.disconnect();
			preload.disconnect();
			motion.removeEventListener('change', sync);
		};
	}, [stageRef, render, isPaused]);
};
