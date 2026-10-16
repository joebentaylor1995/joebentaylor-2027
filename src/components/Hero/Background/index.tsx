'use client';

// Imports
// ------------
import { whenLoaderLanded } from '@parts/SiteLoader/events';
import { getImageProps } from 'next/image';
import { type ComponentType, type CSSProperties, useEffect, useRef, useState } from 'react';
import { HERO_DESKTOP_QUERY } from '../layout';
import { type DepthSettings, defaultSettings, portraitUrl } from './effect-settings';
// Styles + Interfaces
// ------------
import type * as I from './interface';
import type { LiquidControlsProps } from './LiquidControls/interface';
import { type LiquidSettings, liquidSettings as liquidDefaults } from './liquid-settings';
import type { DepthController } from './renderer';
import type { SettingsProps } from './Settings/interface';
import { type IntroSettings, introDefaults, introReplays, introSettings, mobileIntroDefaults } from './scene-intro';
import s from './styles.module.scss';

// Cover sizing uses the landscape source (4046 × 2799), including mobile zoom.
const PORTRAIT_SIZES = `${HERO_DESKTOP_QUERY} 112vw, max(122vw, 177vh)`;

// NOTE • Art-directed so phones get a lighter encode: the photo is the LCP
// element, and on mobile networks quality 90 at full cover width is the single
// biggest drag on it. Desktop keeps the higher quality.
const PORTRAIT_QUALITY = { desktop: 90, mobile: 75 };
const portraitProps = { src: portraitUrl, alt: '', fill: true, sizes: PORTRAIT_SIZES } as const;
const { props: desktopPortrait } = getImageProps({ ...portraitProps, quality: PORTRAIT_QUALITY.desktop });
const { props: mobilePortrait } = getImageProps({ ...portraitProps, quality: PORTRAIT_QUALITY.mobile });

