import { expect, test } from '@playwright/test';

test('mobile overview scrolls over the settled hero and reverses', async ({ page }) => {
	await page.setViewportSize({ width: 440, height: 796 });
	await page.goto('/projects/pocketchange/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	// The title block scrolls natively while the hero image holds behind the rising panel
	const hero = page.locator('[data-project-hero-layer]');
	const image = page.locator('[data-project-hero-media]');
	const panel = page.locator('[data-project-panel]');
	const scroller = page.locator('#page .lenis').first();
	const height = await page.locator('[data-project-hero-copy]').evaluate(e => e.clientHeight);
	await scroller.evaluate((e, top) => e.scrollTo({ top, behavior: 'instant' }), height - 796 + 199);
	await expect.poll(async () => Math.round((await panel.boundingBox())?.y ?? 0)).toBe(597);
	await expect(page.locator('[data-project-hero] h1 [data-wave-state]')).toHaveAttribute(
		'data-wave-state',
		'complete'
	);
	const titleBounds = await page.locator('[data-project-hero] h1').boundingBox();
	expect(titleBounds?.y).toBeGreaterThan(0);
	expect((titleBounds?.y ?? 0) + (titleBounds?.height ?? 0)).toBeLessThan(796);
	await page.screenshot({ path: 'test-results/mobile-title-reading.png' });
	for (const overlap of [100, 350]) {
		await scroller.evaluate((e, top) => e.scrollTo({ top, behavior: 'instant' }), height - 796 + overlap);
		await expect.poll(async () => Math.round((await panel.boundingBox())?.y ?? 0)).toBe(796 - overlap);
		const bounds = await image.boundingBox();
		await expect
			.poll(async () => {
				const copy = await page.locator('[data-project-hero] h1').boundingBox();
				return (copy?.y ?? 0) + (copy?.height ?? 0);
			})
			.toBeLessThan(796 - overlap);
		// The held image drifts up at a third of the scroll (CSS scroll-driven parallax)
		expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeCloseTo(796 - overlap / 3, 0);
		expect(
			await page.evaluate(() => document.elementFromPoint(220, 780)?.closest('[data-project-panel]') !== null)
		).toBe(true);
	}
	await page.screenshot({ path: 'test-results/mobile-overview-overlay.png' });
	await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
	await expect.poll(async () => Math.round((await hero.boundingBox())?.y ?? -1)).toBe(0);
});
