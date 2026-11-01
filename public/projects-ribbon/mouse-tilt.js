'use strict';

// Mouse tilt
// ------------
// Eases the ribbon's rotation (degrees) towards an angle chosen by the pointer's
// vertical position. Wired up by app.js.

// Keep the saved manual tilt separate from the animated presentation angle.
class MouseTilt {
	static EASE_RATE = 10;
	// Degrees from the goal at which the rotation snaps to it.
	static SETTLE_DEGREES = 0.001;

	constructor(rotation) {
		this.rotation = rotation;
		// Pointer height as 0 (top) to 1 (bottom); 0.5 is neutral.
		this.y = 0.5;
		// True while the rotation is still easing, so the caller keeps rendering.
		this.moving = false;
	}

	// Advances the easing by `dt` seconds and returns the current rotation.
	// With `enabled` the goal comes from the pointer (`min` at the top, `max` at the bottom),
	// otherwise it is the user's `manual` angle. `reduced` skips the easing.
	update(dt, enabled, manual, reduced, min = -6, max = 6) {
		const y = Math.max(0, Math.min(1, this.y));

		// Independent limits retain a neutral centre even with asymmetric angles.
		const goal = enabled ? (y < 0.5 ? min * (1 - y * 2) : max * (y * 2 - 1)) : manual;

		// Frame-rate independent exponential ease: the gap closes by 1 - e^(-rate dt) each frame.
		this.rotation += (goal - this.rotation) * (reduced ? 1 : 1 - Math.exp(-dt * MouseTilt.EASE_RATE));
		this.moving = Math.abs(goal - this.rotation) > MouseTilt.SETTLE_DEGREES;

		// Snap the last sliver so the render loop can settle.
		if (!this.moving) this.rotation = goal;

		return this.rotation;
	}
}
