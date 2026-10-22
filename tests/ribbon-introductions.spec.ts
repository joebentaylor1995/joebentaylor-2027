import { expect, test } from './helpers/test';

for (const width of [1440, 440]) {
	test(`ribbon slide cascade replays and keeps its saved timing at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/?projectSettings');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		const ribbon = page.frameLocator('iframe[title="Interactive projects"]');
		await expect(ribbon.locator('#intro-duration')).toHaveValue('1.1');
		await expect(ribbon.locator('#intro-status')).toContainText('Ready.', { timeout: 30000 });
		const frame = page.frames().find(item => item.url().includes('/projects-ribbon/index.html'));
		if (!frame) throw new Error('Ribbon frame missing');

		for (let replay = 1; replay <= 3; replay++) {
			await ribbon.locator('#intro-replay').click();
			await expect(ribbon.locator('#intro-status')).toContainText('Playing');
			// NOTE • Polled with evaluate: waitForFunction(string) needs eval, which the CSP blocks
			await expect
				.poll(() => frame.evaluate('introduction.progress > .15 && introduction.progress < 1'), {
					intervals: [50],
				})
				.toBe(true);
			expect(await frame.evaluate('gl.getError()')).toBe(0);
			await expect(ribbon.locator('#intro-status')).toContainText('Ready.');
			expect(await frame.evaluate('introduction.progress')).toBe(1);
		}

		await ribbon.locator('#intro-duration').fill('2');
		await expect(ribbon.locator('#intro-duration-value')).toHaveText('2.0s');
		await expect(ribbon.locator('#intro-status')).toContainText('Ready.');
		await page.reload();
		await expect(ribbon.locator('#intro-duration')).toHaveValue('2');
		await expect(ribbon.locator('#error')).toBeHidden();
	});
}
