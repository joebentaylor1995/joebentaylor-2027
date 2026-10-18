import { expect, test } from '@playwright/test';

for (const width of [375, 440, 768, 1440]) {
	test(`case study content spacing at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
		const objectives = page.locator('[data-objectives-label]');
		if (width < 1024) {
			await expect(objectives).toBeHidden();
			const tiles = page.locator('[data-project-case-builder] figure');
			expect(await tiles.count()).toBeGreaterThan(0);
			for (const tile of await tiles.all()) {
				const bounds = await tile.boundingBox();
				expect(bounds?.x).toBeCloseTo(16, 0);
				expect(bounds?.width).toBeCloseTo(width - 32, 0);
			}
		} else {
			await expect(objectives).toBeVisible();
		}
		const hero = page.locator('[data-project-hero]');
		const spacing = await hero.evaluate(e => {
			const title = e.querySelector('h1')?.getBoundingClientRect();
			const description = e.querySelector('p')?.getBoundingClientRect();
			if (!title || !description) throw new Error('Hero title or description missing');
			return {
				above: description.top - title.bottom,
				below: e.getBoundingClientRect().bottom - description.bottom,
			};
		});
		expect(spacing.above).toBeGreaterThan(0);
		expect(Math.abs(spacing.above - spacing.below)).toBeLessThan(1);
		const height = await hero.evaluate(e => e.getBoundingClientRect().height);
		await hero.locator('p').evaluate(e => {
			e.textContent += ' Extra project description.'.repeat(30);
		});
		expect(await hero.evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThan(height);
		expect(
			await hero.locator('p').evaluate(e => {
				const bounds = e.getBoundingClientRect();
				return bounds.left >= 0 && bounds.right <= window.innerWidth;
			})
		).toBe(true);
	});
}
