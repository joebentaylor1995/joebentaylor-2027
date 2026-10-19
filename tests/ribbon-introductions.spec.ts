import { expect, test } from '@playwright/test';

for (const width of [1440, 440]) {
	test(`ten sharp ribbon introductions at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/?ribbonSettings');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		const ribbon = page.frameLocator('iframe[title="Interactive projects"]');
		await expect(ribbon.locator('#intro-effect')).toBeVisible();
		await expect(ribbon.locator('#intro-effect option')).toHaveCount(10);
		await expect(ribbon.locator('#intro-duration')).toHaveValue('1.1');
		await expect(ribbon.locator('#intro-status')).toContainText('Ready.', { timeout: 30000 });
		const frame = page.frames().find(item => item.url().includes('/projects-ribbon/index.html'));
		if (!frame) throw new Error('Ribbon frame missing');
		for (let effect = 1; effect <= 10; effect++) {
			await ribbon.locator('#intro-effect').selectOption(String(effect));
			await expect(ribbon.locator('#intro-status')).toContainText('Playing');
			await frame.waitForFunction('introduction.progress > .15 && introduction.progress < 1');
			expect(await frame.evaluate('gl.getUniform(program,uniforms.MotionBlur)')).toBe(0);
			expect(await frame.evaluate('gl.getError()')).toBe(0);
			if (effect === 8) await page.screenshot({ path: `/tmp/ribbon-introduction-${width}.png` });
			await expect(ribbon.locator('#intro-status')).toContainText('Ready.');
			expect(await frame.evaluate('introduction.progress')).toBe(1);
		}
		await page.reload();
		await expect(ribbon.locator('#intro-effect')).toHaveValue('10');
		await expect(ribbon.locator('#error')).toBeHidden();
	});
}
