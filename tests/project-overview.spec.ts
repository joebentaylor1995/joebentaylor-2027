// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the overview section layout at desktop and mobile: headings and 15 list items render, icons are
// 48px, body text uses the responsive size, and nothing overflows sideways.
for (const width of [1440, 440]) {
	test(`project overview matches its responsive layout at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
		const overview = page.locator('[data-project-overview]');
		const heroHeight = await page.locator('[data-project-hero-layer]').evaluate(el => el.clientHeight);
		// Scroll to the overview; desktop must clear the pinned hero first, while on mobile the panel rises over
		// the hero's held, viewport-tall second row
		const scroll = width === 1440 ? heroHeight - 900 + 810 + 900 : heroHeight - 900;
		await page
			.locator('#page .lenis')
			.first()
			.evaluate((el, top) => el.scrollTo({ top, behavior: 'instant' }), scroll);
		// The Objectives label sits in its own sticky column on desktop and is dropped from the single mobile column
		const objectives = overview.getByRole('heading', { name: 'Objectives' });
		if (width === 1440) await expect(objectives).toBeVisible();
		else await expect(objectives).toBeHidden();
		await expect(overview.getByRole('heading', { name: 'Deliverables' })).toBeVisible();
		await expect(overview.getByRole('list')).toHaveCount(3);
		await expect(overview.getByRole('listitem')).toHaveCount(15);
		await expect
			.poll(() => overview.locator('img').evaluate(el => (el as HTMLImageElement).naturalWidth))
			.toBeGreaterThan(0);
		const dimensions = await overview.locator('img').boundingBox();
		// 4.8rem: at 1440px the root size is min(100vw / 144, 10px), which lands a 1/64px layout unit under 48
		expect(dimensions?.width).toBeCloseTo(48, 1);
		expect(dimensions?.height).toBeCloseTo(48, 1);
		await expect(overview.locator('p').first()).toHaveCSS('font-size', width === 1440 ? '26px' : '18px');
		await expect.poll(() => overview.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
		await page.screenshot({ path: `test-results/project-overview-${width}.png` });
	});
}
