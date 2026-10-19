import { expect, test } from '@playwright/test';

test('projects cross dissolve completes before the ribbon reveal starts', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await page.locator('html:not([data-loader-pending])').waitFor();
	await page.locator('header').getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page).toHaveURL(/\/projects\/$/);
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.some(animation => animation instanceof CSSAnimation && animation.animationName === 'vt-fade')
	);
	const frame = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(frame.locator('#stage')).toBeVisible();
	const renderer = page.frames().find(item => item.url().includes('/projects-ribbon/'));
	if (!renderer) throw new Error('Missing ribbon frame');
	await renderer.waitForFunction('introduction.active && introduction.progress > 0');
	expect(
		await page.evaluate(() =>
			document
				.getAnimations()
				.some(
					animation =>
						animation instanceof CSSAnimation &&
						animation.animationName === 'vt-fade' &&
						animation.playState === 'running'
				)
		)
	).toBe(false);
	await expect(frame.locator('#intro-status')).toContainText('Ready.');
});
