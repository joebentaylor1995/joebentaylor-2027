import { expect, test } from './helpers/test';

test('global sizing preview affects tablet only and resets on reload', async ({ page }) => {
	await page.setViewportSize({ width: 768, height: 1000 });
	await page.goto('/?globalSettings');
	const panel = page.getByRole('complementary', { name: 'Global settings' });
	await expect(panel).toBeVisible();
	await expect(page.locator('html')).toHaveCSS('font-size', '16px');
	await panel.getByRole('slider', { name: 'Tablet font scale' }).fill('125');
	await expect(page.locator('html')).toHaveCSS('font-size', '20px');
	await page.setViewportSize({ width: 1024, height: 1000 });
	await expect(page.locator('html')).toHaveCSS('font-size', '10px');
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.locator('html')).toHaveCSS('font-size', '10px');
	await page.setViewportSize({ width: 768, height: 1000 });
	await expect(page.locator('html')).toHaveCSS('font-size', '20px');
	await panel.getByRole('button', { name: 'Reset to 100%' }).click();
	await expect(page.locator('html')).toHaveCSS('font-size', '16px');
	await panel.getByRole('slider', { name: 'Tablet font scale' }).fill('125');
	await page.reload();
	await expect(panel).toBeVisible();
	await expect(page.locator('html')).toHaveCSS('font-size', '16px');
	await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
	await page.screenshot({ path: 'test-results/global-settings-tablet.png' });
	await page.goto('/');
	await expect(panel).toHaveCount(0);
	await expect(page.locator('html')).toHaveCSS('font-size', '16px');
});
