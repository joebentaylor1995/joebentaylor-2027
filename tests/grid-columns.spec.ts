import { expect, test } from '@playwright/test';

test('desktop column overrides stay local and preserve smaller layouts', async ({ page }) => {
	await page.goto('/');
	const grid = page.locator('#profile-panel waffl-grid').first();
	const column = grid.locator(':scope > hgroup');
	await expect(column).toHaveCSS('--col-l', '1/9');
	await expect(column).not.toHaveAttribute('l');
	await expect(grid).toHaveCSS('--grid-columns-desktop', '8');
	await grid.evaluate(element => {
		const fixture = element.cloneNode(false) as HTMLElement;
		fixture.id = 'override-grid';
		const nested = document.createElement('waffl-grid');
		nested.id = 'nested-grid';
		fixture.append(nested);
		document.body.append(fixture);
	});

	for (const [width, columns, nestedColumns] of [
		[440, 2, 2],
		[1023, 6, 6],
		[1024, 8, 12],
		[1440, 8, 12],
	]) {
		await page.setViewportSize({ width, height: 900 });
		await expect(column).toHaveCSS('grid-column', width >= 1024 ? '1 / 9' : '1 / -1');
		for (const [id, expected] of [
			['override-grid', columns],
			['nested-grid', nestedColumns],
		] as const) {
			await expect
				.poll(() =>
					page
						.locator(`#${id}`)
						.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
				)
				.toBe(expected);
		}
	}
});
