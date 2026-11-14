// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the case study media gallery: the right number of layouts and images render, paired images sit
// side by side on desktop and stacked on mobile with an 8px gap, and the gallery scrolls into place.
for (const width of [1440, 440]) {
	test(`case study media layouts and scrolling at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
		const gallery = page.locator('[data-project-case-builder]');
		// Every CMS block renders as one top-level layout: a dual holds two tiles, every other layout one, and
		// each tile holds its media. Counted from the page, not hard-coded, so editors can add or drop blocks.
		await expect(gallery.locator('[data-media-layout]').first()).toBeAttached();
		const blocks = await gallery.evaluate(el =>
			[...el.querySelectorAll(':scope > [data-media-layout]')].map(layout => ({
				type: layout.getAttribute('data-media-layout'),
				tiles: [...layout.querySelectorAll('[data-media-tile]')].map(
					tile => tile.querySelector('figure img, figure video, figure iframe, figure canvas') !== null
				),
			}))
		);
		await expect(gallery.locator('[data-media-layout]')).toHaveCount(blocks.length);
		expect(blocks.some(block => block.type === 'dual')).toBe(true);
		for (const block of blocks) {
			expect(block.tiles).toHaveLength(block.type === 'dual' ? 2 : 1);
			expect(block.tiles).not.toContain(false);
		}
		// A dual layout: 8px gap, beside each other on desktop and one above the other on mobile
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

		// Scroll the gallery to the top of the viewport (Lenis wrapper), allowing for the hero above it. Desktop
		// scrolls the hero away and then slides the panel in over 90% of a viewport; on mobile the panel rises
		// over the hero's held, viewport-tall second row, so it starts one viewport above the hero's bottom.
		const offset = await gallery.evaluate(el => (el as HTMLElement).offsetTop);
		const heroHeight = await page.locator('[data-project-hero-layer]').evaluate(el => el.clientHeight);
		const target = width === 1440 ? heroHeight - 900 + 810 + offset : heroHeight - 900 + offset;
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

		// Screenshot kept in test-results for visual review
		await page.screenshot({ path: `test-results/project-case-builder-${width}.png` });
		await page
			.locator('#page .lenis')
			.first()
			.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
		await expect(page.locator('[data-next-project]')).toBeInViewport();
	});
}
