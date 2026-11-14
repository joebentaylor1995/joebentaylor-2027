'use client';

// Imports
// ------------
import { mq } from '@tackl';
import { prepareNavigationScene } from '@utils/navigationScene';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type WaveEase, waveEase, waveEasings } from '../easing';
import {
	holdWave,
	readWaveSettings,
	saveWaveSettings,
	WAVE_DURATION,
	WAVE_SETTINGS_CHANGED,
	WAVE_TIMELINE,
	type WaveSettings,
	waveDefaults,
	waveTimeline,
} from '../settings';
import { lensEnvelope } from '../texture';

// Styles
// ------------
import s from './styles.module.scss';

// Constants
// ------------
// One step of the frame buttons, in ms of the wave's own timeline, and the frames a Shift-arrow steps
const FRAME_MS = 1000 / 60;
const BIG_STEP = 10;
// Slow-motion choices for playing a wave, as playback rates
const RATES = [1, 0.5, 0.25, 0.1];
// The duration slider stops short of the saved maximum: longer waves aren't worth tuning
const TUNER_DURATION_MAX = 2000;
// The curve graph's drawing size (it scales to the panel) and how many points draw each curve
const GRAPH_WIDTH = 280;
const GRAPH_HEIGHT = 110;
const SAMPLES = 64;
// What a routed press can operate (see the pointer effect)
const CONTROLS = 'button, a, input, select';
// The pages to wave between. The links keep ?waveTuner, so a reload keeps the tuner open.
const ROUTES = [
	{ label: 'Home', path: '/', href: '/?waveTuner' },
	{ label: 'Projects', path: '/projects', href: '/projects/?waveTuner' },
];
const KEYS_HINT = 'Keys while a wave runs: Space play/hold, ←/→ a frame (Shift: ten), Enter finish.';

// Helpers
// ------------
// An SVG path for `curve` across the graph: time runs left to right, 0–1 runs bottom to top
const plot = (curve: (progress: number) => number) =>
	Array.from({ length: SAMPLES + 1 }, (_, index) => {
		const progress = index / SAMPLES;
		return `${index ? 'L' : 'M'}${(progress * GRAPH_WIDTH).toFixed(1)},${((1 - curve(progress)) * GRAPH_HEIGHT).toFixed(1)}`;
	}).join(' ');

// Every clock animation of the running wave (new page, old page), or none
const clocks = () => waveTimeline.current?.animations ?? [];

// Moves the running wave by whole frames, read from its own clock, and holds it there: the new
// point, or null without a wave
function stepBy(frames: number) {
	const current = waveTimeline.current;
	const clock = current?.animations[0];
	if (!current || !clock) return null;
	const point = Math.min(1, Math.max(0, (Number(clock.currentTime ?? 0) + frames * FRAME_MS) / current.duration));
	holdWave(point);
	return point;
}

// Plays a held wave on at the tuner's speed, or holds a playing one. From the very end, play()
// would rewind, so it replays from the start.
function togglePlay() {
	const animations = clocks();
	const isPlaying = animations[0]?.playState === 'running';
	for (const animation of animations) {
		if (isPlaying) animation.pause();
		else {
			animation.playbackRate = waveTimeline.rate;
			animation.play();
		}
	}
}

// Ends the running wave, so a navigation can go ahead (React waits for it) or a fresh one start
function finish() {
	for (const animation of clocks()) animation.finish();
}

