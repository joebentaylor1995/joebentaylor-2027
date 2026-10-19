'use client';

// Imports
// ------------
import { useEffect, useState } from 'react';
import { INTRO_FPS, INTRO_LAST_FRAME } from '../intro';
import {
	DEFAULT_LOADER_SETTINGS,
	LOADER_REPLAY,
	type LoaderSettings,
	loaderControl,
	loaderSettings,
} from '../settings';

// Styles
// ------------
import s from './styles.module.scss';

// Constants
// ------------
type NumericKey = { [K in keyof LoaderSettings]: LoaderSettings[K] extends number ? K : never }[keyof LoaderSettings];

type Slider = {
	key: NumericKey;
	label: string;
	min: number;
	max: number;
	step: number;
	// Timing changes rebuild the timeline; the rest redraw the current frame
	rebuild?: boolean;
};

const SLIDERS: Slider[] = [
	{ key: 'scale', label: 'Size', min: 0.15, max: 1, step: 0.01 },
	{ key: 'screenAspect', label: 'Screen aspect', min: 1.5, max: 5, step: 0.01 },
	{ key: 'screenCurve', label: 'Screen curve (1 = flat)', min: 0.4, max: 1, step: 0.01 },
	{ key: 'bandWidth', label: 'Screen width', min: 0.5, max: 2.5, step: 0.01 },
	{ key: 'speed', label: 'Speed', min: 0.1, max: 2, step: 0.05 },
	{ key: 'revealGap', label: 'Hold before wipe (s)', min: 0, max: 3, step: 0.05, rebuild: true },
	{ key: 'heroZoomDuration', label: 'Hero zoom duration (s)', min: 1, max: 8, step: 0.1, rebuild: true },
];

const ASPECTS = [
	{ label: '16:9', value: 16 / 9 },
	{ label: '21:9', value: 21 / 9 },
	{ label: '32:9', value: 32 / 9 },
];

const DEFAULT_BLUE = '#1012FD';

// Helpers
// ------------
const loaderRoot = () => document.querySelector<HTMLElement>('[data-site-loader]');

// NOTE • Seeking from 0 replays every frame callback up to `time`, so the
// held state is exact; it also reopens a loader that already finished.
const seek = (time: number) => {
	if (window.location.pathname !== '/' && loaderControl.preview) {
		loaderControl.preview(time);
		return;
	}
	const tl = loaderControl.timeline;
	const root = loaderRoot();
	if (!tl || !root) return;
	delete root.dataset.complete;
	root.style.animation = 'none';
	tl.pause();
	// Rewinding with events on lets the wipe's onUpdate close the backdrop again
	tl.seek(0, false);
	tl.seek(time, false);
};

const replay = () => window.dispatchEvent(new Event(LOADER_REPLAY));

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

