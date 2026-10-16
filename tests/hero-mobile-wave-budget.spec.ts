import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

test('mobile wave reduces transient pixels then restores portrait detail', async ({ page }) => {
	await page.addInitScript(() => {
		const names = new WeakMap<WebGLUniformLocation, string>();
		const locate = WebGLRenderingContext.prototype.getUniformLocation;
		const uniform = WebGLRenderingContext.prototype.uniform1f;
		const state = { movingWidths: [] as number[], settledWidth: 0, fluid: false };
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
			(window as unknown as { waveBudget: { movingWidths: number[]; settledWidth: number; fluid: boolean } })
				.waveBudget
	);
	expect(state.movingWidths.length).toBeGreaterThan(2);
	expect(new Set(state.movingWidths)).toEqual(new Set([585]));
	expect(state.settledWidth).toBe(780);
	expect(state.fluid).toBe(false);
	await page.screenshot({ path: 'test-results/mobile-wave-settled.png' });
});
