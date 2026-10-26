import { expect, test } from './helpers/test';

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
		// The hero copy is one viewport tall, with the label and title set into its bottom-left corner
		// (on phones the hero section runs a viewport longer, for the panel to rise over its held image)
		const hero = page.locator('[data-project-hero]');
		const layout = await hero.evaluate(e => {
			const copy = e.querySelector('[data-project-hero-copy]');
			const title = e.querySelector('h1')?.getBoundingClientRect();
			const label = e.querySelector('h1')?.previousElementSibling?.getBoundingClientRect();
			if (!copy || !title || !label) throw new Error('Hero copy, title or label missing');
			const box = copy.getBoundingClientRect();
			const style = getComputedStyle(copy);
			return {
				inset: Number.parseFloat(style.paddingLeft),
				insetBottom: Number.parseFloat(style.paddingBottom),
				height: box.height,
				left: title.left - box.left,
				below: box.bottom - title.bottom,
				labelLeft: label.left - box.left,
				labelGap: title.top - label.bottom,
			};
		});
		expect(layout.height).toBeCloseTo(900, 0);
		// The grid margin: 32px on phones and 40px on desktop at the design widths
		expect(layout.inset).toBeGreaterThan(0);
		expect(layout.insetBottom).toBeCloseTo(layout.inset, 0);
		expect(layout.left).toBeCloseTo(layout.inset, 0);
		expect(layout.below).toBeCloseTo(layout.inset, 0);
		expect(layout.labelLeft).toBeCloseTo(layout.inset, 0);
		if (width === 440) expect(layout.inset).toBeCloseTo(32, 0);
		if (width === 1440) expect(layout.inset).toBeCloseTo(40, 0);
		expect(layout.labelGap).toBeGreaterThanOrEqual(0);
		await expect(hero.getByText('Case Study')).toBeVisible();
	});
}
