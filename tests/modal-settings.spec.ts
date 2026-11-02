// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects the ?modalSettings tuning panel: absent by default, changes apply live to the keycap and
// globe, drafts persist across a reload, and Reset defaults restores the approved values.
test('modal settings are opt-in, update live, persist drafts and reset', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await expect(page.getByRole('complementary', { name: 'Modal settings' })).toHaveCount(0);

	// Opt-in: the panel only exists with the query flag, and sits beside the Profile modal
	await page.goto('/?modalSettings');
	const settings = page.getByRole('complementary', { name: 'Modal settings' });
	await expect(settings).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible();
	const settingsBox = await settings.boundingBox();
	const modalBox = await page.locator('#profile-panel').boundingBox();
	expect(settingsBox && modalBox && settingsBox.x + settingsBox.width < modalBox.x).toBeTruthy();

	// Keycap controls write straight to CSS custom properties
	await settings.getByRole('button', { name: 'Show keycap', exact: true }).click();
	await settings.locator('#modal-keycapX').fill('25');
	await expect(page.locator('[data-keycap]')).toHaveCSS('--keycap-x', '25%');
	await settings.locator('#modal-keycapRotation').fill('10');
	await expect(page.locator('[data-keycap]')).toHaveCSS('--keycap-rotation', '10deg');

	// Globe marker controls
	await settings.getByRole('button', { name: 'Show globe', exact: true }).click();
	const globe = page.locator('[data-globe]');
	await expect(globe).toHaveAttribute('data-state', 'ready');
	const marker = globe.locator('[data-globe-marker]');
	await settings.locator('#modal-globeDotSize').fill('14');
	await expect(marker).toHaveCSS('--map-dot-size', '1.4rem');
	await settings.locator('#modal-globePulseDuration').fill('3');
	await expect(marker).toHaveCSS('--map-pulse-duration', '3s');
	await settings.locator('#modal-globePulseScale').fill('4');
	await expect(marker).toHaveCSS('--map-pulse-scale', '4');
	await expect(marker).toHaveAttribute('data-pulse', 'true');

	// The pulse is suppressed under reduced motion, runs otherwise and stops when switched off
	expect(await marker.evaluate(el => getComputedStyle(el, '::after').display)).toBe('none');
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	expect(await marker.evaluate(el => getComputedStyle(el, '::after').animationName)).not.toBe('none');
	await settings.getByLabel('Dot pulse', { exact: true }).uncheck();
	expect(await marker.evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
	await page.emulateMedia({ reducedMotion: 'reduce' });

	// Changing the camera must move the marker without recreating the canvas
	const canvas = await globe.locator('canvas').elementHandle();
	const before = await globe.locator('[data-globe-marker]').boundingBox();
	await settings.locator('#modal-globeLongitude').fill('0');
	await settings.locator('#modal-globeZoom').fill('1.5');
	const after = await globe.locator('[data-globe-marker]').boundingBox();
	expect(before?.x).not.toBe(after?.x);
	expect(await canvas?.evaluate(element => element.isConnected)).toBe(true);

	// Edits persist across a reload
	await settings.getByLabel('Mouse movement', { exact: true }).uncheck();
	await page.reload();
	await expect(settings.locator('#modal-globeZoom')).toHaveValue('1.5');
	await expect(settings.locator('#modal-globeDotSize')).toHaveValue('14');
	await expect(settings.getByLabel('Dot pulse', { exact: true })).not.toBeChecked();
	await expect(settings.getByLabel('Mouse movement', { exact: true })).not.toBeChecked();

	// Reset returns to the defaults
	await settings.getByRole('button', { name: 'Reset defaults' }).click();
	await expect(settings.locator('#modal-globeZoom')).toHaveValue('1.29');
	await expect(settings.locator('#modal-keycapX')).toHaveValue('11.2');
	await page.goto('/');
	await expect(settings).toHaveCount(0);
});

// Protects the panel on a phone: it fits the viewport and can be collapsed.
test('settings remain reachable and collapsible on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 440, height: 900 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/?modalSettings');
	const settings = page.locator('[data-modal-settings]');
	await expect(settings).toBeVisible();
	const bounds = await settings.boundingBox();
	expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 440).toBeTruthy();
	await settings.locator('summary').click();
	await expect(settings.locator('#modal-keycapX')).not.toBeVisible();
});
