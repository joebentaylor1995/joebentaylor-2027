// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects saving wave settings: edits persist across a reload for both devices, mobile keeps its own
// defaults, and resetting then saving returns to the approved defaults.
test('wave settings save both profiles and reload with the approved defaults', async ({ page }) => {
	await page.goto('/?heroSettings');
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	// Approved defaults
	const bend = page.getByRole('spinbutton', { name: 'Glass refraction value', exact: true });
	await expect(bend).toHaveValue('2.75');
	await expect(page.getByLabel('Easing preset', { exact: true })).toHaveValue('sine.out');

	// Change three settings and save
	await bend.fill('1.5');
	const lensWidth = page.getByRole('spinbutton', { name: 'Lens distortion width value', exact: true });
	await lensWidth.fill('1.7');
	await page.getByRole('spinbutton', { name: 'Wave start delay (s) value', exact: true }).fill('0.35');
	await page.getByRole('button', { name: 'Save wave settings', exact: true }).click();
	await expect(page.getByText('Wave settings saved in this browser.', { exact: true })).toBeVisible();

	// They come back after reload
	await page.reload();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	await expect(bend).toHaveValue('1.5');
	await expect(lensWidth).toHaveValue('1.7');
	await expect(page.getByRole('spinbutton', { name: 'Wave start delay (s) value', exact: true })).toHaveValue('0.35');

	// Mobile has its own saved timing
	await page.getByLabel('Intro settings device').selectOption('mobile');
	await page.getByText('Heading & paragraph timing', { exact: true }).click();
	await expect(page.getByRole('spinbutton', { name: 'Heading start value', exact: true })).toHaveValue('0.3');
	await expect(page.getByRole('spinbutton', { name: 'Star start value', exact: true })).toHaveValue('0.7');
	await expect(page.getByRole('spinbutton', { name: 'Paragraph start value', exact: true })).toHaveValue('0.5');

	// Reset and save, and the defaults return
	await page.getByLabel('Intro settings device').selectOption('desktop');
	await page.getByRole('button', { name: 'Reset intro', exact: true }).click();
	await page.getByRole('button', { name: 'Save wave settings', exact: true }).click();
	await page.reload();
	await expect(bend).toHaveValue('2.75');
	await expect(lensWidth).toHaveValue('1');
});
