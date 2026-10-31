'use strict';

// Idle motion
// ------------
// Drives the slow auto-drift that starts once the user has left the ribbon alone for 3 s.
// Wired up by app.js, which calls `activity()` on input and `update()` each frame;
// `wake` is the callback that restarts the render loop.

class IdleMotion {
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
	// (3 s plus a 10 ms margin) has passed. No timer is set for hidden tabs or reduced motion.
	activity(wake = true) {
		this.lastActivity = performance.now();
		clearTimeout(this.timer);
		if (!document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches)
			this.timer = setTimeout(() => this.wake(), 3010);
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
		this.lastActivity = performance.now() - 3000;
		clearTimeout(this.timer);
		this.wake();
	}

	// Per-frame step. Returns the scroll `delta` to apply, whether drift is `moving`, and
	// whether it has just `stopped`. `blocked` pauses it.
	update(time, dt, mode, blocked) {
		if (blocked || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			this.reset(false);
			return { delta: 0, moving: false, stopped: false };
		}

		// Switching view mode restarts the idle countdown.
		if (mode !== this.mode) {
			this.mode = mode;
			this.reset(false);
		}

		// Seconds spent idle beyond the 3 s grace period.
		const idle = Math.max(0, (time - this.lastActivity - 3000) / 1000);

		// Constant drift: leaving the page alone must never build up scroll speed.
		const desired = idle > 0 ? (mode === 'featured' ? 0.08 : 3) : 0;
		const before = this.speed;

		// Drift jumps straight to the desired speed; once idle ends it decays exponentially
		// (rate 6 per second) and snaps to zero below 0.002.
		this.speed = desired > 0 ? desired : this.speed * Math.exp(-dt * 6);
		if (desired === 0 && this.speed < 0.002) this.speed = 0;

		return { delta: this.speed * dt, moving: idle > 0 || this.speed > 0, stopped: before > 0 && this.speed === 0 };
	}
}
