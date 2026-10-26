import { expect, test } from './helpers/test';

test('desktop wave exposes optical and trailing ripple controls with replay', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/?heroSettings');
	await expect(page.locator('[data-loader-overlay]')).toBeHidden({ timeout: 15000 });
	await expect(page.getByLabel('Intro settings device')).toHaveValue('desktop');
	for (const [name, value] of [
		['Wave start delay (s)', '0.2'],
		['Wave centre X (%)', '35'],
		['Reveal edge softness', '1.5'],
		['Lens distortion width', '1.7'],
		['Lens edge falloff', '0.75'],
		['Lens colour separation', '2'],
		['Lens edge shading', '0'],
		['Glass refraction', '0.8'],
		['Wave reflection', '0.5'],
		['Caustic highlight', '0'],
		['Trailing ripple strength', '0.4'],
		['Trailing ripple frequency', '10'],
		['Trailing ripple decay', '3'],
	] as const) {
		const control = page.getByRole('spinbutton', { name: `${name} value`, exact: true });
		await control.fill(value);
		await expect(control).toHaveValue(value);
	}
	await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'running');
	await expect(page.locator('[data-scene-cover]')).toHaveAttribute('data-complete', 'true', { timeout: 10000 });
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete');
	await page.getByRole('button', { name: 'Reset intro', exact: true }).click();
	await expect(page.getByRole('spinbutton', { name: 'Trailing ripple strength value', exact: true })).toHaveValue(
		'0'
	);
	expect(errors).toEqual([]);
});

test('mobile intro keeps independent settings without wave controls', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?heroSettings');
	await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
	const target = page.getByLabel('Intro settings device');
	const strength = page.getByRole('spinbutton', { name: 'Ripple strength value', exact: true });
	await expect(target).toHaveValue('mobile');
	await expect(strength).toHaveCount(0);
	await expect(page.getByText('Mobile uses a quick loader fade', { exact: false })).toBeVisible();
	await target.selectOption('desktop');
	await strength.fill('0.5');
	await target.selectOption('mobile');
	await expect(strength).toHaveCount(0);
	await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
	await expect(page.locator('[data-scene-cover]')).toHaveAttribute('data-complete', 'true');
	await target.selectOption('desktop');
	await expect(strength).toHaveValue('0.5');
});
