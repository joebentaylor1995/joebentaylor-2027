import { expect, type Frame, type FrameLocator, test } from './helpers/test';

// NOTE • The longest cascade, so a slow CI runner can't finish it between polls
const LONGEST_DURATION = '3';

// Observes one full play: status, mid-play progress without GL errors, then ready.
const expectCascadePlays = async (ribbon: FrameLocator, frame: Frame) => {
	await expect(ribbon.locator('#intro-status')).toContainText('Playing');
	// NOTE • Polled with evaluate: waitForFunction(string) needs eval, which the CSP blocks
	await expect
		.poll(() => frame.evaluate('introduction.progress > .1 && introduction.progress < 1'), { intervals: [50] })
		.toBe(true);
	expect(await frame.evaluate('gl.getError()')).toBe(0);
	await expect(ribbon.locator('#intro-status')).toContainText('Ready.', { timeout: 15000 });
	expect(await frame.evaluate('introduction.progress')).toBe(1);
};

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

		// Changing the duration saves it and replays the cascade at the new length
		await ribbon.locator('#intro-duration').fill(LONGEST_DURATION);
		await expect(ribbon.locator('#intro-duration-value')).toHaveText('3.0s');
		await expectCascadePlays(ribbon, frame);

		for (let replay = 1; replay <= 2; replay++) {
			await ribbon.locator('#intro-replay').click();
			await expectCascadePlays(ribbon, frame);
		}

		await page.reload();
		await expect(ribbon.locator('#intro-duration')).toHaveValue(LONGEST_DURATION);
		await expect(ribbon.locator('#error')).toBeHidden();
	});
}
