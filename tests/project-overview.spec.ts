import { expect, test } from './helpers/test';

for (const width of [1440, 440]) {
	test(`project overview matches its responsive layout at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
		const overview = page.locator('[data-project-overview]');
		const heroHeight = await page.locator('[data-project-hero-layer]').evaluate(el => el.clientHeight);
		const scroll = width === 1440 ? heroHeight - 900 + 810 + 900 : heroHeight;
		await page
			.locator('#page .lenis')
			.first()
			.evaluate((el, top) => el.scrollTo({ top, behavior: 'instant' }), scroll);
		await expect(overview.getByRole('heading', { name: 'Objectives' })).toBeVisible();
		await expect(overview.getByRole('list')).toHaveCount(3);
		await expect(overview.getByRole('listitem')).toHaveCount(15);
		await expect
			.poll(() => overview.locator('img').evaluate(el => (el as HTMLImageElement).naturalWidth))
			.toBeGreaterThan(0);
		const dimensions = await overview.locator('img').boundingBox();
		expect(dimensions?.width).toBe(48);
		expect(dimensions?.height).toBe(48);
		await expect(overview.locator('p').first()).toHaveCSS('font-size', width === 1440 ? '26px' : '18px');
		await expect.poll(() => overview.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
		await page.screenshot({ path: `test-results/project-overview-${width}.png` });
	});
}
