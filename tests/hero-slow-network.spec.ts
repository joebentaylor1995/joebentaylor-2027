import { expect, test } from '@playwright/test';

test('slow hero textures do not miss the opening WebGL wave', async ({ page }) => {
	let release = () => {};
	const textureReady = new Promise<void>(resolve => {
		release = resolve;
	});
	await page.route('**/images/hero-depth/depth.webp', async route => {
		await textureReady;
		await route.continue();
	});
	try {
		await page.goto('/');
		// Simulate a texture arriving after the former two-second readiness deadline.
		await page.waitForTimeout(6000);
		await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'false');
		await expect(page.locator('html')).toHaveAttribute('data-loader-pending', 'true');
		release();
		await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true', { timeout: 10000 });
		await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-webgl-reveal', 'true');
		await expect(page.locator('html')).not.toHaveAttribute('data-loader-pending', 'true');
	} finally {
		release();
	}
});
