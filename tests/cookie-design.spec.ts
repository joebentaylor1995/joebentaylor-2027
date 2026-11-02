// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the cookie banner layout from phone to desktop: it fits the viewport, shows its icon,
// lists Necessary as locked on and optional categories as off until chosen.
for (const width of [390, 440, 768, 1440]) {
	test(`cookie design and choices at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		const banner = page.getByRole('region', { name: 'Cookies', exact: true });
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible();
		// The banner only appears once the loader overlay has cleared
		await expect(banner).toBeVisible();
		await expect(banner.getByRole('link', { name: 'Cookies' })).toHaveAttribute('href', /^\/cookies\/?$/);

		// Icon has loaded and renders at its designed size
		const icon = banner.locator('img');
		expect(await icon.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
		expect((await icon.boundingBox())?.width).toBe(8);

		// Always inside the viewport; exact placement is pinned for the desktop and 440px layouts
		const bounds = await banner.boundingBox();
		if (!bounds) throw new Error('Cookie banner not rendered');
		expect(bounds.x).toBeGreaterThanOrEqual(0);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
		if (width === 1440) {
			expect(bounds.width).toBe(345);
			expect(bounds.x).toBe(1055);
		} else if (width === 440) {
			expect(bounds.x).toBe(32);
			expect(bounds.y).toBe(90);
			expect(bounds.width).toBe(376);
		}

		// Screenshots are kept in test-results for visual review
		await banner.screenshot({ path: `test-results/cookies-default-${width}.png` });

		// Choices panel: Necessary is locked on, optional categories start off
		await banner.getByRole('button', { name: 'Let me choose' }).click();
		await expect(banner.getByRole('checkbox', { name: /Necessary/ })).toBeChecked();
		await expect(banner.getByRole('checkbox', { name: /Necessary/ })).toBeDisabled();
		await expect(banner.getByRole('checkbox', { name: /Analytics/ })).not.toBeChecked();
		// Drop focus so the screenshot does not capture a focus ring
		await page.evaluate(() => {
			if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
		});
		await banner.screenshot({ path: `test-results/cookies-options-${width}.png` });

		// Saving removes the banner
		await banner.getByRole('button', { name: 'Save Choices' }).click();
		await expect(banner).toHaveCount(0);
	});
}
