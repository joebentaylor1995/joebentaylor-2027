import { expect, test } from './helpers/test';

test('homepage does not scroll horizontally across desktop and mobile widths', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	for (const width of [1440, 1024, 768, 440, 390]) {
		await page.setViewportSize({ width, height: 900 });
		await expect
			.poll(() =>
				page.evaluate(() => {
					const scroll = document.querySelector('#page .lenis') as HTMLElement;
					return scroll
						? scroll.scrollWidth - scroll.clientWidth
						: document.documentElement.scrollWidth - innerWidth;
				})
			)
			.toBeLessThanOrEqual(1);
		await page
			.locator('#page .lenis')
			.first()
			.evaluate(el => {
				el.scrollLeft = 200;
			});
		await expect
			.poll(() =>
				page
					.locator('#page .lenis')
					.first()
					.evaluate(el => el.scrollLeft)
			)
			.toBe(0);
	}
});
