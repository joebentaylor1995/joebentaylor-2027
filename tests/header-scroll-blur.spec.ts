// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the header progressive blur: it fades in over the first scroll distance, reaches full
// strength, and never blocks clicking the logo.
for (const width of [440, 1440]) {
	test(`header progressive blur follows scroll at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		// Case studies scroll under the header without the blur; other long pages keep it
		await page.goto('/cookies/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
		const layers = page.locator('[data-header-blur] span');
		await expect(layers.first()).toHaveCSS('opacity', '0');
		// Scrolling happens inside the Lenis wrapper, not the window
		const scroller = page.locator('#page .lenis').first();

		// Partway through the ramp the blur is half in
		await scroller.evaluate(e => e.scrollTo({ top: 48, behavior: 'instant' }));
		await expect(layers.first()).toHaveCSS('opacity', '0.5');
		await scroller.evaluate(e => e.scrollTo({ top: 400, behavior: 'instant' }));
		await expect(layers.first()).toHaveCSS('opacity', '1');
		await expect(layers.last()).toHaveCSS('backdrop-filter', 'blur(16px)');
		// The logo is still the top element at its own centre, i.e. the blur layers do not cover it
		expect(
			await page.getByRole('link', { name: 'Go to home page' }).evaluate(e => {
				const r = e.getBoundingClientRect();
				return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
			})
		).toBe(true);
		await page.screenshot({ path: `test-results/header-blur-${width}.png` });

		// Back at the top the blur fades out again
		await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
		await expect(layers.first()).toHaveCSS('opacity', '0');
	});
}

// Case studies scroll under the header with no blur element at all.
test('case studies render no header blur', async ({ page }) => {
	await page.goto('/projects/pocketchange/');
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	await expect(page.locator('header')).toBeVisible();
	await expect(page.locator('[data-header-blur]')).toHaveCount(0);
});
