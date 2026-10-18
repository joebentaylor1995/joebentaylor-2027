'use client';

// Imports
// ------------
import { whenLoaderLanded } from '@parts/SiteLoader/events';
import { mq } from '@tackl';
import { useEffect, useRef } from 'react';
import s from './styles.module.scss';

// Component
// ------------
export default function Water() {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const canvas = ref.current;
		const host = canvas?.closest<HTMLElement>('[data-project-hero]');
		const photo = canvas?.parentElement?.querySelector('img');
		if (!canvas || !host || !photo) return;
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const desktop = matchMedia(mq.up.l);
		let generation = 0;
		let dispose: (() => void) | undefined;
		const start = async () => {
			const current = ++generation;
			dispose?.();
			dispose = undefined;
			if (motion.matches) return;
			const { mountProjectWater } = await import('./engine');
			if (current !== generation) return;
			dispose = mountProjectWater(canvas, photo, host);
		};
		const stopWaiting = whenLoaderLanded(() => void start());
		motion.addEventListener('change', start);
		desktop.addEventListener('change', start);
		return () => {
			generation++;
			stopWaiting();
			motion.removeEventListener('change', start);
			desktop.removeEventListener('change', start);
			dispose?.();
		};
	}, []);
	return <canvas ref={ref} className={s.jacket} data-project-water />;
}