// Component
// ------------
const Background = ({ className }: I.BackgroundProps) => {
	// Refs
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const photoRef = useRef<HTMLImageElement>(null);
	const controllerRef = useRef<DepthController | null>(null);
	const settingsRef = useRef<DepthSettings>({ ...defaultSettings });
	const liquidRef = useRef<LiquidSettings>({ ...liquidDefaults });

	// State
	const [settings, setSettings] = useState<DepthSettings>({ ...defaultSettings });
	const [ready, setReady] = useState(false);
	const [Controls, setControls] = useState<ComponentType<SettingsProps> | null>(null);
	const [liquidValues, setLiquidValues] = useState<LiquidSettings>({ ...liquidDefaults });
	const [liquidOpen, setLiquidOpen] = useState(false);
	const [introTarget, setIntroTarget] = useState<'mobile' | 'desktop'>('desktop');
	const [introProfiles, setIntroProfiles] = useState({
		mobile: { ...mobileIntroDefaults },
		desktop: { ...introDefaults },
	});
	const introValues = introProfiles[introTarget];
	const [LiquidControls, setLiquidControls] = useState<ComponentType<LiquidControlsProps> | null>(null);

	// Effects
	useEffect(() => {
		const canvas = canvasRef.current,
			photo = photoRef.current,
			host = canvas?.closest('section');

		if (!canvas || !photo || !host) return;

		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const desktopLayout = window.matchMedia(HERO_DESKTOP_QUERY);
		const desktop = window.matchMedia(`${HERO_DESKTOP_QUERY} and (hover: hover) and (pointer: fine)`);
		let generation = 0;
		const start = async () => {
			const current = ++generation;
			controllerRef.current?.destroy();
			controllerRef.current = null;
			setReady(false);
			if (!motion.matches) {
				const { mountDepthEffect } = await import('./renderer');
				if (generation !== current) return;
				controllerRef.current = mountDepthEffect({
					canvas,
					photo,
					host,
					liquidEnabled: true,
					liquidSettings: liquidRef.current,
					getSettings: () => settingsRef.current,
					onReady: setReady,
				});
			}
		};

		// NOTE • The WebGL setup (shader compiles, ~425KB of textures) waits until the
		// loader's logo has landed: the photo underneath is already the LCP paint,
		// and the loader still covers the hero, so nothing visible is lost
		const stopWaiting = whenLoaderLanded(() => void start());
		motion.addEventListener('change', start);
		desktopLayout.addEventListener('change', start);
		desktop.addEventListener('change', start);

		return () => {
			generation++;
			stopWaiting();
			motion.removeEventListener('change', start);
			desktopLayout.removeEventListener('change', start);
			desktop.removeEventListener('change', start);
			controllerRef.current?.destroy();
			controllerRef.current = null;
		};
	}, []);

	useEffect(() => {
		const query = window.matchMedia(HERO_DESKTOP_QUERY);
		const apply = () => {
			const target = query.matches ? 'desktop' : 'mobile';
			const host = canvasRef.current?.closest('section');
			if (host) introSettings.set(host, introProfiles[target]);
		};
		apply();
		query.addEventListener('change', apply);
		return () => query.removeEventListener('change', apply);
	}, [introProfiles]);
	useEffect(() => {
		setIntroTarget(window.matchMedia(HERO_DESKTOP_QUERY).matches ? 'desktop' : 'mobile');
	}, []);

	useEffect(() => {
		let active = true;
		if (new URLSearchParams(window.location.search).has('heroSettings')) {
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
	const updateLiquid = (next: LiquidSettings) => {
		Object.assign(liquidRef.current, next);
		setLiquidValues(next);
		update({ ...settingsRef.current });
	};
	const toggleLiquid = () => {
		setLiquidOpen(open => !open);
		if (!LiquidControls) void import('./LiquidControls').then(module => setLiquidControls(() => module.default));
	};
	const updateIntro = (next: IntroSettings) => {
		setIntroProfiles(profiles => ({ ...profiles, [introTarget]: next }));
	};

	// Render
	return (
		<>
			<aside
				className={[s.jacket, className].filter(Boolean).join(' ')}
				aria-hidden='true'
				data-ready={ready}
				data-testid='hero-depth'
				style={
					{
						'--mobile-portrait-x': `${settings.mobilePositionX}%`,
						'--mobile-portrait-y': `${settings.mobilePositionY}%`,
						'--mobile-portrait-scale': settings.mobileZoom,
						'--mobile-portrait-rotation': `${settings.mobileRotation}deg`,
					} as CSSProperties
				}
			>
				<picture>
					<source media={HERO_DESKTOP_QUERY} srcSet={desktopPortrait.srcSet} sizes={desktopPortrait.sizes} />
					<img
						{...mobilePortrait}
						alt=''
						ref={photoRef}
						className={s.fallback}
						loading='eager'
						fetchPriority='high'
					/>
				</picture>
				<canvas ref={canvasRef} className={s.canvas} />
			</aside>
			{Controls ? (
				<Controls
					intro={introValues}
					introTarget={introTarget}
					onIntroTargetChange={setIntroTarget}
					onIntroChange={updateIntro}
					onReplay={() => {
						const host = canvasRef.current?.closest('section');
						if (host) introReplays.get(host)?.();
					}}
					liquid={liquidValues}
					onLiquidChange={updateLiquid}
					settings={settings}
					onChange={update}
					onPreview={() => controllerRef.current?.preview()}
					exportSettings={JSON.stringify(
						{ version: 2, portrait: settings, liquid: liquidValues, intro: introProfiles },
						null,
						2
					)}
				>
					<div className={s.liquidControls} data-liquid-controls data-lenis-prevent>
						<button
							type='button'
							aria-expanded={liquidOpen}
							aria-controls='liquid-glass-controls'
							onClick={toggleLiquid}
						>
							{liquidOpen ? 'Hide liquid controls' : 'Liquid controls'}
						</button>
						{liquidOpen && LiquidControls ? (
							<LiquidControls
								settings={liquidValues}
								onChange={updateLiquid}
								onClose={() => setLiquidOpen(false)}
							/>
						) : null}
					</div>
				</Controls>
			) : null}
		</>
	);
};

// Exports
// ------------
Background.displayName = 'Background';
export default Background;
