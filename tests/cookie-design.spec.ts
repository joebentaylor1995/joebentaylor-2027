import { expect, test } from './helpers/test';

for (const width of [390, 440, 768, 1440]) {
	test(`cookie design and choices at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		const banner = page.getByRole('region', { name: 'Cookies', exact: true });
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible();
		await expect(banner).toBeVisible();
		await expect(banner.getByRole('link', { name: 'Cookies' })).toHaveAttribute('href', /^\/cookies\/?$/);
		const icon = banner.locator('img');
		expect(await icon.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
		expect((await icon.boundingBox())?.width).toBe(8);
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
		await banner.screenshot({ path: `test-results/cookies-default-${width}.png` });
		await banner.getByRole('button', { name: 'Let me choose' }).click();
		await expect(banner.getByRole('checkbox', { name: /Necessary/ })).toBeChecked();
		await expect(banner.getByRole('checkbox', { name: /Necessary/ })).toBeDisabled();
		await expect(banner.getByRole('checkbox', { name: /Analytics/ })).not.toBeChecked();
		await page.evaluate(() => {
			if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
		});
		await banner.screenshot({ path: `test-results/cookies-options-${width}.png` });
		await banner.getByRole('button', { name: 'Save Choices' }).click();
		await expect(banner).toHaveCount(0);
	});
}
