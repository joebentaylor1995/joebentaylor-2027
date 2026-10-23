import { expect, test } from '@playwright/test';

test('404 uses the case study action above its caption and returns through the logo wave', async ({ page }) => {
	await page.goto('/missing-matrix-scene/');
	const consent = page.getByRole('button', { name: 'Accept Necessary' });
	await consent.click();
	await expect(page.locator('[data-not-found-scene]')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	const home = page.getByRole('link', { name: 'Back to home', exact: true });
	await expect(home).toHaveAttribute('data-button-050', '');
	const action = await home.boundingBox();
	const caption = await page.getByText('Page got lost in the rain', { exact: true }).boundingBox();
	expect(action && caption && action.y + action.height <= caption.y).toBeTruthy();
	const origin = await page.evaluate(() => performance.timeOrigin);
	await page.screenshot({ path: 'test-results/matrix-404-desktop.png' });
	await home.click();
	await page.waitForFunction(() => document.documentElement.dataset.navigationWave === 'running');
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
});

test('mobile rain keeps the home action and caption clear of the numerals', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/missing-mobile-rain/');
	const consent = page.getByRole('button', { name: 'Accept Necessary' });
	await consent.click();
	await expect(page.locator('[data-not-found-scene]')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeInViewport();
	await expect(page.getByText('Page got lost in the rain', { exact: true })).toBeInViewport();
	await page.getByRole('button', { name: 'Pause rain' }).click();
	await expect(page.getByRole('button', { name: 'Play rain' })).toHaveAttribute('aria-pressed', 'true');
	await page.screenshot({ path: 'test-results/matrix-404-mobile.png' });
});

test('mobile 404 stays usable with reduced motion and without WebGL', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (
			this: HTMLCanvasElement,
			...args: Parameters<typeof original>
		) {
			if (String(args[0]).startsWith('webgl')) return null;
			return original.apply(this, args);
		} as typeof original;
	});
	await page.goto('/missing-mobile-scene/');
	const consent = page.getByRole('button', { name: 'Accept Necessary' });
	await consent.click();
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.locator('[data-not-found-scene]')).toHaveAttribute('data-ready', 'false');
	await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeInViewport();
	await expect(page.getByText('Page got lost in the rain', { exact: true })).toBeInViewport();
	await page.getByRole('link', { name: 'Back to home', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
});
