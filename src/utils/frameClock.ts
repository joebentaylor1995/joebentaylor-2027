// Imports
// ------------
import { gsap } from 'gsap';

// Constants
// ------------
// NOTE • GSAP's own loop compares each frame against `1000 / fps` of Date.now() time. At
// 1fps its next due time is always ahead, so only the vsync driver below dispatches.
const SUPPRESSED_INTERNAL_FPS = 1;
// GSAP's default frame cap, restored when an install is replaced
const DEFAULT_FPS = 240;
// GSAP's default lag smoothing, mirrored by frameStep()
const LAG_THRESHOLD_MS = 500;
const ADJUSTED_LAG_MS = 33;

// Types
// ------------
type ClockWindow = Window & { __frameClockUninstall?: () => void };

// State
// ------------
// The current frame's requestAnimationFrame timestamp (ms) and the previous one
let timestamp = 0;
let previous = 0;
let frameId = 0;
let driving = false;
let installed = false;
// True while the vsync loop is dispatching the ticker
let vsyncDispatch = false;
// Vsync time (ms) advanced by lag-smoothed steps, for Lenis
let smoothTime = 0;
// Root timeline time (s), advanced by the same steps, and the ticker time it last saw
let rootTime = 0;
let lastTickerTime = 0;

// Exports
// ------------
// NOTE • Why this exists. GSAP times its ticker with Date.now(), which only has whole
// milliseconds, and drops any frame that arrives before its 240fps cap is due:
// - at 240Hz it skips one frame in six. Lenis, every tween and every WebGL scene freeze
//   for that frame, then jump twice as far on the next one (a steady ~40Hz stutter);
// - at 120Hz frame deltas alternate 8/9ms although frames are 8.33ms apart, so Lenis'
//   damping step, and every tween, moves unevenly by ±6%.
// Driving the same ticker from requestAnimationFrame dispatches it exactly once per
// vsync, and the rAF timestamp gives Lenis and the root timeline evenly spaced time.
// There is still one ticker: every gsap.ticker listener runs from this loop.

// The current frame's vsync timestamp (ms), for frame-time maths
export const frameTime = () => timestamp || performance.now();

// Milliseconds between this frame and the last one, on the vsync clock (0 on the first
// frame after the clock (re)starts)
export const frameDelta = () => (previous ? timestamp - previous : 0);

// frameDelta() with GSAP's default lag smoothing (lagSmoothing(500, 33)), which the ticker's
// own deltaTime already applied: a stall or a returning tab advances motion by 33ms instead
// of the whole gap. For motion integrated per frame in ticker callbacks.
export const frameStep = () => {
	const delta = frameDelta();
	return delta > LAG_THRESHOLD_MS ? ADJUSTED_LAG_MS : delta;
};

// A clock (ms) that advances by frameStep() each frame: evenly spaced like vsync time, but a
// stall or a hidden tab only moves it 33ms, as GSAP's ticker time did. Lenis steps on it, so
// a smooth scroll in flight doesn't finish in one jump after a pause.
export const smoothFrameTime = () => smoothTime;

// Drives gsap.ticker from requestAnimationFrame. Safe to call more than once.
export function installFrameClock() {
	if (installed || typeof window === 'undefined') return;
	installed = true;

	// A re-evaluated copy of this module (Fast Refresh) takes over from the old one, whose
	// loop would otherwise keep ticking alongside it
	const registry = window as ClockWindow;
	registry.__frameClockUninstall?.();

	const ticker = gsap.ticker;
	smoothTime = performance.now();
	rootTime = ticker.time;
	lastTickerTime = ticker.time;

	// One dispatch per vsync, timed by the frame's own timestamp
	const frame = (now: number) => {
		frameId = requestAnimationFrame(frame);
		previous = timestamp;
		timestamp = now;
		smoothTime += frameStep();
		vsyncDispatch = true;
		try {
			ticker.tick();
		} finally {
			vsyncDispatch = false;
		}
	};
	const start = () => {
		if (driving) return;
		driving = true;
		// A fresh run has no previous frame to measure from
		timestamp = 0;
		frameId = requestAnimationFrame(frame);
	};
	const stop = () => {
		driving = false;
		cancelAnimationFrame(frameId);
	};

	// NOTE • The root timeline renders at its own time, built from the same lag-smoothed vsync
	// steps, so tweens advance by whole frames. It never re-anchors to GSAP's Date.now() time,
	// which drifts against the vsync clock and would make every tween jump when it caught up.
	// A dispatch from GSAP's own loop (a frame overdue by a whole second) advances it by GSAP's
	// own lag-smoothed delta instead.
	const renderRoot = (time: number) => {
		rootTime += vsyncDispatch ? frameStep() / 1000 : Math.max(0, time - lastTickerTime);
		lastTickerTime = time;
		gsap.updateRoot(rootTime);
	};
	ticker.remove(gsap.updateRoot);
	ticker.add(renderRoot, false, true);

	// Follow GSAP's own sleep/wake (it sleeps when nothing is animating), so an idle page
	// still stops requesting frames
	const originalSleep = ticker.sleep;
	const originalWake = ticker.wake;
	const sleep = originalSleep.bind(ticker);
	const wake = originalWake.bind(ticker);
	ticker.sleep = () => {
		sleep();
		stop();
	};
	ticker.wake = () => {
		wake();
		start();
	};

	ticker.fps(SUPPRESSED_INTERNAL_FPS);
	start();

	registry.__frameClockUninstall = () => {
		stop();
		ticker.remove(renderRoot);
		ticker.add(gsap.updateRoot);
		ticker.sleep = originalSleep;
		ticker.wake = originalWake;
		ticker.fps(DEFAULT_FPS);
	};
}
