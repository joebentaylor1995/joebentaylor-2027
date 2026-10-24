'use client';

// Imports
// ------------
import { introEasings } from '@parts/Hero/Background/scene-intro';
import {
	readWaveSettings,
	WAVE_SETTINGS_CHANGED,
	WAVE_STORAGE_KEY,
	type WaveSettings,
	waveDefaults,
	wavePreview,
	waveRanges,
} from '@parts/NavigationWave/settings';
import { grid } from '@theme/grid';
import { prepareNavigationScene } from '@utils/navigationScene';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
export default function GlobalSettings() {
	const [scale, setScale] = useState(100);
	const [wave, setWave] = useState<WaveSettings>(waveDefaults);
	const [waveStatus, setWaveStatus] = useState('Changes apply to the next navigation and are saved in this browser.');

	const [preview, setPreview] = useState<number | null>(null);

	useEffect(() => setWave(readWaveSettings()), []);

	// Draw the chosen point of the wave on this page, redrawn as any setting changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: wave changes repaint the stored settings.
	useEffect(() => {
		if (preview === null) wavePreview.clear?.();
		else wavePreview.paint?.(preview / 100);
	}, [preview, wave]);

	useEffect(() => () => wavePreview.clear?.(), []);

	const updateWave = (settings: WaveSettings) => {
		try {
			localStorage.setItem(WAVE_STORAGE_KEY, JSON.stringify(settings));
			window.dispatchEvent(new Event(WAVE_SETTINGS_CHANGED));
			setWave(settings);
			setWaveStatus('Saved. Navigate between Home and Projects to preview.');
		} catch {
			setWaveStatus('Browser storage is unavailable; settings could not be saved.');
		}
	};

	useEffect(() => {
		document.documentElement.style.setProperty('--tablet-font-scale', `${scale}%`);
		const refresh = window.setTimeout(() => {
			window.dispatchEvent(new Event('resize'));
			ScrollTrigger.refresh();
		}, 150);
		return () => {
			window.clearTimeout(refresh);
			document.documentElement.style.removeProperty('--tablet-font-scale');
		};
	}, [scale]);

	return (
		<aside className={s.jacket} aria-label='Global settings' data-type='captionL' data-lenis-prevent>
			<details open>
				<summary>Global settings</summary>
				<details open>
					<summary>Navigation wave</summary>
					<p>Applies across the site, separately from the opening introduction.</p>
					<label className={s.control}>
						<span>
							<span>
								<input
									type='checkbox'
									aria-label='Preview the wave midway'
									checked={preview !== null}
									onChange={event => setPreview(event.target.checked ? 50 : null)}
								/>{' '}
								Preview at
							</span>
							<output>{preview === null ? 'off' : `${preview}%`}</output>
						</span>
						<input
							type='range'
							aria-label='Preview at'
							min={0}
							max={100}
							step={1}
							value={preview ?? 50}
							disabled={preview === null}
							onChange={event => setPreview(Number(event.target.value))}
						/>
					</label>
					<p>Shows this page revealed through the wave at that point. Every setting below updates it live.</p>
					<label className={s.control}>
						<span>Easing</span>
						<select
							aria-label='Wave easing'
							value={wave.ease}
							onChange={event =>
								updateWave({ ...wave, ease: event.target.value as WaveSettings['ease'] })
							}
						>
							{Object.entries(introEasings).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
					{waveRanges.map(([key, label, min, max, step]) => (
						<label key={key} className={s.control}>
							<span>
								{label}
								<output>{wave[key]}</output>
							</span>
							<input
								type='range'
								aria-label={label}
								min={min}
								max={max}
								step={step}
								value={wave[key]}
								onChange={event => updateWave({ ...wave, [key]: Number(event.target.value) })}
							/>
						</label>
					))}
					<p>Navigation starts immediately. Set distortion strength to 0 to compare a plain reveal.</p>
					<p role='status'>{waveStatus}</p>
					<div className={s.actions}>
						<Link href='/?globalSettings' onNavigate={() => prepareNavigationScene('/')}>
							Preview Home
						</Link>
						<Link href='/projects/?globalSettings' onNavigate={() => prepareNavigationScene('/projects')}>
							Preview Projects
						</Link>
						<button type='button' onClick={() => updateWave({ ...waveDefaults })}>
							Reset wave
						</button>
					</div>
				</details>
				<p>
					Tablet sizing · {grid.breakpoints.m}–{Number.parseInt(grid.breakpoints.l, 10) - 1}px
				</p>
				<label className={s.control}>
					<span>
						Tablet font scale <output>{scale}%</output>
					</span>
					<input
						aria-label='Tablet font scale'
						type='range'
						min='62.5'
						max='125'
						step='2.5'
						value={scale}
						onChange={event => setScale(Number(event.target.value))}
					/>
				</label>
				<p>Live preview only. Mobile and desktop keep their normal sizing. Reload to restore 100%.</p>
				<button type='button' onClick={() => setScale(100)}>
					Reset to 100%
				</button>
			</details>
		</aside>
	);
}
