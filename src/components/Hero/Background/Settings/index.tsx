'use client';

// Imports
// ------------
import { useRef, useState } from 'react';
import { type BooleanSetting, defaultSettings, type NumericSetting } from '../effect-settings';
import { type IntroSettings, introDefaults, introEasings } from '../scene-intro';
import IntroTimings from './IntroTimings';
// Styles + Interfaces
// ------------
import type { SettingsProps } from './interface';
import s from './styles.module.scss';

const ranges: [NumericSetting, string, number, number, number][] = [
	['gestureGap', 'Gesture reset gap (seconds)', 0.1, 1.5, 0.05],
	['fastRate', 'Fast scroll speed (pixels/second)', 500, 20000, 100],
	['velocityScale', 'Marquee velocity sensitivity (lower is stronger)', 100, 15000, 100],
	['velocitySmoothing', 'Velocity smoothing (seconds)', 0.01, 1, 0.01],
	['colourThreshold', 'Colour switch velocity threshold', 0.1, 1, 0.01],
	['colourTransition', 'Colour transition (seconds)', 0.01, 2, 0.01],
	['pulsePeak', 'Depth pulse release threshold', 0.1, 1, 0.01],
	['pulseDuration', 'Maximum depth pulse duration (seconds)', 0.1, 2, 0.01],
	['pulseAttack', 'Depth pulse attack (seconds)', 0.01, 1, 0.01],
	['pulseRelease', 'Depth pulse return (seconds)', 0.01, 2, 0.01],
	['intensity', 'Parallax intensity', 0, 2, 0.01],
	['horizontal', 'Horizontal movement', 0, 2, 0.01],
	['vertical', 'Vertical movement', 0, 2, 0.01],
	['lift', 'Hand depth', 0, 2, 0.01],
	['smooth', 'Smoothing', 0, 0.99, 0.01],
	['rotation', 'Rotation', -45, 45, 1],
	['positionX', 'X position', -100, 100, 1],
	['positionY', 'Y position', -100, 100, 1],
	['zoom', 'Scale', 0.3, 2.5, 0.01],
	['maxWidth', 'Portrait max viewport width (px)', 640, 3840, 10],
	['chroma', 'Blue edge strength', 0, 2, 0.05],
	['glow', 'Fingertip glow strength', 0, 2, 0.05],
	['drag', 'Blue scroll drag', 0, 2, 0.05],
	['push', 'Scroll zoom strength', 0, 2, 0.05],
	['trails', 'Motion trails', 0, 2, 0.05],
	['focus', 'Focus pull', 0, 2, 0.05],
];
const toggles: [BooleanSetting, string][] = [
	['colourOn', 'Scroll colour switching'],
	['chromaOn', 'Blue cursor edges'],
	['glowOn', 'Fingertip glow'],
	['dragOn', 'Scroll chromatic drag'],
	['pushOn', 'Scroll depth zoom'],
	['trailsOn', 'Scroll motion trails'],
	['focusOn', 'Scroll focus pull'],
	['auto', 'Automatic movement'],
	['depth', 'View depth map'],
];