// Component
// ------------
const LoaderTweaks = () => {
	// State
	const [settings, setSettings] = useState<LoaderSettings>({ ...loaderSettings });
	const [blue, setBlue] = useState(DEFAULT_BLUE);
	const [time, setTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [copied, setCopied] = useState(false);
	const [pageMode, setPageMode] = useState(false);

	// Effects
	// NOTE • Mirrors the live timeline's playhead into the scrubber
	useEffect(() => {
		setPageMode(window.location.pathname !== '/');
		let frame = 0;
		const tick = () => {
			const tl = loaderControl.timeline;
			if (tl) {
				setTime(loaderControl.previewTime ?? tl.time());
				setDuration(
					window.location.pathname === '/'
						? tl.duration()
						: Math.max(tl.duration(), loaderSettings.pageRevealAt + loaderSettings.revealDuration)
				);
				setPlaying(!tl.paused() && tl.progress() < 1);
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, []);

	useEffect(() => {
		loaderRoot()?.style.setProperty('--brand-c8', blue);
	}, [blue]);

	// Handlers
	const update = (slider: Slider, value: number) => {
		loaderSettings[slider.key] = value;
		setSettings({ ...loaderSettings });
		if (slider.key === 'speed') loaderControl.timeline?.timeScale(value);
		if (slider.rebuild) replay();
		else if (loaderControl.timeline?.paused()) seek(loaderControl.previewTime ?? loaderControl.timeline.time());
	};

	const togglePlay = () => {
		const tl = loaderControl.timeline;
		if (!tl) return;
		if (loaderControl.previewTime !== null) replay();
		else if (playing) tl.pause();
		else if (tl.progress() >= 1) replay();
		else {
			seek(tl.time());
			tl.play();
		}
	};

	const setRevealPoint = (value: number) => {
		loaderSettings.pageRevealAt = Math.max(INTRO_LAST_FRAME, Math.round(value * INTRO_FPS)) / INTRO_FPS;
		setSettings({ ...loaderSettings });
	};

	const reset = () => {
		Object.assign(loaderSettings, DEFAULT_LOADER_SETTINGS);
		setSettings({ ...loaderSettings });
		setBlue(DEFAULT_BLUE);
		replay();
	};

	const copy = async () => {
		await navigator.clipboard.writeText(JSON.stringify({ ...settings, blue }, null, '\t'));
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	};

	// Render
	return (
		<aside className={s.jacket} aria-label='Loader tweaks' data-type='captionL' data-lenis-prevent>
			<details open>
				<summary>Loader tweaks</summary>

				<div className={s.transport}>
					<button type='button' onClick={togglePlay}>
						{playing ? 'Pause' : loaderControl.previewTime !== null ? 'Play from start' : 'Play'}
					</button>
					<button type='button' onClick={replay}>
						Replay
					</button>
					<output>
						{time.toFixed(2)}s · frame {Math.round(time * INTRO_FPS)}
					</output>
				</div>
				<label className={s.control}>
					<span>Scrub</span>
					<input
						aria-label='Scrub timeline'
						type='range'
						min='0'
						max={duration}
						step={1 / INTRO_FPS}
						value={time}
						onChange={event => {
							const value = Number(event.target.value);
							setTime(value);
							seek(value);
						}}
					/>
				</label>
				{pageMode && (
					<>
						<label className={s.control}>
							<span>Reveal effect</span>
							<select
								aria-label='Reveal effect'
								value={settings.revealEffect}
								onChange={event => {
									loaderSettings.revealEffect = event.target.value as LoaderSettings['revealEffect'];
									setSettings({ ...loaderSettings });
									replay();
								}}
							>
								<option value='fade'>Cinematic fade</option>
								<option value='window'>Masked window</option>
								<option value='wave'>Original wave</option>
							</select>
						</label>
						<label className={s.control}>
							<span>Reveal origin</span>
							<select
								aria-label='Reveal origin'
								disabled={settings.revealEffect !== 'window'}
								value={settings.revealOrigin}
								onChange={event => {
									loaderSettings.revealOrigin = event.target.value as LoaderSettings['revealOrigin'];
									setSettings({ ...loaderSettings });
									replay();
								}}
							>
								<option value='lower'>Lower centre — like the video</option>
								<option value='logo'>Centred logo</option>
							</select>
						</label>
						<label className={s.control}>
							<span>
								Reveal duration{' '}
								<output>
									{(settings.revealEffect === 'wave' ? 1.35 : settings.revealDuration).toFixed(2)}s
								</output>
							</span>
							<input
								aria-label='Reveal duration'
								disabled={settings.revealEffect === 'wave'}
								type='range'
								min='0.4'
								max='2'
								step='0.05'
								value={settings.revealDuration}
								onChange={event => {
									loaderSettings.revealDuration = Number(event.target.value);
									setSettings({ ...loaderSettings });
								}}
							/>
						</label>
						<label className={s.control}>
							<span>
								Hero starting scale <output>{Math.round(settings.heroStartScale * 100)}%</output>
							</span>
							<input
								aria-label='Hero starting scale'
								disabled={settings.revealEffect === 'wave'}
								type='range'
								min='0.01'
								max='1.5'
								step='0.01'
								value={settings.heroStartScale}
								onChange={event => {
									loaderSettings.heroStartScale = Number(event.target.value);
									setSettings({ ...loaderSettings });
									if (loaderControl.timeline?.paused())
										seek(loaderControl.previewTime ?? loaderControl.timeline.time());
								}}
							/>
						</label>
						<div className={s.transport}>
							<button type='button' onClick={() => seek(Math.max(0, time - 1 / INTRO_FPS))}>
								Previous frame
							</button>
							<button type='button' onClick={() => seek(Math.min(duration, time + 1 / INTRO_FPS))}>
								Next frame
							</button>
						</div>
						<label className={s.control}>
							<span>
								Reveal page at{' '}
								<output>
									{settings.pageRevealAt.toFixed(2)}s · frame{' '}
									{Math.round(settings.pageRevealAt * INTRO_FPS)}
								</output>
							</span>
							<input
								aria-label='Reveal page at'
								type='range'
								min={INTRO_LAST_FRAME / INTRO_FPS}
								max={INTRO_LAST_FRAME / INTRO_FPS + 1}
								step={1 / INTRO_FPS}
								value={settings.pageRevealAt}
								onChange={event => setRevealPoint(Number(event.target.value))}
							/>
						</label>
						<button type='button' onClick={() => setRevealPoint(time)}>
							Reveal at this frame
						</button>
						<p>
							The cinematic fade runs after the logo finishes. Adjust the hero starting scale and zoom
							duration, then Replay. Scrub to inspect the fade and zoom together.
						</p>
					</>
				)}

				{SLIDERS.filter(slider => !pageMode || slider.key !== 'revealGap').map(slider => (
					<label key={slider.key} className={s.control}>
						<span>
							{slider.label} <output>{format(settings[slider.key])}</output>
						</span>
						<input
							aria-label={slider.label}
							type='range'
							min={slider.min}
							max={slider.max}
							step={slider.step}
							value={settings[slider.key]}
							onChange={event => update(slider, Number(event.target.value))}
						/>
						{slider.key === 'screenAspect' && (
							<span className={s.presets}>
								{ASPECTS.map(aspect => (
									<button
										key={aspect.label}
										type='button'
										onClick={() => update(slider, aspect.value)}
									>
										{aspect.label}
									</button>
								))}
							</span>
						)}
					</label>
				))}

				<label className={s.swatch}>
					<span>Glitch blue</span>
					<input
						aria-label='Glitch blue'
						type='color'
						value={blue}
						onChange={event => setBlue(event.target.value)}
					/>
				</label>

				<div className={s.transport}>
					<button type='button' onClick={copy}>
						{copied ? 'Copied' : 'Copy values'}
					</button>
					<button type='button' onClick={reset}>
						Reset
					</button>
				</div>
				<p>Live preview only — paste the copied values back to make them stick.</p>
			</details>
		</aside>
	);
};

// Exports
// ------------
LoaderTweaks.displayName = 'LoaderTweaks';
export default LoaderTweaks;
