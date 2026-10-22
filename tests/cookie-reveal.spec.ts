import { expect, test } from './helpers/test';

for (const width of [390, 1440]) {
	test(`cookie reveal waits for the loader at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		const banner = page
			.locator('section[aria-labelledby]')
			.filter({ has: page.getByRole('heading', { name: 'Cookies', includeHidden: true }) });
		await expect(banner).toHaveAttribute('data-entrance', 'waiting');
		await expect(banner).toBeHidden();
		await expect(banner).toHaveAttribute('inert', '');
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
		await expect(banner).toHaveAttribute('data-entrance', 'complete');
		await expect(banner).toBeVisible();
		await expect(banner).not.toHaveAttribute('inert');
		await expect(banner).toHaveCSS('clip-path', 'inset(0px 0% 0px 0px)');
		await banner.getByRole('button', { name: 'Accept Necessary' }).click();
		await page.evaluate(() => window.dispatchEvent(new Event('tackl:cookie-settings')));
		await expect(banner).toHaveAttribute('data-entrance', 'complete');
		await expect(banner.getByRole('checkbox', { name: /Analytics/ })).toBeFocused();
	});
}
