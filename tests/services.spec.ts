import { expect, test } from './helpers/test';

for (const width of [1440, 440]) {
	test(`services wave peaks and reverses at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await expect(page.locator('#profile-panel')).toHaveCSS('clip-path', 'inset(0px)');
		await expect
			.poll(() =>
				page.locator('#profile-panel > div').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).e)
			)
			.toBe(0);
		const rows = page.locator('[data-service]');
		await expect(rows).toHaveCount(15);
		const row = rows.nth(6);
		const position = async (fraction: number) => {
			await row.evaluate((element, fraction) => {
				const panel = element.closest('#profile-panel') as HTMLElement;
				panel.scrollTop +=
					element.getBoundingClientRect().top +
					element.getBoundingClientRect().height / 2 -
					panel.getBoundingClientRect().top -
					panel.clientHeight * fraction;
			}, fraction);
		};
		const image = row.locator('[data-service-image]');
		const scale = () => image.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
		await position(0.6);
		await expect.poll(scale).toBeGreaterThan(0.95);
		if (width === 440) {
			await expect(row.locator('img')).toHaveJSProperty('complete', true);
			await page.screenshot({ path: 'test-results/services-mobile-active.png' });
		}
		await expect(row.locator('img')).toHaveJSProperty('complete', true);
		expect(
			await row.locator('img').evaluate(element => (element as HTMLImageElement).naturalWidth)
		).toBeGreaterThan(0);
		await position(0.3);
		await expect.poll(scale).toBeLessThan(0.01);
		await position(0.6);
		await expect.poll(scale).toBeGreaterThan(0.95);
		for (const mark of await page.locator('[data-services-intro] mark').all())
			await expect(mark).toHaveCSS('opacity', '1');
	});
}

test('services remain readable without motion and fit a mobile screen', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await page.locator('[data-services]').scrollIntoViewIfNeeded();
	await expect(page.locator('[data-service-image]').first()).toHaveCSS('transform', 'none');
	const section = page.locator('[data-services]');
	expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('mobile Services uses the Figma text scale and compact rows', async ({ page }) => {
	await page.setViewportSize({ width: 440, height: 1200 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const section = page.locator('[data-services]');
	await section.scrollIntoViewIfNeeded();
	await expect(section.locator('[data-service-title]').first()).toHaveCSS('font-size', '32px');
	await expect(section.locator('ul')).toHaveCSS('gap', '8px');
	await expect(section).toHaveCSS('padding-top', '64px');
	await expect(section.locator('waffl-grid')).toHaveCSS('padding-left', '32px');
	await expect(section.locator('ul')).toHaveCSS('padding-top', '64px');
	await page.screenshot({ path: 'test-results/services-mobile.png' });
	for (const width of [320, 390, 440]) {
		await page.setViewportSize({ width, height: 844 });
		expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
	}
});
