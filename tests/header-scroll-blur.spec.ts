import { expect, test } from '@playwright/test';

for (const width of [440, 1440]) {
	test(`header progressive blur follows scroll at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
		const layers = page.locator('[data-header-blur] span');
		await expect(layers.first()).toHaveCSS('opacity', '0');
		const scroller = page.locator('#page .lenis').first();
		await scroller.evaluate(e => e.scrollTo({ top: 48, behavior: 'instant' }));
		await expect(layers.first()).toHaveCSS('opacity', '0.5');
		await scroller.evaluate(e => e.scrollTo({ top: 400, behavior: 'instant' }));
		await expect(layers.first()).toHaveCSS('opacity', '1');
		await expect(layers.last()).toHaveCSS('backdrop-filter', 'blur(16px)');
		expect(
			await page.getByRole('link', { name: 'Go to home page' }).evaluate(e => {
				const r = e.getBoundingClientRect();
				return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
			})
		).toBe(true);
		await page.screenshot({ path: `test-results/header-blur-${width}.png` });
		await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
		await expect(layers.first()).toHaveCSS('opacity', '0');
	});
}
