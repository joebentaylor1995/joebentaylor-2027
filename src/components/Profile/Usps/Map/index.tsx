'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { defaults, getSettings, subscribe } from '@parts/ProfileReveal/Settings/store';
import { type CSSProperties, use, useEffect, useRef, useSyncExternalStore } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
const GlobeMap = () => {
	// Context
	const profilePresent = use(ProfilePresenceContext);
	const settings = useSyncExternalStore(subscribe, getSettings, () => defaults);
	// Refs
	const container = useRef<HTMLDivElement>(null);

	// Effects
	useEffect(() => {
		const element = container.current;
		if (!element || !profilePresent) return;
		const controller = new AbortController();
		let disposed = false;
		let loading = false;
		let visible = false;
		let scene: Awaited<ReturnType<typeof import('./engine').createGlobe>> | undefined;
		const observer = new IntersectionObserver(
			([entry]) => {
				visible = entry.isIntersecting;
				element.dataset.visible = String(visible);
				scene?.setVisible(visible);
				if (!visible || loading) return;
				loading = true;
				void import('./engine')
					.then(async ({ createGlobe }) => {
						if (disposed) return;
						const next = await createGlobe(element, controller.signal);
						if (disposed) next.destroy();
						else {
							scene = next;
							scene.setVisible(visible);
						}
					})
					.catch(error => {
						if (!disposed) {
							element.dataset.state = 'error';
							console.error('Globe could not load', error);
						}
					});
			},
			{ threshold: 0.1 }
		);
		observer.observe(element);
		return () => {
			disposed = true;
			controller.abort();
			observer.disconnect();
			scene?.destroy();
			element.dataset.state = 'loading';
			delete element.dataset.visible;
		};
	}, [profilePresent]);

	// Render
	return (
		<div ref={container} className={s.jacket} data-globe data-state='loading'>
			<div className={s.background} aria-hidden='true' />
			<canvas
				className={s.canvas}
				role='img'
				aria-label='Interactive globe showing Doncaster, United Kingdom. Drag or use arrow keys to explore; press Home to return.'
				tabIndex={0}
			/>
			<span
				className={s.marker}
				data-globe-marker
				data-pulse={settings.globePulse}
				aria-hidden='true'
				style={
					{
						'--map-dot-size': `${settings.globeDotSize / 10}rem`,
						'--map-pulse-duration': `${settings.globePulseDuration}s`,
						'--map-pulse-scale': settings.globePulseScale,
					} as CSSProperties
				}
			/>
			<span className={s.fallback} role='status'>
				Doncaster, United Kingdom
			</span>
		</div>
	);
};

// Exports
// ------------
GlobeMap.displayName = 'Map';
export default GlobeMap;
