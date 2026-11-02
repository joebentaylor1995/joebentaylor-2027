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
import {
	FILL_PREVIEW,
	FILL_SCRUB,
	FILL_STORAGE_KEY,
	type FillSettings,
	fillDefaults,
	fillEasings,
	fillRanges,
	readFillSettings,
} from '@parts/ProjectsRibbon/fillSettings';
import { grid } from '@theme/grid';
import { prepareNavigationScene } from '@utils/navigationScene';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
// A tuning panel for site-wide settings (opened with ?globalSettings): the page-transition wave,
// the projects ribbon's fill, and a tablet font-scale preview. Wave and fill settings are saved
// to localStorage and read back by the live site; the font scale is a live preview only.
export default function GlobalSettings() {
	// State
	const [scale, setScale] = useState(100);

	// Navigation wave. `preview` is the point (0-100%) to hold the wave at on this page, or null for off
	const [wave, setWave] = useState<WaveSettings>(waveDefaults);
	const [waveStatus, setWaveStatus] = useState('Changes apply to the next navigation and are saved in this browser.');
	const [preview, setPreview] = useState<number | null>(null);

	// Project fill. `scrub` is the point (0-100%) to hold the fill at on /projects, or null for off
	const [fill, setFill] = useState<FillSettings>(fillDefaults);
	const [scrub, setScrub] = useState<number | null>(null);
	const [fillStatus, setFillStatus] = useState('Changes apply to the next fill and are saved in this browser.');

	// Derived
	const isOnProjects = /^\/projects\/?$/.test(usePathname());

	// Effects
	// Load saved settings after mount (localStorage is unavailable during server render)
	useEffect(() => setWave(readWaveSettings()), []);
	useEffect(() => setFill(readFillSettings()), []);

	// Hold the fill at the chosen point, redrawn as any setting changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: fill changes repaint the stored settings.
	useEffect(() => {
		window.dispatchEvent(new CustomEvent(FILL_SCRUB, { detail: scrub === null ? null : scrub / 100 }));
	}, [scrub, fill]);

	// Let go of the fill when the panel closes
	useEffect(() => () => void window.dispatchEvent(new CustomEvent(FILL_SCRUB, { detail: null })), []);

	// Draw the chosen point of the wave on this page, redrawn as any setting changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: wave changes repaint the stored settings.
	useEffect(() => {
		if (preview === null) wavePreview.clear?.();
		else wavePreview.paint?.(preview / 100);
	}, [preview, wave]);

	// Clear the wave preview when the panel closes
	useEffect(() => () => wavePreview.clear?.(), []);

	// Handlers
	// Save to localStorage and announce the change so the live wave re-reads it
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

	// Save to localStorage; the ribbon reads it again when the next fill begins
	const updateFill = (settings: FillSettings) => {
		try {
			localStorage.setItem(FILL_STORAGE_KEY, JSON.stringify(settings));
			setFill(settings);
			setFillStatus('Saved. Play the fill to preview.');
		} catch {
			setFillStatus('Browser storage is unavailable; settings could not be saved.');
		}
	};

	// Tablet font-scale preview: set the CSS variable, then nudge layout and ScrollTrigger to re-measure
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

	// Render
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
				<details open>
					<summary>Project fill</summary>
					<p>The featured ribbon's expansion into a case study.</p>
					<label className={s.control}>
						<span>
							<span>
								<input
									type='checkbox'
									aria-label='Hold the fill on its timeline'
									checked={scrub !== null}
									disabled={!isOnProjects}
									onChange={event => setScrub(event.target.checked ? 50 : null)}
								/>{' '}
								Timeline
							</span>
							<output>{scrub === null ? 'off' : `${scrub}%`}</output>
						</span>
						<input
							type='range'
							aria-label='Timeline'
							min={0}
							max={100}
							step={1}
							value={scrub ?? 50}
							disabled={scrub === null}
							onChange={event => setScrub(Number(event.target.value))}
						/>
					</label>
					<p>Holds the fill at that point on the centred project. Every setting below updates it live.</p>
					<label className={s.control}>
						<span>Easing</span>
						<select
							aria-label='Fill easing'
							value={fill.easing}
							onChange={event =>
								updateFill({ ...fill, easing: event.target.value as FillSettings['easing'] })
							}
						>
							{Object.entries(fillEasings).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
					{fillRanges.map(([key, label, min, max, step]) => (
						<label key={key} className={s.control}>
							<span>
								{label}
								<output>{fill[key]}</output>
							</span>
							<input
								type='range'
								aria-label={label}
								min={min}
								max={max}
								step={step}
								value={fill[key]}
								disabled={key === 'softness' && fill.easing !== 'custom'}
								onChange={event => updateFill({ ...fill, [key]: Number(event.target.value) })}
							/>
						</label>
					))}
					<p role='status'>{fillStatus}</p>
					<div className={s.actions}>
						{isOnProjects ? (
							<button
								type='button'
								disabled={scrub !== null}
								onClick={() => window.dispatchEvent(new Event(FILL_PREVIEW))}
							>
								Play fill
							</button>
						) : (
							<Link
								href='/projects/?globalSettings'
								onNavigate={() => prepareNavigationScene('/projects')}
							>
								Go to Projects to preview
							</Link>
						)}
						<button type='button' onClick={() => updateFill({ ...fillDefaults })}>
							Reset fill
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
