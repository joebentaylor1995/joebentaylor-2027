'use client';

// Imports
// ------------
import { mq } from '@tackl';
import Image from 'next/image';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { type DepthSettings, defaultSettings, portraitUrl } from './effect-settings';
// Styles + Interfaces
// ------------
import type * as I from './interface';
import type { LiquidControlsProps } from './LiquidControls/interface';
import { type LiquidSettings, liquidSettings as liquidDefaults } from './liquid-settings';
import { type DepthController, mountDepthEffect } from './renderer';
import type { SettingsProps } from './Settings/interface';
import { type IntroSettings, introDefaults, introReplays, introSettings } from './scene-intro';
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
	const liquidRef = useRef<LiquidSettings>({ ...liquidDefaults });

	// State
	const [settings, setSettings] = useState<DepthSettings>({ ...defaultSettings });
	const [ready, setReady] = useState(false);
	const [Controls, setControls] = useState<ComponentType<SettingsProps> | null>(null);
	const [liquidValues, setLiquidValues] = useState<LiquidSettings>({ ...liquidDefaults });
	const [liquidOpen, setLiquidOpen] = useState(false);
	const [introValues, setIntroValues] = useState<IntroSettings>({ ...introDefaults });
	const [LiquidControls, setLiquidControls] = useState<ComponentType<LiquidControlsProps> | null>(null);

	// Effects
	useEffect(() => {
		const canvas = canvasRef.current,
			photo = photoRef.current,
			host = canvas?.closest('section');

		if (!canvas || !photo || !host) return;

		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const desktop = window.matchMedia(`${mq.up.l} and (hover: hover) and (pointer: fine)`);
		const start = () => {
			controllerRef.current?.destroy();
			controllerRef.current = null;
			setReady(false);
			if (!motion.matches)
				controllerRef.current = mountDepthEffect({
					canvas,
					photo,
					host,
					liquidEnabled: desktop.matches,
					liquidSettings: liquidRef.current,
					getSettings: () => settingsRef.current,
					onReady: setReady,
				});
		};

		start();
		motion.addEventListener('change', start);
		desktop.addEventListener('change', start);

		return () => {
			motion.removeEventListener('change', start);
			desktop.removeEventListener('change', start);
			controllerRef.current?.destroy();
			controllerRef.current = null;
		};
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
		const host = canvasRef.current?.closest('section');
		if (host) introSettings.set(host, next);
		setIntroValues(next);
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
				<Controls
					intro={introValues}
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
						{ version: 1, portrait: settings, liquid: liquidValues, intro: introValues },
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
