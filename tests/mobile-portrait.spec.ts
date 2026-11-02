// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects the portrait crop below the desktop breakpoint (1283px): phones and tablets show the static
// <img> with their own crop settings, WebGL is never requested, and desktop switches to the canvas.
test('mobile uses a static portrait and preserves controls across the breakpoint', async ({ page }) => {
	// Record any WebGL context request so we can assert none was made while below the desktop breakpoint
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

	// At 768px the page must be showing the plain <img>, not the canvas
	await expect(page.locator('html')).not.toHaveAttribute('data-webgl-requested');
	const scene = page.getByTestId('hero-depth');
	const photo = scene.locator('img');
	await expect(scene).toHaveAttribute('data-ready', 'false');
	await expect(photo).toBeVisible();
	await expect(photo).toHaveAttribute('src', /portrait\.png/);

	// Set distinct mobile and tablet crops through the settings panel
	await page.getByLabel('Mobile X position (%) value', { exact: true }).fill('12');
	await page.getByLabel('Mobile bottom offset (%) value', { exact: true }).fill('-8');
	await page.getByLabel('Mobile scale value', { exact: true }).fill('0.8');
	await page.getByLabel('Mobile rotation value', { exact: true }).fill('0');
	// Tablets keep their own crop, so phones and tablets can't move each other
	await page.getByLabel('Tablet X position (%) value', { exact: true }).fill('20');
	await page.getByLabel('Tablet bottom offset (%) value', { exact: true }).fill('-5');
	await page.getByLabel('Tablet scale value', { exact: true }).fill('0.9');
	await page.getByLabel('Tablet rotation value', { exact: true }).fill('0');

	// Sweep viewport sizes either side of the 1283px desktop breakpoint (and short/tall windows)
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
			// Phones (<700px) use the mobile crop, tablets the tablet crop; the transform is x/y as a fraction of the viewport
			await expect(scene).toHaveAttribute('data-ready', 'false');
			await expect(photo).toBeVisible();
			await expect
				.poll(() =>
					photo.evaluate(element => {
						const matrix = new DOMMatrix(getComputedStyle(element).transform);
						return { scale: matrix.a, x: Math.round(matrix.e), y: Math.round(matrix.f) };
					})
				)
				.toEqual(
					width < 700
						? { scale: 0.8, x: Math.round(width * 0.12), y: Math.round(height * -0.08) }
						: { scale: 0.9, x: Math.round(width * 0.2), y: Math.round(height * -0.05) }
				);
		} else {
			// Desktop: the canvas takes over and the copy column keeps its width
			await expect(scene).toHaveAttribute('data-ready', 'true');
			await expect(photo).toBeHidden();
			const copy = await page.locator('[data-hero-content] hgroup').boundingBox();
			expect(copy?.width).toBeLessThanOrEqual(400);
		}
	}

	// The edits above landed on the right settings, and the desktop crop was left untouched
	const exported = JSON.parse(await page.getByLabel('All hero settings JSON').inputValue());
	expect(exported.portrait.mobilePositionX).toBe(12);
	expect(exported.portrait.tabletPositionX).toBe(20);
	expect(exported.portrait.positionX).toBe(3);
});

// Protects the phone layout: the hero copy sits in the lower part of the screen and the copyright keeps
// a 32px gap to the bottom edge, at both a typical and a taller phone height.
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
