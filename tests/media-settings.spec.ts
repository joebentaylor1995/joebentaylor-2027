// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the ?mediaSettings panel: duration, delay and easing change how a tile reveals, and
// Reset defaults restores them.
test('media settings control native reveal timing and easing', async ({ page }) => {
	// Short timeout so a missing control fails quickly
	page.setDefaultTimeout(10000);
	await page.goto('/projects/pocketchange/?mediaSettings');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	const panel = page.getByRole('complementary', { name: 'Media reveal settings' });
	await expect(panel).toBeVisible();
	// End puts each slider at its maximum (2s), and easing is switched to linear
	await panel.getByRole('slider', { name: 'Duration / speed' }).press('End');
	await panel.getByRole('slider', { name: 'Delay (seconds)' }).press('End');
	await panel.getByLabel('Easing', { exact: true }).selectOption('Linear');
	await expect(panel.getByRole('slider', { name: 'Trigger position' })).toHaveValue('100');

	// Scroll the first tile to the reveal trigger point, using the Lenis scroller rather than the window
	const tile = page.locator('[data-media-tile]').first();
	await tile.evaluate(element => {
		const scroller = document.querySelector('#page .lenis');
		const content = document.querySelector('[data-project-panel-content]');
		const hero = document.querySelector('[data-project-hero-layer]');
		if (!scroller || !content || !hero) throw new Error('Missing project layout');
		const top =
			Math.max(0, hero.clientHeight - innerHeight) +
			innerHeight * 0.9 +
			element.getBoundingClientRect().top -
			content.getBoundingClientRect().top -
			innerHeight * 0.7;
		scroller.scrollTo({ top, behavior: 'instant' });
	});

	// The running animation uses the chosen values
	await panel.getByRole('button', { name: 'Replay reveals' }).click();
	await expect(tile).toHaveAttribute('data-revealing', 'true');
	const timing = await tile.locator('figure').evaluate(element => element.getAnimations()[0]?.effect?.getTiming());
	expect(timing).toMatchObject({ duration: 2000, delay: 2000, easing: 'linear' });
	await panel.getByRole('button', { name: 'Reset defaults' }).click();
	await expect(panel.getByRole('slider', { name: 'Duration / speed' })).toHaveValue('0.55');
	await expect(panel.getByRole('slider', { name: 'Delay (seconds)' })).toHaveValue('0');
});