// Component
// ------------
export default function Settings({
	intro,
	onIntroChange,
	onReplay,
	settings,
	onChange,
	onPreview,
	exportSettings,
	children,
	liquid,
	onLiquidChange,
}: SettingsProps) {
	// State
	const [open, setOpen] = useState(true);
	const [copyStatus, setCopyStatus] = useState('');
	const panelRef = useRef<HTMLElement>(null);
	const expand = (value: boolean) =>
		panelRef.current?.querySelectorAll('details').forEach(detail => {
			detail.open = value;
		});
	// Render
	return (
		<div className={s.jacket} data-hero-settings data-lenis-prevent>
			<button
				type='button'
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-controls='hero-effect-controls'
			>
				{open ? 'Hide effect settings' : 'Effect settings'}
			</button>
			{open ? (
				<section ref={panelRef} id='hero-effect-controls' aria-label='Hero effect settings' className={s.panel}>
					<header className={s.header}>
						<span>LIVE PREVIEW</span>
						<h2>Hero studio</h2>
						<p>Tune the motion. Copy your settings when ready.</p>
					</header>
					<div className={s.toolbar}>
						<button
							type='button'
							onClick={async () => {
								try {
									await navigator.clipboard.writeText(exportSettings);
									setCopyStatus('Copied all settings');
								} catch {
									setCopyStatus('Select and copy the settings below.');
								}
							}}
						>
							Copy all hero settings
						</button>
						<button type='button' onClick={() => expand(true)}>
							Expand all
						</button>
						<button type='button' onClick={() => expand(false)}>
							Collapse all
						</button>
					</div>
					<p role='status'>{copyStatus}</p>
					<details>
						<summary>All settings JSON</summary>
						<textarea
							aria-label='All hero settings JSON'
							readOnly
							value={exportSettings}
							rows={12}
							onFocus={event => event.target.select()}
						/>
					</details>
					<button type='button' onClick={onPreview}>
						Preview downward scroll
					</button>
					<button type='button' onClick={() => onChange({ ...defaultSettings })}>
						Reset saved defaults
					</button>
					<details className={s.group} open>
						<summary>Intro ripple</summary>
						<p>Shape one outward glass wave. Replay to preview your changes.</p>
						{(
							[
								['strength', 'Ripple strength', 0, 2, 0.05],
								['width', 'Ripple width', 0.25, 3, 0.05],
								['speed', 'Ripple speed', 0.25, 3, 0.05],
								['portraitScale', 'Portrait intro scale', 0.3, 3, 0.01],
								['portraitFinish', 'Portrait finish by (%)', 5, 100, 1],
							] as const
						).map(([key, label, min, max, step]) => (
							<label key={key} className={s.control}>
								<span>{label}</span>
								<input
									type='number'
									aria-label={`${label} value`}
									min={min}
									max={max}
									step={step}
									value={intro[key]}
									onChange={event => {
										const value = event.target.valueAsNumber;
										if (Number.isFinite(value))
											onIntroChange({ ...intro, [key]: Math.min(max, Math.max(min, value)) });
									}}
								/>
								<input
									type='range'
									aria-label={label}
									min={min}
									max={max}
									step={step}
									value={intro[key]}
									onChange={event => onIntroChange({ ...intro, [key]: Number(event.target.value) })}
								/>
							</label>
						))}
						<p>
							Speed {intro.speed.toFixed(2)}× · {(1 / intro.speed).toFixed(2)} seconds
						</p>
						<label className={s.easing}>
							Easing preset
							<select
								value={intro.ease}
								onChange={event =>
									onIntroChange({ ...intro, ease: event.target.value as IntroSettings['ease'] })
								}
							>
								{Object.entries(introEasings).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</label>
						<p>
							The portrait settles to your current scale by {intro.portraitFinish}% of the ripple’s
							progress.
						</p>
						<label className={s.easing}>
							Portrait easing
							<select
								value={intro.portraitEase}
								aria-label='Portrait easing'
								onChange={event =>
									onIntroChange({
										...intro,
										portraitEase: event.target.value as IntroSettings['portraitEase'],
									})
								}
							>
								{Object.entries(introEasings).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</label>
						<div className={s.toolbar}>
							<button type='button' onClick={onReplay}>
								Replay introduction
							</button>
							<button type='button' onClick={() => onIntroChange({ ...introDefaults })}>
								Reset intro
							</button>
						</div>
					</details>
					<IntroTimings intro={intro} onChange={onIntroChange} onReplay={onReplay} />
					<details className={s.group} open>
						<summary>Logo marquee</summary>
						<p>Default speed runs continuously. Scroll acceleration adds speed while scrolling.</p>
						{(
							[
								['marqueeSpeed', 'Default logo speed', 0, 10, 0.05],
								['marqueeScrollBoost', 'Scroll acceleration', 0, 100, 0.5],
								['marqueeBlur', 'Motion blur strength', 0, 60, 1],
								['marqueeBlurThreshold', 'Blur velocity threshold', 0, 0.95, 0.01],
								['marqueeBlurCurve', 'Blur ramp curve', 0.25, 6, 0.05],
							] as const
						).map(([key, label, min, max, step]) => (
							<label key={key} className={s.control}>
								<span>{label}</span>
								<input
									type='number'
									aria-label={`${label} value`}
									min={min}
									max={max}
									step={step}
									value={liquid[key]}
									onChange={event => {
										const value = event.target.valueAsNumber;
										if (Number.isFinite(value))
											onLiquidChange({ ...liquid, [key]: Math.min(max, Math.max(min, value)) });
									}}
								/>
								<input
									type='range'
									aria-label={label}
									min={min}
									max={max}
									step={step}
									value={liquid[key]}
									onChange={event => onLiquidChange({ ...liquid, [key]: Number(event.target.value) })}
								/>
							</label>
						))}
						<label className={s.toggle}>
							<input
								type='checkbox'
								checked={liquid.marqueeReverse}
								onChange={event => onLiquidChange({ ...liquid, marqueeReverse: event.target.checked })}
							/>
							Reverse marquee on upward scroll
						</label>
					</details>
					{children}
					<details className={s.group}>
						<summary>Effect switches</summary>
						{toggles.map(([key, label]) => (
							<label key={key} className={s.toggle}>
								<input
									type='checkbox'
									checked={settings[key]}
									onChange={event => onChange({ ...settings, [key]: event.target.checked })}
								/>
								{label}
							</label>
						))}
					</details>
					{[
						['Scroll response', 0, 4],
						['Colour transition', 4, 6],
						['Depth pulse', 6, 10],
						['Portrait & cursor', 10, 20],
						['Light & scroll effects', 20, 26],
					].map(([title, start, end]) => (
						<details className={s.group} key={title}>
							<summary>{title}</summary>
							{ranges.slice(Number(start), Number(end)).map(([key, label, min, max, step]) => (
								<label key={key} className={s.control}>
									{label}
									<input
										type='number'
										aria-label={`${label} value`}
										min={min}
										max={max}
										step={step}
										value={settings[key]}
										onChange={event => {
											const value = event.target.valueAsNumber;
											if (Number.isFinite(value))
												onChange({ ...settings, [key]: Math.min(max, Math.max(min, value)) });
										}}
									/>
									<input
										type='range'
										aria-label={label}
										min={min}
										max={max}
										step={step}
										value={settings[key]}
										onChange={event => onChange({ ...settings, [key]: Number(event.target.value) })}
									/>
								</label>
							))}
						</details>
					))}
				</section>
			) : null}
		</div>
	);
}
