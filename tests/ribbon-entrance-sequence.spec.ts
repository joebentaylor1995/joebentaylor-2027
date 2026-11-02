// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects the Projects entrance order: the page cross-dissolve (the vt-fade view transition) must finish before
// the ribbon intro begins, so the two never overlap.
test('projects cross dissolve completes before the ribbon reveal starts', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	// Wait until the loader is not pending
	await page.locator('html:not([data-loader-pending])').waitFor();
	await page.locator('header').getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page).toHaveURL(/\/projects\/$/);

	// Wait until the cross-dissolve is running
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
	// No vt-fade animation may still be running now that the ribbon intro has begun
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
