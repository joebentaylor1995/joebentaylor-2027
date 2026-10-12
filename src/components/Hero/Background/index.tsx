'use client';

// Imports
// ------------
import Image from 'next/image';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { type DepthSettings, defaultSettings, portraitUrl } from './effect-settings';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import { type DepthController, mountDepthEffect } from './renderer';
import type { SettingsProps } from './Settings/interface';
import s from './styles.module.scss';

// NOTE • The portrait covers the hero, so on tall screens its width follows the
// height (portrait aspect 1.4455) — lets the srcset pick a texture that stays sharp
const PORTRAIT_SIZES = 'max(100vw, 144.55vh)';

// Component
// ------------
const Background = ({ className }: I.BackgroundProps) => {
	// Refs
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const photoRef = useRef<HTMLImageElement>(null);
	const controllerRef = useRef<DepthController | null>(null);
	const settingsRef = useRef<DepthSettings>({ ...defaultSettings });

	// State
	const [settings, setSettings] = useState<DepthSettings>({ ...defaultSettings });
	const [ready, setReady] = useState(false);
	const [Controls, setControls] = useState<ComponentType<SettingsProps> | null>(null);

	// Effects
	useEffect(() => {
		const canvas = canvasRef.current,
			photo = photoRef.current,
			host = canvas?.closest('section');

		if (!canvas || !photo || !host) return;

		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const start = () => {
			controllerRef.current?.destroy();
			controllerRef.current = null;
			setReady(false);
			if (!motion.matches)
				controllerRef.current = mountDepthEffect({
					canvas,
					photo,
					host,
					getSettings: () => settingsRef.current,
					onReady: setReady,
				});
		};

		start();
		motion.addEventListener('change', start);

		return () => {
			motion.removeEventListener('change', start);
			controllerRef.current?.destroy();
			controllerRef.current = null;
		};
	}, []);

	useEffect(() => {
		let active = true;
		if (new URLSearchParams(window.location.search).get('heroSettings') === '1') {
			void import('./Settings').then(module => {
				if (active) setControls(() => module.default);
			});
		}
		return () => {
			active = false;
		};
	}, []);

	// Handlers
	const update = (next: DepthSettings) => {
		settingsRef.current = next;
		setSettings(next);
	};

	// Render
	return (
		<>
			<aside
				className={[s.jacket, className].filter(Boolean).join(' ')}
				aria-hidden='true'
				data-ready={ready}
				data-testid='hero-depth'
			>
				<Image
					ref={photoRef}
					className={s.fallback}
					src={portraitUrl}
					alt=''
					fill
					sizes={PORTRAIT_SIZES}
					loading='eager'
					fetchPriority='high'
				/>
				<canvas ref={canvasRef} className={s.canvas} />
			</aside>
			{Controls ? (
				<Controls settings={settings} onChange={update} onPreview={() => controllerRef.current?.preview()} />
			) : null}
		</>
	);
};

// Exports
// ------------
Background.displayName = 'Background';
export default Background;