// Whether a viewport point lies inside an element's box
function covers(element: Element, x: number, y: number) {
	const box = element.getBoundingClientRect();
	return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

// Sets a range input as dragging it to `x` would. The native setter goes round React's value
// tracking, so the input event reaches the slider's onChange like a real drag.
function dragRange(input: HTMLInputElement, x: number) {
	const box = input.getBoundingClientRect();
	const min = Number(input.min);
	const max = Number(input.max);
	const step = Number(input.step) || 1;
	const raw = min + (max - min) * Math.min(1, Math.max(0, (x - box.left) / box.width));
	const value = min + Math.round((raw - min) / step) * step;
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, String(value));
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Component
// ------------
// A tuner for the page-change wave alone (opened with ?waveTuner). It drives the real transition:
// hold a wave at any point, scrub both pages along its timeline, step it frame by frame or play it
// in slow motion, and pick the easing and duration. Those two are saved in this browser for the
// live site, as the ?globalSettings panel saves them; the playhead and speed are never saved.
export default function WaveTuner() {
	// Refs
	const jacketRef = useRef<HTMLElement>(null);

	// State
	const [settings, setSettings] = useState<WaveSettings>(waveDefaults);
	// The running wave's own easing and duration (the saved ones may have moved on), or null
	const [liveWave, setLiveWave] = useState<{ ease: WaveEase; duration: number } | null>(null);
	// `point` is the chosen spot on the timeline (0–1); `playhead` is a running wave's own position
	const [point, setPoint] = useState(0);
	const [playhead, setPlayhead] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isHolding, setIsHolding] = useState(true);
	const [isNarrow, setIsNarrow] = useState(false);
	const [rate, setRate] = useState(1);
	const [status, setStatus] = useState(`Navigate to start a wave; Hold pauses it at the playhead. ${KEYS_HINT}`);

	// Derived
	const isLive = liveWave !== null;
	const shown = liveWave ?? settings;
	const ease = useMemo(() => waveEase(shown.ease), [shown.ease]);
	const revealPath = useMemo(() => plot(ease), [ease]);
	const bendPath = useMemo(() => plot(progress => lensEnvelope(ease(progress))), [ease]);
	const position = isLive ? playhead : point;
	const eased = ease(position);

	// Effects
	// Load the saved settings after mount (localStorage is unavailable during server render), and
	// follow saves made elsewhere (the ?globalSettings panel)
	useEffect(() => {
		const reload = () => setSettings(readWaveSettings());
		reload();
		window.addEventListener(WAVE_SETTINGS_CHANGED, reload);
		return () => window.removeEventListener(WAVE_SETTINGS_CHANGED, reload);
	}, []);

	// Phones crossfade instead of waving, so there is nothing to hold there
	useEffect(() => {
		const query = matchMedia(mq.down.m);
		const sync = () => setIsNarrow(query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	}, []);

	// The next wave starts held at the chosen point, at the chosen speed
	useEffect(() => {
		waveTimeline.hold = isHolding ? point : null;
	}, [isHolding, point]);
	useEffect(() => {
		waveTimeline.rate = rate;
		for (const animation of clocks()) animation.updatePlaybackRate(rate);
	}, [rate]);

	// Let go of the wave when the tuner closes
	useEffect(
		() => () => {
			finish();
			waveTimeline.hold = null;
			waveTimeline.rate = 1;
		},
		[]
	);

	// Follow the running wave's clock every frame while there is one
	useEffect(() => {
		let raf = 0;
		const follow = () => {
			const current = waveTimeline.current;
			if (!current) {
				setIsPlaying(false);
				return;
			}
			const [clock] = current.animations;
			setPlayhead(Math.min(1, Number(clock?.currentTime ?? 0) / current.duration));
			setIsPlaying(clock?.playState === 'running');
			raf = requestAnimationFrame(follow);
		};
		const attach = () => {
			const current = waveTimeline.current;
			setLiveWave(current && { ease: current.ease, duration: current.duration });
			cancelAnimationFrame(raf);
			follow();
		};
		attach();
		window.addEventListener(WAVE_TIMELINE, attach);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener(WAVE_TIMELINE, attach);
		};
	}, []);

	// NOTE • React holds every navigation until the running view transition finishes, so a held wave
	// would stall any link or Back press for a minute. Let it go the moment one starts.
	useEffect(() => {
		const release = (event: Event) => {
			if (!waveTimeline.current) return;
			const isLink =
				event.type === 'popstate' || (event.target instanceof Element && event.target.closest('a[href]'));
			if (isLink) finish();
		};
		document.addEventListener('click', release, true);
		window.addEventListener('popstate', release, true);
		return () => {
			document.removeEventListener('click', release, true);
			window.removeEventListener('popstate', release, true);
		};
	}, []);

	// Keyboard, while a wave runs: Space plays or holds, ←/→ step a frame (ten with Shift), Enter finishes.
	// A focused button keeps Space and Enter (it would also press itself), and a focused link keeps Enter.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!waveTimeline.current || event.metaKey || event.ctrlKey || event.altKey) return;
			const focused = event.target instanceof Element ? event.target : null;
			const isOnButton = focused?.closest('button') != null;
			const isOnLink = focused?.closest('a') != null;
			const frames = event.shiftKey ? BIG_STEP : 1;
			if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				const next = stepBy(event.key === 'ArrowLeft' ? -frames : frames);
				if (next !== null) setPoint(next);
			} else if (event.key === ' ' && !isOnButton) togglePlay();
			else if (event.key === 'Enter' && !isOnButton && !isOnLink) finish();
			else return;
			event.preventDefault();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	// NOTE • While a view transition runs, Chrome hit-tests the document alone, so a press on the
	// tuner lands on <body> and never reaches its controls. Route such presses (primary button,
	// during a wave) to the control under the pointer, so the tuner still works while it holds one.
	useEffect(() => {
		const jacket = jacketRef.current;
		if (!jacket) return;
		let dragging: HTMLInputElement | null = null;

		const press = (event: PointerEvent) => {
			const { target, clientX: x, clientY: y } = event;
			if (!waveTimeline.current || event.button !== 0 || !(target instanceof Node)) return;
			if (jacket.contains(target) || !covers(jacket, x, y)) return;
			const control =
				[...jacket.querySelectorAll<HTMLElement>(CONTROLS)].find(element => covers(element, x, y)) ??
				[...jacket.querySelectorAll('label')]
					.find(label => covers(label, x, y))
					?.querySelector<HTMLInputElement>('input[type=checkbox]');
			if (!control) return;
			event.preventDefault();
			if (control instanceof HTMLInputElement && control.type === 'range') {
				dragging = control;
				dragRange(control, x);
			} else if (control instanceof HTMLSelectElement) {
				control.focus();
				try {
					control.showPicker();
				} catch {
					// Without a picker the focused select still answers the arrow keys.
				}
			} else control.click();
		};
		const drag = (event: PointerEvent) => {
			if (!dragging) return;
			if (event.buttons === 0) dragging = null;
			else dragRange(dragging, event.clientX);
		};
		const release = () => {
			dragging = null;
		};

		window.addEventListener('pointerdown', press, true);
		window.addEventListener('pointermove', drag, true);
		window.addEventListener('pointerup', release, true);
		return () => {
			window.removeEventListener('pointerdown', press, true);
			window.removeEventListener('pointermove', drag, true);
			window.removeEventListener('pointerup', release, true);
		};
	}, []);

	// Handlers
	// Save easing or duration over what is stored; a running wave keeps the settings it started with
	const update = (changes: Partial<WaveSettings>) => {
		const saved = saveWaveSettings(changes);
		if (!saved) {
			setStatus('Browser storage is unavailable; settings could not be saved.');
			return;
		}
		setSettings(saved);
		setStatus(isLive ? 'Saved. The next wave uses it.' : 'Saved. Navigate to try it.');
	};

	const scrub = (next: number) => {
		setPoint(next);
		holdWave(next);
	};

	const step = (frames: number) => {
		const next = stepBy(frames);
		if (next !== null) setPoint(next);
	};

	const copySettings = () => {
		const text = JSON.stringify({ ease: settings.ease, duration: settings.duration });
		if (!navigator.clipboard) {
			setStatus(text);
			return;
		}
		navigator.clipboard.writeText(text).then(
			() => setStatus(`Copied ${text}`),
			() => setStatus(text)
		);
	};

	// Render
	return (
		<aside
			ref={jacketRef}
			className={s.jacket}
			aria-label='Wave tuner'
			data-type='captionL'
			data-lenis-prevent
			data-scroll-lock-exempt
		>
			<p className={s.title}>
				Wave tuner <output>{isLive ? (isPlaying ? 'playing' : 'held') : 'idle'}</output>
			</p>

			<svg
				className={s.graph}
				viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
				preserveAspectRatio='none'
				aria-hidden='true'
			>
				<path className={s.bend} d={bendPath} />
				<path className={s.reveal} d={revealPath} />
				<line
					className={s.playhead}
					x1={position * GRAPH_WIDTH}
					x2={position * GRAPH_WIDTH}
					y1={0}
					y2={GRAPH_HEIGHT}
				/>
			</svg>
			<p className={s.legend}>
				<span data-curve='reveal'>Reveal {Math.round(eased * 100)}%</span>
				<span data-curve='bend'>Bend {Math.round(lensEnvelope(eased) * 100)}%</span>
				<span>
					{Math.round(position * shown.duration)} / {shown.duration}ms
				</span>
			</p>

			<label className={s.control}>
				<span>Timeline</span>
				<input
					type='range'
					aria-label='Timeline'
					min={0}
					max={1}
					step={0.001}
					value={position}
					onChange={event => scrub(Number(event.target.value))}
				/>
			</label>

			<div className={s.actions}>
				<button type='button' disabled={!isLive} onClick={() => step(-1)} aria-label='Back one frame'>
					−1f
				</button>
				<button type='button' disabled={!isLive} onClick={togglePlay}>
					{isPlaying ? 'Pause' : playhead >= 1 ? 'Replay' : 'Play'}
				</button>
				<button type='button' disabled={!isLive} onClick={() => step(1)} aria-label='Forward one frame'>
					+1f
				</button>
				<button type='button' disabled={!isLive} onClick={finish}>
					Finish
				</button>
			</div>

			<div className={s.actions}>
				<label>
					<input type='checkbox' checked={isHolding} onChange={event => setIsHolding(event.target.checked)} />{' '}
					Hold new waves at the playhead
				</label>
				<label>
					Speed{' '}
					<select
						aria-label='Playback speed'
						value={rate}
						onChange={event => setRate(Number(event.target.value))}
					>
						{RATES.map(value => (
							<option key={value} value={value}>
								{value}×
							</option>
						))}
					</select>
				</label>
			</div>

			<label className={s.control}>
				<span>Easing</span>
				<select
					aria-label='Wave easing'
					value={settings.ease}
					onChange={event => update({ ease: event.target.value as WaveEase })}
				>
					{Object.entries(waveEasings).map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
			</label>
			<label className={s.control}>
				<span>
					Duration <output>{settings.duration}ms</output>
				</span>
				<input
					type='range'
					aria-label='Duration'
					min={WAVE_DURATION.min}
					max={TUNER_DURATION_MAX}
					step={WAVE_DURATION.step}
					value={settings.duration}
					onChange={event => update({ duration: Number(event.target.value) })}
				/>
			</label>

			<div className={s.actions}>
				{ROUTES.map(({ label, path, href }) => (
					<Link key={path} href={href} onNavigate={() => prepareNavigationScene(path)}>
						{label}
					</Link>
				))}
				<button type='button' onClick={copySettings}>
					Copy
				</button>
				<button
					type='button'
					onClick={() => update({ ease: waveDefaults.ease, duration: waveDefaults.duration })}
				>
					Reset
				</button>
			</div>
			<p role='status'>
				{isNarrow ? 'Phones crossfade instead of waving: widen the window to tune the wave.' : status}
			</p>
		</aside>
	);
}
