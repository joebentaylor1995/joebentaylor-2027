'use strict';

// Idle motion
// ------------
// Drives the slow auto-drift that starts once the user has left the ribbon alone for 3 s.
// Wired up by app.js, which calls `activity()` on input and `update()` each frame;
// `wake` is the callback that restarts the render loop.

class IdleMotion {
	// How long the ribbon must be left alone before it drifts. The wake timer fires just after, so the frame it asks
	// for is past the grace period.
	static GRACE_MS = 3000;
	static WAKE_MARGIN_MS = 10;
	// Constant drift speeds in scroll units per second (slides for the ribbon, pixels for the grid).
	static FEATURED_DRIFT = 0.08;
	static GRID_DRIFT = 3;
	// Once idle ends, the drift decays exponentially at this rate per second and snaps to zero below the floor.
	static DECAY_RATE = 6;
	static STOP_SPEED = 0.002;
	// NOTE • Read on every input event and every frame: one live MediaQueryList rather than parsing a new query each time
	static REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

	constructor(wake) {
		this.wake = wake;
		// Current drift speed in scroll units per second.
		this.speed = 0;
		this.mode = null;
		this.timer = 0;
		this.lastActivity = performance.now();
		this.activity();
	}

	// Records user input and re-arms the timer that calls `wake` once the idle delay
	// has passed. No timer is set for hidden tabs or reduced motion.
	activity(wake = true) {
		this.lastActivity = performance.now();
		clearTimeout(this.timer);
		if (!document.hidden && !IdleMotion.REDUCED_MOTION.matches)
			this.timer = setTimeout(() => this.wake(), IdleMotion.GRACE_MS + IdleMotion.WAKE_MARGIN_MS);
		if (wake) this.wake();
	}

	// Stops any drift and restarts the idle countdown.
	reset(wake = true) {
		this.speed = 0;
		this.activity(wake);
	}

	// Host integration: arriving on the page counts as already idle, so the ribbon is drifting when it appears
	drift() {
		this.speed = 0;
		this.lastActivity = performance.now() - IdleMotion.GRACE_MS;
		clearTimeout(this.timer);
		this.wake();
	}

	// Per-frame step. Returns the scroll `delta` to apply, whether drift is `moving`, and
	// whether it has just `stopped`. `blocked` pauses it.
	update(time, dt, mode, blocked) {
		if (blocked || document.hidden || IdleMotion.REDUCED_MOTION.matches) {
			this.reset(false);
			return { delta: 0, moving: false, stopped: false };
		}

		// Switching view mode restarts the idle countdown.
		if (mode !== this.mode) {
			this.mode = mode;
			this.reset(false);
		}

		// Seconds spent idle beyond the grace period.
		const idle = Math.max(0, (time - this.lastActivity - IdleMotion.GRACE_MS) / 1000);

		// Constant drift: leaving the page alone must never build up scroll speed.
		const desired = idle > 0 ? (mode === 'featured' ? IdleMotion.FEATURED_DRIFT : IdleMotion.GRID_DRIFT) : 0;
		const before = this.speed;

		// Drift jumps straight to the desired speed, then decays once idle ends.
		this.speed = desired > 0 ? desired : this.speed * Math.exp(-dt * IdleMotion.DECAY_RATE);
		if (desired === 0 && this.speed < IdleMotion.STOP_SPEED) this.speed = 0;

		return { delta: this.speed * dt, moving: idle > 0 || this.speed > 0, stopped: before > 0 && this.speed === 0 };
	}
}
