import { expect, test } from './helpers/test';

for (const width of [1440, 440]) {
	test(`profile title fill wave plays on opening and resets after closing at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		await expect(page.locator('header')).toHaveAttribute('data-header-entrance', 'complete', { timeout: 15000 });
		const title = page.locator('[data-profile-title]');
		const words = title.locator('[data-title-text]');
		const fill = (index: number) =>
			words.nth(index).evaluate(element => Number(getComputedStyle(element).getPropertyValue('--tfw-fill')));
		for (let opening = 0; opening < 2; opening++) {
			await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
			await expect.poll(() => fill(0)).toBe(-16);
			await expect.poll(() => fill(0), { intervals: [16] }).toBeGreaterThan(0);
			expect(await fill(0)).toBeGreaterThan(await fill(2));
			await expect(words.first()).toHaveCSS('background-clip', 'text');
			await expect(title.locator('[data-title-block]')).toHaveCount(0);
			await page.screenshot({ path: `test-results/profile-title-wave-${width}.png` });
			await expect.poll(() => fill(2)).toBe(111);
			await page.getByRole('button', { name: 'Close profile', exact: true }).press('Escape');
			await expect.poll(() => fill(0)).toBe(111);
			await expect(page.locator('#profile-panel').locator('..')).toHaveAttribute('data-state', 'closed');
			await expect.poll(() => fill(0)).toBe(-16);
		}
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await expect(words.last()).toHaveCSS('color', 'rgb(255, 255, 255)');
		await expect(words.last()).toHaveCSS('background-image', 'none');
	});
}
