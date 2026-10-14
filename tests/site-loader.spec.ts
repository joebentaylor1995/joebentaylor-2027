import { expect, test } from '@playwright/test';

test('loader gallery is opt-in and belongs to the shared layout', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.locator('[data-loader-concept]')).toHaveCount(0);
	await page.goto('/?loaderConcepts');
	await expect(page.getByRole('complementary', { name: 'Global loader concepts' })).toBeVisible();
	await expect(page.locator('main [data-loader-concept]')).toHaveCount(0);
	await expect(page.getByRole('combobox').nth(0).locator('option')).toHaveCount(10);
});

test('all ten concepts release the scene and can be replayed or skipped', async ({ page }) => {
	test.setTimeout(90_000);
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/?loaderConcepts');
	const select = page.getByRole('combobox').nth(0);
	await expect(select).toBeVisible();
	for (let index = 0; index < 10; index++) {
		await select.selectOption(String(index));
		await page.getByRole('button', { name: 'Replay concept', exact: true }).click();
		await expect(page.getByRole('status')).toContainText('Ready to replay', { timeout: 10_000 });
		await expect(page.locator('[data-loader-overlay]')).toBeHidden();
		await expect(page.locator('[data-entrance]')).toHaveAttribute('data-entrance', 'complete', { timeout: 10_000 });
	}
	await page.getByRole('combobox').nth(1).selectOption('0.5');
	await select.selectOption('3');
	await select.selectOption('5');
	await page.getByRole('button', { name: 'Skip preview' }).click();
	await expect(page.locator('[data-loader-overlay]')).toBeHidden();
	await expect(page.locator('[data-entrance]')).toHaveAttribute('data-entrance', 'complete', { timeout: 15_000 });
	expect(errors).toEqual([]);
});

test('mobile reduced-motion preview stays usable and completes', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/?loaderConcepts');
	await expect(page.getByRole('status')).toContainText('Ready to replay');
	await expect(page.locator('[data-loader-overlay]')).toBeHidden();
	const bounds = await page.getByRole('complementary', { name: 'Global loader concepts' }).boundingBox();
	if (!bounds) throw new Error('Loader chooser is missing');
	expect(bounds.x).toBeGreaterThanOrEqual(0);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
	await page.getByRole('button', { name: /10 · Global loader concepts/ }).click();
	await expect(page.getByRole('combobox')).toHaveCount(0);
});
