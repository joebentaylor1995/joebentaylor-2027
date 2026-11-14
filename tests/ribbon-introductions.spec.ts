// Imports
// ------------
import { expect, test } from '@playwright/test';

// Helpers
// ------------
// Globals of the standalone ribbon document, declared so the evaluate bodies type-check
declare const introduction: { progress: number };

// The duration slider's maximum, in seconds, and room for the longest cascade (3s plus its stagger) to finish
const LONGEST_DURATION = 3;
const CASCADE_TIMEOUT = 10_000;

// Tests
// ------------
// Protects the Projects ribbon slide cascade (?projectSettings tuning panel): a replay plays to completion with
// motion blur off and no GL errors, and a changed duration is remembered after a reload.
for (const width of [1440, 440]) {
	test(`sharp ribbon slide cascade at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/?projectSettings');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		const ribbon = page.frameLocator('iframe[title="Interactive projects"]');
		await expect(ribbon.locator('#intro-replay')).toBeVisible();
		await expect(ribbon.locator('#intro-duration')).toHaveValue('1.1');
		await expect(ribbon.locator('#intro-status')).toContainText('Ready.', { timeout: 30_000 });
		const frame = page.frames().find(item => item.url().includes('/projects-ribbon/index.html'));
		if (!frame) throw new Error('Ribbon frame missing');

		// Releasing a changed slider saves it and replays the cascade with the new timing. The longest duration keeps
		// the mid-play window open across several frames even when software WebGL renders only a few per second.
		await ribbon.locator('#intro-duration').fill(String(LONGEST_DURATION));
		await expect(ribbon.locator('#intro-duration-value')).toHaveText(`${LONGEST_DURATION.toFixed(1)}s`);
		await expect(ribbon.locator('#intro-status')).toContainText('Playing');

		// Check mid-play state, then wait for it to finish. GL state is read with string expressions evaluated
		// inside the ribbon frame.
		await frame.waitForFunction(() => introduction.progress > 0.15 && introduction.progress < 1);
		expect(await frame.evaluate('gl.getUniform(program,uniforms.MotionBlur)')).toBe(0);
		expect(await frame.evaluate('gl.getError()')).toBe(0);
		// Keep a screenshot mid-cascade for visual review
		await page.screenshot({ path: `test-results/ribbon-introduction-${width}.png` });
		await expect(ribbon.locator('#intro-status')).toContainText('Ready.', { timeout: CASCADE_TIMEOUT });
		expect(await frame.evaluate(() => introduction.progress)).toBe(1);

		// The Replay button plays it again to completion
		await ribbon.locator('#intro-replay').click();
		await expect(ribbon.locator('#intro-status')).toContainText('Playing');
		await expect(ribbon.locator('#intro-status')).toContainText('Ready.', { timeout: CASCADE_TIMEOUT });
		expect(await frame.evaluate(() => introduction.progress)).toBe(1);
		expect(await frame.evaluate('gl.getError()')).toBe(0);

		// The changed duration persists
		await page.reload();
		await expect(ribbon.locator('#intro-duration')).toHaveValue(String(LONGEST_DURATION));
		await expect(ribbon.locator('#intro-duration-value')).toHaveText(`${LONGEST_DURATION.toFixed(1)}s`);
		await expect(ribbon.locator('#intro-status')).toContainText('Ready.', { timeout: 30_000 });
		await expect(ribbon.locator('#error')).toBeHidden();
	});
}
