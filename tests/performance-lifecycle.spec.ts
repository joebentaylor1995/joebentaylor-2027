import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1024, 1440]) {
	test(`responsive type and off-screen WebGL suspension at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		await page.addInitScript(() => {
			const counts = new WeakMap<HTMLCanvasElement, number>();
			Object.assign(window, { webglDrawCounts: counts });
			for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
				for (const method of ['drawArrays', 'drawElements'] as const) {
					const original = context.prototype[method];
					context.prototype[method] = function (...args: number[]) {
						const canvas = this.canvas as HTMLCanvasElement;
						counts.set(canvas, (counts.get(canvas) ?? 0) + 1);
						Reflect.apply(original, this, args);
					};
				}
			}
		});
		await page.goto('/?modalSettings');
		expect(
			await page.evaluate(() =>
				performance
					.getEntriesByType('resource')
					.some(entry => entry.name.includes('/images/map/blue-gradient.png'))
			)
		).toBe(false);
		await expect(page.locator('html')).toHaveCSS('font-size', width >= 700 && width < 1024 ? '16px' : '10px');
		const settings = page.getByRole('complementary', { name: 'Modal settings' });
		const panel = page.locator('#profile-panel');
		const count = (selector: string) =>
			page.locator(selector).evaluate(el => {
				const counts = (window as unknown as { webglDrawCounts: WeakMap<HTMLCanvasElement, number> })
					.webglDrawCounts;
				return Array.from(el.querySelectorAll('canvas')).reduce(
					(sum, canvas) => sum + (counts.get(canvas) ?? 0),
					0
				);
			});
		for (const [button, selector] of [
			['Show Recognition', '[data-recognition]'],
			['Show rain', '[data-connect]'],
			['Show Design toolkit', '[data-toolkit="Design toolkit"]'],
			['Show globe', '[data-globe]'],
		]) {
			await settings.getByRole('button', { name: button, exact: true }).click();
			await expect(page.locator(selector)).toHaveAttribute('data-state', 'ready');
			await page.waitForTimeout(400);
			if (button === 'Show Recognition' || button === 'Show rain') {
				const before = await count(selector);
				await expect.poll(() => count(selector)).toBeGreaterThan(before);
			}
			await panel.evaluate(el => {
				el.scrollTop = 0;
			});
			await page.waitForTimeout(350);
			const paused = await count(selector);
			await page.waitForTimeout(500);
			expect(await count(selector)).toBe(paused);
		}
		expect(await panel.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(
			await panel.evaluate(el => el.clientWidth)
		);
		if (width === 768) {
			await settings.getByRole('button', { name: 'Show rain', exact: true }).click();
			await expect(page.locator('[data-connect] nav')).toHaveCSS('max-width', 'none');
			await page.screenshot({ path: 'test-results/tablet-profile.png' });
		}
	});
}
