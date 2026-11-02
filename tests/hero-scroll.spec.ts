// Imports
// ------------

import { defaultSettings } from '../src/components/Hero/Background/effect-settings';
import { marqueePhrases } from '../src/components/Hero/Background/marquee-decoration';
import { ScrollMotion } from '../src/components/Hero/Background/scroll-motion';
import { expect, test } from './helpers/test';

// Tests
// ------------
// ScrollMotion unit tests: these run in Node with no page. They protect the wheel-gesture logic behind
// the hero marquee phrases, portrait pulse and colour switch.
// Marquee phrase advances once per gesture (a burst of wheel events), when direction reverses, and wraps.
test('marquee advances once per gesture, on reversal, and wraps through every phrase', () => {
	const motion = new ScrollMotion();
	expect(marqueePhrases[motion.gesture]).toBe('Trusted by');
	motion.add(10);
	motion.step(1 / 60);
	motion.add(10);
	expect(motion.gesture).toBe(1);
	expect(marqueePhrases[motion.gesture]).toBe('Loved by');
	motion.add(-10);
	expect(motion.gesture).toBe(2);
	// A pause longer than the gesture gap starts a new gesture
	for (let gesture = 3; gesture <= 7; gesture++) {
		motion.step(defaultSettings.gestureGap + 0.01);
		motion.add(-10);
		expect(motion.gesture).toBe(gesture);
	}
	expect(marqueePhrases[motion.gesture % marqueePhrases.length]).toBe('Trusted by');
});

// The colour only switches once velocity passes the configured maximum, in either direction.
test('colour waits for maximum velocity in either direction', () => {
	for (const direction of [-1, 1]) {
		const motion = new ScrollMotion();
		// Stay above 80% but below the configured maximum, then cross it.
		for (let i = 0; i < 180; i++) {
			motion.add((direction * defaultSettings.fastRate * 0.9) / 60);
			motion.step(1 / 60);
			expect(motion.colourTarget).toBe(0);
		}
		for (let i = 0; i < 60; i++) {
			motion.add((direction * defaultSettings.fastRate * 1.2) / 60);
			motion.step(1 / 60);
		}
		expect(motion.colourTarget).toBe(1);
	}
});

// Scrolling up and down are mirror images: same pulse, opposite marquee velocity.
test('upward and downward gestures produce the same portrait pulse and opposite marquee velocity', () => {
	const down = new ScrollMotion();
	const up = new ScrollMotion();
	let peak = 0;
	for (let i = 0; i < 180; i++) {
		down.add(400);
		up.add(-400);
		down.step(1 / 60);
		up.step(1 / 60);
		peak = Math.max(peak, up.pulse);
		expect(up.pulse).toBeCloseTo(down.pulse, 8);
		expect(up.velocity).toBeCloseTo(-down.velocity, 8);
		expect(up.colourTarget).toBe(down.colourTarget);
	}
	expect(peak).toBeGreaterThan(0.8);
	expect(up.pulse).toBeLessThan(0.001);
});

// Holding a fast scroll lets the depth pulse fall back to rest while the colour stays switched, and
// reversing switches it back.
test('sustained fast scroll releases the depth pulse and switches colour only once', () => {
	const motion = new ScrollMotion();
	let peak = 0;
	for (let i = 0; i < 180; i++) {
		motion.add(400);
		motion.step(1 / 60);
		peak = Math.max(peak, motion.pulse);
	}
	expect(peak).toBeGreaterThan(0.8);
	expect(motion.pulse).toBeLessThan(0.001);
	expect(motion.colourTarget).toBe(1);
	expect(motion.velocity).toBeGreaterThan(0.8);
	// Let it settle, then scroll the other way
	for (let i = 0; i < 40; i++) motion.step(1 / 60);
	for (let i = 0; i < 30; i++) {
		motion.add(-400);
		motion.step(1 / 60);
	}
	expect(motion.colourTarget).toBe(0);
	expect(motion.velocity).toBeLessThan(-0.8);
});

// Slow scrolling never triggers the colour switch, and velocity decays to a settled state at rest.
test('gentle scrolling preserves colour and velocity decays at rest', () => {
	const motion = new ScrollMotion();
	for (let i = 0; i < 60; i++) {
		motion.add(5);
		motion.step(1 / 60);
	}
	expect(motion.colourTarget).toBe(0);
	expect(motion.velocity).toBeGreaterThan(0);
	for (let i = 0; i < 180; i++) motion.step(1 / 60);
	expect(motion.settled).toBe(true);
});

// Browser check of the same behaviour: fast wheel gestures drive the colour portrait up and back down in
// the live shader, with no GL errors.
test('fast gestures alternate the rendered colour portrait and release sustained scroll', async ({
	page,
}, testInfo) => {
	await page.goto('/');
	const effect = page.getByTestId('hero-depth');
	await expect(effect).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
	const canvas = effect.locator('canvas');
	// Fires 90 wheel events ~16ms apart (about a second of continuous scrolling)
	const gesture = async (delta: number) =>
		canvas.evaluate(async (element, amount) => {
			for (let i = 0; i < 90; i++) {
				element.dispatchEvent(new WheelEvent('wheel', { deltaY: amount, bubbles: true }));
				await new Promise(resolve => setTimeout(resolve, 16));
			}
		}, delta);
	// Reads colourMix and scrollVelocity from the live program
	const state = () =>
		canvas.evaluate(element => {
			const gl = (element as HTMLCanvasElement).getContext('webgl');
			if (!gl) throw new Error('WebGL unavailable');
			const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
			const colour = gl.getUniformLocation(program, 'colourMix');
			const pulse = gl.getUniformLocation(program, 'scrollVelocity');
			if (!colour || !pulse) throw new Error('Scroll uniforms missing');
			return {
				colour: gl.getUniform(program, colour) as number,
				pulse: gl.getUniform(program, pulse) as number,
				error: gl.getError(),
			};
		});

	// A fast downward gesture fully brings in the colour portrait and the pulse has already fallen back
	await gesture(500);
	await expect.poll(async () => (await state()).colour).toBeGreaterThan(0.95);
	expect((await state()).pulse).toBeLessThan(0.02);
	await page.screenshot({ path: testInfo.outputPath('colour-portrait.png') });

	// A fast upward gesture takes it back out
	await page.waitForTimeout(500);
	await gesture(-500);
	await expect.poll(async () => (await state()).colour).toBeLessThan(0.05);
	expect((await state()).error).toBe(0);
});
