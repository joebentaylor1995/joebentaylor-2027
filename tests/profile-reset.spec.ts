import { expect, test } from '@playwright/test';

test('profile media resets only after the closing animation settles', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'Profile', exact: true });
	const shell = page.locator('#profile-panel').locator('..');
	const toolkit = page.locator('[data-toolkit="Design toolkit"]');
	await toolkit.scrollIntoViewIfNeeded();
	await expect(toolkit).toHaveAttribute('data-state', 'ready');
	const video = page.locator('[data-featured-video]').first();
	await video.scrollIntoViewIfNeeded();
	await expect(video).toHaveJSProperty('paused', false);
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.getByRole('button', { name: 'Close profile', exact: true }).press('Escape');
	await expect(shell).toHaveAttribute('data-state', 'closing');
	await expect(toolkit.locator('canvas')).toHaveCount(1);
	await expect(video).toHaveAttribute('src', '/videos/codrops.mp4');
	await expect(shell).toHaveAttribute('data-state', 'closed');
	await expect(toolkit.locator('canvas')).toHaveCount(0);
	await expect(video).not.toHaveAttribute('src');
	await expect(video).toHaveJSProperty('currentTime', 0);
	await expect(panel).toBeHidden();
});
