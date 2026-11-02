// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects deep links to modals: /profile/ and /contact/ open after the loader on a direct visit and
// again after a reload.
for (const route of ['profile', 'contact']) {
	test(`${route} opens after the loader on a direct visit and survives reload`, async ({ page }) => {
		await page.goto(`/${route}/`);
		await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 20000 });
		const modal = route === 'profile' ? page.locator('#profile-panel') : page.getByRole('dialog');
		await expect(modal).toBeVisible();
		if (route === 'profile')
			await expect(page.getByRole('button', { name: 'Open Profile' })).toHaveAttribute('aria-expanded', 'true');
		await expect(page).toHaveURL(new RegExp(`/${route}/$`));
		await page.reload();
		await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 20000 });
		await expect(modal).toBeVisible();
	});
}

// Protects history for modals: opening Profile adds a /profile/ entry, Back closes it to the home URL and
// Forward reopens it.
test('header modal URLs support browser back and forward', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 20000 });
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await page.locator('header').getByRole('button', { name: 'Open Profile', exact: true }).click();
	await expect(page).toHaveURL(/\/profile\/$/);
	await page.goBack();
	await expect(page).toHaveURL(new URL('/', page.url()).href);
	await page.goForward();
	await expect(page).toHaveURL(/\/profile\/$/);
	await expect(page.locator('#profile-panel')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Profile' })).toHaveAttribute('aria-expanded', 'true');
});

// Protects closing Contact: it returns to the page it was opened from, with the scene underneath kept
// mounted throughout.
test('contact closes to its original page and preserves the underlying scene', async ({ page }) => {
	await page.goto('/projects/pocketchange/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 20000 });
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await page.getByRole('button', { name: 'Open Booking Form' }).click();
	await expect(page).toHaveURL(/\/contact\/$/);
	await expect(page.locator('[data-project-hero]')).toHaveCount(1);
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByRole('button', { name: 'Close booking form' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page).toHaveURL(/\/projects\/pocketchange\/$/);
	await expect(page.locator('[data-project-hero]')).toHaveCount(1);
});
