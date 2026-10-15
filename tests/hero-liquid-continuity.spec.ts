import { expect, test } from '@playwright/test';

test('hero decoration refresh preserves water buffers while viewport resize reallocates them', async ({ page }) => {
	await page.addInitScript(() => {
		const original = WebGLRenderingContext.prototype.deleteFramebuffer;
		WebGLRenderingContext.prototype.deleteFramebuffer = function (framebuffer) {
			document.documentElement.dataset.waterBufferDeletes = String(
				Number(document.documentElement.dataset.waterBufferDeletes || 0) + 1
			);
			return original.call(this, framebuffer);
		};
	});
	await page.goto('/');
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1, { timeout: 15000 });
	const initialBuffers = Number(await page.locator('html').getAttribute('data-water-buffer-deletes'));
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', { timeout: 15000 });
	await page.waitForTimeout(300);
	const count = () => page.locator('html').getAttribute('data-water-buffer-deletes');
	const before = Number(await count());
	expect(before).toBe(initialBuffers);
	await page
		.locator('[data-hero-content]')
		.evaluate(element => (element as HTMLElement).style.setProperty('color', 'rgb(245, 245, 245)'));
	await page.waitForTimeout(500);
	expect(Number(await count())).toBe(before);
	await page.setViewportSize({ width: 1500, height: 920 });
	await expect.poll(async () => Number(await count())).toBeGreaterThan(before);
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
});
