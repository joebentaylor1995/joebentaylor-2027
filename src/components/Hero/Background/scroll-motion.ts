import { type DepthSettings, defaultSettings } from './effect-settings';

export class ScrollMotion {
	constructor(private getSettings: () => DepthSettings = () => defaultSettings) {}
	private input = 0;
	private idle = Infinity;
	private age = 0;
	private rate = 0;
	private peak = 0;
	private returning = false;
	private switched = false;
	colourTarget = 0;
	colour = 0;
	pulse = 0;
	velocity = 0;
	gesture = 0;
	private direction = 0;

	add(delta: number) {
		if (!Number.isFinite(delta) || delta === 0) return;
		if (this.idle > this.getSettings().gestureGap || Math.sign(delta) !== this.direction) this.gesture++;
		this.direction = Math.sign(delta);
		if (this.idle > this.getSettings().gestureGap) {
			this.age = 0;
			this.peak = 0;
			this.returning = false;
			this.switched = false;
		}
		if (Math.sign(delta) !== Math.sign(this.rate)) this.rate = 0;
		this.idle = 0;
		this.input += delta;
	}

	step(dt: number) {
		const s = this.getSettings();
		const input = this.input;
		this.input = 0;
		this.idle += dt;
		this.age += dt;
		this.rate += (input / dt - this.rate) * (1 - Math.exp(-dt / s.velocitySmoothing));
		if (Math.abs(this.rate) < 0.01) this.rate = 0;
		this.velocity = this.rate / (s.velocityScale + Math.abs(this.rate));
		const measured = Math.min(1, Math.abs(this.rate) / s.fastRate);
		if (s.colourOn && !this.switched && this.idle < s.gestureGap && measured >= s.colourThreshold) {
			this.colourTarget = 1 - this.colourTarget;
			this.switched = true;
		}
		// One depth pulse per gesture in either direction; momentum cannot hold it open.
		if (!this.returning) this.peak = Math.max(this.peak, measured);
		if (this.pulse >= s.pulsePeak || this.age >= s.pulseDuration || this.idle > s.gestureGap) this.returning = true;
		const goal = this.returning ? 0 : this.peak;
		this.pulse += (goal - this.pulse) * (1 - Math.exp(-dt / (goal > this.pulse ? s.pulseAttack : s.pulseRelease)));
		if (this.returning && this.pulse < 0.0001) this.pulse = 0;
		if (!s.colourOn) this.colourTarget = 0;
		this.colour += (this.colourTarget - this.colour) * (1 - Math.exp(-dt / s.colourTransition));
		if (Math.abs(this.colourTarget - this.colour) < 0.0001) this.colour = this.colourTarget;
	}

	reset() {
		this.input = this.rate = this.peak = this.pulse = this.velocity = 0;
		this.idle = Infinity;
		this.returning = true;
	}

	get settled() {
		return this.rate === 0 && this.pulse === 0 && this.colour === this.colourTarget;
	}
}
