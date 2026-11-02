// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the cookie banner entrance: it stays hidden and inert while the site loader runs,
// then reveals, and reopening it from settings moves focus to the first choice.
for (const width of [390, 1440]) {
	test(`cookie reveal waits for the loader at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		// Heading is included even when hidden so the banner can be found before it appears
		const banner = page
			.locator('section[aria-labelledby]')
			.filter({ has: page.getByRole('heading', { name: 'Cookies', includeHidden: true }) });

		// Before the loader finishes: held back and unreachable by keyboard or screen reader
		await expect(banner).toHaveAttribute('data-entrance', 'waiting');
		await expect(banner).toBeHidden();
		await expect(banner).toHaveAttribute('inert', '');

		// Once the loader clears, the banner reveals
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
		await expect(banner).toHaveAttribute('data-entrance', 'complete');
		await expect(banner).toBeVisible();
		await expect(banner).not.toHaveAttribute('inert');
		await expect(banner).toHaveCSS('clip-path', 'inset(0px 0% 0px 0px)');

		// Reopening settings later must not replay the wait and lands focus on the choices
		await banner.getByRole('button', { name: 'Accept Necessary' }).click();
		await page.evaluate(() => window.dispatchEvent(new Event('tackl:cookie-settings')));
		await expect(banner).toHaveAttribute('data-entrance', 'complete');
		await expect(banner.getByRole('checkbox', { name: /Analytics/ })).toBeFocused();
	});
}
