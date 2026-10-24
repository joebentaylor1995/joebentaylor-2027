import { expect, test } from './helpers/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('mobile and desktop scene settings stay independent across resize and reload', async ({ page }) => {
	await page.goto('/?modalSettings');
	const panel = page.getByRole('complementary', { name: 'Modal settings' });
	const device = panel.getByLabel('Settings device');
	await expect(device).toHaveValue('mobile');
	await panel.getByRole('button', { name: 'Show Recognition', exact: true }).click();
	const awards = page.locator('[data-recognition]');
	await expect(awards).toHaveAttribute('data-state', 'ready');
	await expect(awards).toHaveAttribute('data-spiral-zoom', '1.55');
	await panel.locator('#modal-awardZoom').fill('2');
	await expect(awards).toHaveAttribute('data-spiral-zoom', '2');
	await expect(awards).toHaveAttribute('data-award-size', '89');
	await panel.locator('#modal-awardSize').fill('60');
	await expect(awards).toHaveAttribute('data-award-size', '60');
	await device.selectOption('desktop');
	await expect(panel.locator('#modal-awardSize')).toHaveValue('85');
	await panel.locator('#modal-awardSize').fill('120');
	await expect(awards).toHaveAttribute('data-award-size', '60');
	await page.setViewportSize({ width: 1440, height: 900 });
	await panel.getByRole('button', { name: 'Show Recognition', exact: true }).click();
	await expect(awards).toHaveAttribute('data-award-size', '120');
	await expect(awards).toHaveAttribute('data-spiral-zoom', '1');
	await page.setViewportSize({ width: 390, height: 844 });
	await panel.getByRole('button', { name: 'Show Recognition', exact: true }).click();
	await expect(awards).toHaveAttribute('data-award-size', '60');
	await page.reload();
	await expect(device).toHaveValue('mobile');
	await expect(panel.locator('#modal-awardZoom')).toHaveValue('2');
	await expect(panel.locator('#modal-awardSize')).toHaveValue('60');
	await panel.getByRole('button', { name: 'Reset defaults', exact: true }).click();
	await device.selectOption('desktop');
	await expect(panel.locator('#modal-awardSize')).toHaveValue('120');
	await device.selectOption('mobile');
	await panel.getByRole('button', { name: 'Show Design toolkit', exact: true }).click();
	const toolkit = page.locator('[data-toolkit="Design toolkit"]');
	await expect(toolkit).toHaveAttribute('data-state', 'ready');
	await panel.locator('#modal-designToolkitSize').fill('70');
	await expect
		.poll(() =>
			toolkit
				.locator('button')
				.first()
				.evaluate(el => parseFloat(getComputedStyle(el).width))
		)
		.toBeCloseTo(68.6, 1);
	await device.selectOption('desktop');
	await expect(panel.locator('#modal-designToolkitSize')).toHaveValue('100');
});

test('mobile face preview saves its comparison setting and touch does not trigger CTA hover', async ({ page }) => {
	await page.goto('/?modalSettings');
	const settings = page.getByRole('complementary', { name: 'Modal settings' });
	const toggle = settings.getByLabel('Smaller mobile face');
	const size = settings.getByLabel('Mobile face size');
	await expect(toggle).toBeChecked();
	await size.fill('1');
	await toggle.uncheck();
	await expect(size).toBeDisabled();
	await page.reload();
	await expect(toggle).not.toBeChecked();
	await expect(size).toHaveValue('1');
	await toggle.check();
	await settings.getByRole('button', { name: 'Show Connect', exact: true }).click();
	const section = page.locator('[data-connect]');
	await expect(section).toHaveAttribute('data-state', 'ready');
	await settings.locator('summary').click();
	const title = section.locator('[data-connect-title]');
	await title.dispatchEvent('pointerenter', { pointerType: 'touch' });
	await expect(title.locator('[data-connect-line]').first()).toHaveCSS('--hover-fill', '-16');
	await expect(title.locator('[data-connect-line]').first()).toHaveCSS('transform', 'none');
	await page.screenshot({ path: 'test-results/mobile-face-preview.png' });
});
