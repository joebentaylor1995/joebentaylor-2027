import { expect, test } from '@playwright/test';

test('global pulse washes away a stationary small logo and releases the homepage', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/');
	const loader = page.locator('[data-site-loader]');
	await expect(loader).toBeVisible();
	const header = page.locator('header');
	await expect(header).toHaveAttribute('data-header-entrance', 'waiting');
	await expect(header).toBeHidden();
	await expect(page.locator('main [data-site-loader]')).toHaveCount(0);
	const mark = page.locator('[data-loader-mark]');
	const bounds = await mark.boundingBox();
	if (!bounds) throw new Error('Missing loader logo');
	expect(bounds.width).toBeLessThanOrEqual(120);
	await page.waitForFunction(() => Number(document.querySelector('[data-logo-wash]')?.getAttribute('r')) > 12);
	await expect(mark).toHaveCSS('opacity', '1');
	await expect(mark).toHaveCSS('transform', 'none');
	await expect(loader).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	await expect(loader).toBeHidden();
	await expect(header).toHaveAttribute('data-header-entrance', 'complete');
	await expect(header).toBeVisible();
	await expect(header).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
	await expect(page.locator('[data-entrance]')).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(loader).toBeHidden();
	await expect(header).toHaveAttribute('data-header-entrance', 'complete');
	expect(errors).toEqual([]);
});

test('old preview URL has no chooser and reduced motion completes', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/?loaderConcepts');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	await expect(page.getByRole('complementary', { name: 'Global loader concepts' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Replay concept' })).toHaveCount(0);
	await expect(page.locator('[data-entrance]')).toHaveAttribute('data-entrance', 'complete');
	await expect(page.locator('header')).toHaveAttribute('data-header-entrance', 'complete');
});

test('failed first-view image cannot trap the loader', async ({ page }) => {
	await page.route('**/_next/image/**', route => route.abort());
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	await expect(page.locator('[data-site-loader]')).toBeHidden();
});

test('JavaScript-disabled visitors are not covered by the loader', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(test.info().project.use.baseURL || 'http://localhost:3000');
	await expect(page.locator('[data-site-loader]')).toBeHidden();
	await context.close();
});
