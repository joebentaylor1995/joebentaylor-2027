import { expect, test } from './helpers/test';

test('keycap previews on hover and serves its matched click sounds', async ({ page, request }) => {
	for (const direction of ['down', 'up']) {
		const response = await request.get(`/audio/keycap/${direction}.mp3`);
		expect(response.ok()).toBe(true);
		expect((await response.body()).length).toBeGreaterThan(1000);
	}
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const keycap = page.locator('[data-keycap]');
	await keycap.scrollIntoViewIfNeeded();
	await expect(keycap).toHaveAttribute('data-state', 'ready');
	await keycap.hover();
	await expect(keycap).toHaveAttribute('data-frame', '4');
	await page.mouse.down();
	await expect(keycap).toHaveAttribute('data-frame', '32');
	await page.mouse.up();
	await expect(keycap).toHaveAttribute('data-frame', '4');
	await page.mouse.move(0, 0);
	await expect(keycap).toHaveAttribute('data-frame', '0');
});

for (const width of [1440, 440]) {
	test(`keycap holds until release and resets on profile close at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		const keycap = page.getByRole('button', { name: 'Press mechanical keycap' });
		await keycap.scrollIntoViewIfNeeded();
		await expect(keycap).toHaveAttribute('data-state', 'ready');
		const bounds = await keycap.boundingBox();
		if (!bounds) throw new Error('Keycap is not visible');
		await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
		await page.mouse.down();
		await expect(keycap).toHaveAttribute('data-frame', '32');
		await page.waitForTimeout(350);
		await expect(keycap).toHaveAttribute('data-frame', '32');
		await page.mouse.move(5, 5);
		await page.mouse.up();
		await expect(keycap).toHaveAttribute('data-pressed', 'false');
		await expect(keycap).toHaveAttribute('data-frame', '0');
		await keycap.focus();
		await page.keyboard.down('Space');
		await expect(keycap).toHaveAttribute('data-frame', '32');
		await page.keyboard.up('Space');
		await expect(keycap).toHaveAttribute('data-frame', '0');
		await keycap.screenshot({ path: `test-results/keycap-${width}.png` });
		await page.getByRole('button', { name: 'Close profile', exact: true }).press('Escape');
		await expect(page.locator('[data-keycap]')).toBeDisabled();
		await expect(page.locator('[data-keycap]')).toHaveAttribute('data-state', 'loading');
	});
}
