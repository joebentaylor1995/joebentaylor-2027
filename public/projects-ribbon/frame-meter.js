'use strict';

// Frame meter
// ------------
// Live frame-timing readout in the settings panel. Wired up by app.js, which calls
// `begin()` and `end()` around each rendered frame. Needs `#settings .panel-actions` in the DOM.

// Measures delivered animation frames, not a simulated device benchmark.
class FrameMeter {
	static WINDOW_FRAMES = 120;
	// A gap over this means rendering paused between frames.
	static MAX_INTERVAL_MS = 100;
	// The readout updates at most this often, once it has enough samples.
	static REPORT_EVERY_MS = 750;
	static MIN_SAMPLES = 15;

	constructor() {
		// Rolling window of frame intervals and per-frame CPU times (ms).
		this.samples = new Float32Array(FrameMeter.WINDOW_FRAMES);
		this.cpu = new Float32Array(FrameMeter.WINDOW_FRAMES);
		this.count = 0;
		this.cursor = 0;
		this.last = 0;
		// Time of the last label update, used to throttle the readout.
		this.reported = 0;

		const panel = document.createElement('details');
		panel.className = 'settings-group';
		panel.innerHTML =
			'<summary>Performance <span>Live frame timing</span></summary><p class="grid-note" role="status">Drag continuously to measure performance.</p>';
		document.querySelector('#settings .panel-actions').before(panel);
		this.label = panel.querySelector('p');
		this.panel = panel;
	}

	// Marks the start of a frame: records the CPU start time and the gap since the previous frame.
	begin(time) {
		this.started = performance.now();
		this.interval = this.last ? time - this.last : 0;
		this.last = time;
	}

	// Marks the end of a frame, stores its sample, and refreshes the readout.
	end() {
		// After a pause, restart the window rather than pollute it.
		if (this.interval <= 0 || this.interval > FrameMeter.MAX_INTERVAL_MS) {
			this.count = 0;
			this.cursor = 0;
			return;
		}

		this.samples[this.cursor] = this.interval;
		this.cpu[this.cursor] = performance.now() - this.started;
		this.cursor = (this.cursor + 1) % FrameMeter.WINDOW_FRAMES;
		this.count = Math.min(FrameMeter.WINDOW_FRAMES, this.count + 1);

		// Only report while the panel is open.
		if (
			!this.panel.open ||
			performance.now() - this.reported < FrameMeter.REPORT_EVERY_MS ||
			this.count < FrameMeter.MIN_SAMPLES
		)
			return;
		this.reported = performance.now();

		const frames = Array.from(this.samples.subarray(0, this.count)).sort((a, b) => a - b),
			cpu = Array.from(this.cpu.subarray(0, this.count)).sort((a, b) => a - b);
		const avg = frames.reduce((a, b) => a + b, 0) / frames.length,
			p95 = frames[Math.floor((frames.length - 1) * 0.95)];

		this.label.textContent = `${Math.round(1000 / avg)} fps · ${p95.toFixed(1)} ms frame p95 · ${cpu[Math.floor(cpu.length / 2)].toFixed(1)} ms CPU median. Measure while dragging; idle video playback runs at the video's frame rate. 120 fps requires an 8.3 ms frame interval and browser support.`;
	}
}
