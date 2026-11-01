'use strict';

// Velocity shape
// ------------
// Bends and tilts the ribbon in proportion to how fast it is being scrolled.
// Wired up by app.js, which feeds it the scroll velocity and renders `view()`.

class VelocityShape {
	// Scroll velocity (slides per second) at which the effect is at full strength.
	static FULL_EFFECT_VELOCITY = 8;
	static EASE_RATE = 10;
	static SETTLE_DELTA = 0.001;
	// Limits on the shaped view: rotation either way (degrees), and curve (percent).
	static MAX_ROTATION = 45;
	static MAX_CURVE = 100;

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
		// Normalise speed to 0..1, then smoothstep it so slow drift barely registers and fast flicks saturate gently.
		const speed = Math.min(1, Math.abs(velocity) / VelocityShape.FULL_EFFECT_VELOCITY);
		const strength = speed * speed * (3 - 2 * speed);

		const tilt = active && settings.velocityTilt ? Math.sign(velocity) * strength * settings.velocityTiltAmount : 0;
		const curve = active && settings.velocityCurve ? strength * settings.velocityCurveAmount : 0;

		// Frame-rate independent exponential ease.
		const ease = reduced ? 1 : 1 - Math.exp(-dt * VelocityShape.EASE_RATE);
		this.tilt += (tilt - this.tilt) * ease;
		this.curve += (curve - this.curve) * ease;

		// Snap the last sliver so `moving` can clear.
		if (Math.abs(tilt - this.tilt) < VelocityShape.SETTLE_DELTA) this.tilt = tilt;
		if (Math.abs(curve - this.curve) < VelocityShape.SETTLE_DELTA) this.curve = curve;

		this.moving = this.tilt !== tilt || this.curve !== curve;
	}

	// Returns `base` with the animated tilt and curve applied, clamped to the limits.
	view(base) {
		const { MAX_ROTATION, MAX_CURVE } = VelocityShape;
		return {
			...base,
			rotation: Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, base.rotation + this.tilt)),
			curve: Math.min(MAX_CURVE, base.curve + this.curve),
		};
	}
}
