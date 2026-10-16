'use client';

// Imports
// ------------
import { useEffect, useState } from 'react';
import { INTRO_FPS } from '../intro';
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
type NumericKey = keyof LoaderSettings;

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

	// Effects
	// NOTE • Mirrors the live timeline's playhead into the scrubber
	useEffect(() => {
		let frame = 0;
		const tick = () => {
			const tl = loaderControl.timeline;
			if (tl) {
				setTime(tl.time());
				setDuration(tl.duration());
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
		else if (loaderControl.timeline?.paused()) seek(loaderControl.timeline.time());
	};

	const togglePlay = () => {
		const tl = loaderControl.timeline;
		if (!tl) return;
		if (playing) tl.pause();
		else if (tl.progress() >= 1) replay();
		else {
			seek(tl.time());
			tl.play();
		}
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
						{playing ? 'Pause' : 'Play'}
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
						onChange={event => seek(Number(event.target.value))}
					/>
				</label>

				{SLIDERS.map(slider => (
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
