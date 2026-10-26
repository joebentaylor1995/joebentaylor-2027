import { expect, test } from './helpers/test';

for (const width of [1440, 440]) {
	test(`case study media layouts and scrolling at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
		const gallery = page.locator('[data-project-case-builder]');
		await expect(gallery.locator('[data-media-layout]')).toHaveCount(9);
		await expect(gallery.locator('img')).toHaveCount(12);
		const pair = gallery.locator('[data-media-layout="dual"]').first();
		const a = await pair.locator('figure').nth(0).boundingBox();
		const b = await pair.locator('figure').nth(1).boundingBox();
		expect(a).not.toBeNull();
		expect(b).not.toBeNull();
		if (!a || !b) return;
		if (width === 1440) {
			expect(b.x - a.x - a.width).toBeCloseTo(8, 0);
			expect(b.y).toBeCloseTo(a.y, 0);
		} else {
			expect(b.y - a.y - a.height).toBeCloseTo(8, 0);
			expect(a.width).toBe(408);
			expect(a.width / a.height).toBeCloseTo(443 / 560, 2);
		}
		const offset = await gallery.evaluate(el => (el as HTMLElement).offsetTop);
		const heroHeight = await page.locator('[data-project-hero-layer]').evaluate(el => el.clientHeight);
		const target = width === 1440 ? heroHeight - 900 + 810 + offset : heroHeight + offset;
		await page
			.locator('#page .lenis')
			.first()
			.evaluate((el, top) => el.scrollTo({ top, behavior: 'instant' }), target);
		await expect
			.poll(() =>
				gallery
					.locator('img')
					.first()
					.evaluate(el => (el as HTMLImageElement).naturalWidth)
			)
			.toBeGreaterThan(0);
		await expect.poll(() => gallery.evaluate(el => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(2);
		await expect(gallery.locator('[data-media-tile]').first()).toHaveAttribute('data-reveal-complete', 'true');
		if (width === 1440) {
			expect(
				await page.locator('[data-project-panel]').evaluate(el => el.getBoundingClientRect().width)
			).toBeCloseTo(974, 0);
			const full = await pair.locator('figure').first().boundingBox();
			expect((full?.width ?? 0) / (full?.height ?? 1)).toBeCloseTo(443 / 642, 2);
		}
		await page.screenshot({ path: `test-results/project-case-builder-${width}.png` });
		await page
			.locator('#page .lenis')
			.first()
			.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
		await expect(page.locator('[data-next-project]')).toBeInViewport();
	});
}
