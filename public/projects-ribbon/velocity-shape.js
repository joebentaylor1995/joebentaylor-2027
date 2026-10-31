'use strict';

// Velocity shape
// ------------
// Bends and tilts the ribbon in proportion to how fast it is being scrolled.
// Wired up by app.js, which feeds it the scroll velocity and renders `view()`.

class VelocityShape {
	constructor() {
		// Extra rotation (degrees) and curve added on top of the base view.
		this.tilt = 0;
		this.curve = 0;
		// True while either value is still easing, so the caller keeps rendering.
		this.moving = false;
	}

	// Advances the easing by `dt` seconds towards the targets implied by `velocity`.
	// `settings` supplies the on/off flags and amounts; `active` gates the whole effect.
	update(dt, velocity, settings, active, reduced) {
		// Normalise speed to 0..1 (a velocity of 8 is full effect), then smoothstep it
		// so slow drift barely registers and fast flicks saturate gently.
		const speed = Math.min(1, Math.abs(velocity) / 8);
		const strength = speed * speed * (3 - 2 * speed);

		const tilt = active && settings.velocityTilt ? Math.sign(velocity) * strength * settings.velocityTiltAmount : 0;
		const curve = active && settings.velocityCurve ? strength * settings.velocityCurveAmount : 0;

		// Frame-rate independent exponential ease.
		const ease = reduced ? 1 : 1 - Math.exp(-dt * 10);
		this.tilt += (tilt - this.tilt) * ease;
		this.curve += (curve - this.curve) * ease;

		// Snap the last sliver so `moving` can clear.
		if (Math.abs(tilt - this.tilt) < 0.001) this.tilt = tilt;
		if (Math.abs(curve - this.curve) < 0.001) this.curve = curve;

		this.moving = this.tilt !== tilt || this.curve !== curve;
	}

	// Returns `base` with the animated tilt and curve applied, clamped to rotation ±45 and curve ≤ 100.
	view(base) {
		return {
			...base,
			rotation: Math.max(-45, Math.min(45, base.rotation + this.tilt)),
			curve: Math.min(100, base.curve + this.curve),
		};
	}
}
