import { expect, test } from './helpers/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

test('mobile keeps the detailed portrait without running the wave', async ({ page }) => {
	await page.addInitScript(() => {
		const names = new WeakMap<WebGLUniformLocation, string>();
		const locate = WebGLRenderingContext.prototype.getUniformLocation;
		const uniform = WebGLRenderingContext.prototype.uniform1f;
		const state = {
			movingWidths: [] as number[],
			settledWidth: 0,
			fluid: false,
			heroRasterDraws: 0,
			floatTargets: 0,
		};
		const upload = WebGLRenderingContext.prototype.texImage2D;
		WebGLRenderingContext.prototype.texImage2D = function (...args: unknown[]) {
			if (args[7] === this.FLOAT) state.floatTargets++;
			Reflect.apply(upload, this, args);
		};
		const fillText = CanvasRenderingContext2D.prototype.fillText;
		CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof fillText>) {
			if (args[0].includes('Building')) state.heroRasterDraws++;
			Reflect.apply(fillText, this, args);
		};
		Object.assign(window, { waveBudget: state });
		WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
			const location = locate.call(this, program, name);
			if (location) names.set(location, name);
			return location;
		};
		WebGLRenderingContext.prototype.uniform1f = function (location, value) {
			const name = location && names.get(location);
			if (name === 'waterReveal') {
				if (value > 0 && value < 1) state.movingWidths.push(this.canvas.width);
				if (value === 1) state.settledWidth = this.canvas.width;
			}
			if (name === 'fluidActive' && value > 0) state.fluid = true;
			uniform.call(this, location, value);
		};
	});
	await page.goto('/');
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', { timeout: 20000 });
	const state = await page.evaluate(
		() =>
			(
				window as unknown as {
					waveBudget: {
						movingWidths: number[];
						settledWidth: number;
						fluid: boolean;
						heroRasterDraws: number;
						floatTargets: number;
					};
				}
			).waveBudget
	);
	expect(state.movingWidths).toEqual([]);
	expect(state.settledWidth).toBe(780);
	expect(state.fluid).toBe(false);
	expect(state.heroRasterDraws).toBe(0);
	expect(state.floatTargets).toBe(0);
	await expect(page.locator('[data-hero-content]')).toHaveCSS('opacity', '1');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true');
	await page.screenshot({ path: 'test-results/mobile-wave-settled.png' });
});
