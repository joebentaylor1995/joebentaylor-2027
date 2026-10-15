import { expect, test } from '@playwright/test';

test('mobile uses a static portrait and preserves controls across the breakpoint', async ({ page }) => {
	await page.setViewportSize({ width: 768, height: 900 });
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (
			this: HTMLCanvasElement,
			...args: Parameters<typeof original>
		) {
			if (String(args[0]).includes('webgl')) document.documentElement.dataset.webglRequested = 'true';
			return original.apply(this, args);
		} as typeof original;
	});
	await page.goto('/?heroSettings');
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', { timeout: 15000 });
	await expect(page.locator('html')).not.toHaveAttribute('data-webgl-requested');
	const scene = page.getByTestId('hero-depth');
	const photo = scene.locator('img');
	await expect(scene).toHaveAttribute('data-ready', 'false');
	await expect(photo).toBeVisible();
	await expect(photo).toHaveAttribute('src', /portrait\.png/);
	await page.getByLabel('Mobile X position (%) value', { exact: true }).fill('12');
	await page.getByLabel('Mobile bottom offset (%) value', { exact: true }).fill('-8');
	await page.getByLabel('Mobile scale value', { exact: true }).fill('0.8');
	await page.getByLabel('Mobile rotation value', { exact: true }).fill('0');
	for (const [width, height] of [
		[390, 900],
		[768, 900],
		[1199, 800],
		[1282, 1314],
		[1283, 1314],
		[1440, 1200],
		[1280, 600],
		[1440, 900],
	]) {
		await page.setViewportSize({ width, height });
		if (width < 1283) {
			await expect(scene).toHaveAttribute('data-ready', 'false');
			await expect(photo).toBeVisible();
			await expect
				.poll(() =>
					photo.evaluate(element => {
						const matrix = new DOMMatrix(getComputedStyle(element).transform);
						return { scale: matrix.a, x: Math.round(matrix.e), y: Math.round(matrix.f) };
					})
				)
				.toEqual({ scale: 0.8, x: Math.round(width * 0.12), y: Math.round(height * -0.08) });
		} else {
			await expect(scene).toHaveAttribute('data-ready', 'true');
			await expect(photo).toBeHidden();
			const copy = await page.locator('[data-hero-content] hgroup').boundingBox();
			expect(copy?.width).toBeLessThanOrEqual(400);
		}
	}
	const exported = JSON.parse(await page.getByLabel('All hero settings JSON').inputValue());
	expect(exported.portrait.mobilePositionX).toBe(12);
	expect(exported.portrait.positionX).toBe(3);
});

test('mobile content and copyright stay anchored to the bottom', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	for (const height of [796, 900]) {
		await page.setViewportSize({ width: 440, height });
		await expect(page.locator('[data-hero-content] hgroup')).toBeVisible();
		const copyright = await page.locator('[data-copyright]').boundingBox();
		const content = await page.locator('[data-hero-content] hgroup').boundingBox();
		expect(copyright).not.toBeNull();
		expect(content).not.toBeNull();
		if (!copyright || !content) throw new Error('Missing hero content');
		expect(height - copyright.y - copyright.height).toBeCloseTo(32, 0);
		expect(content.x).toBe(32);
		expect(content.y).toBeGreaterThan(height * 0.6);
		await expect(page.getByRole('heading', { name: 'Clients include' })).toBeVisible();
	}
});
