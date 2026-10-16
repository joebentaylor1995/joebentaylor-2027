import { expect, test } from '@playwright/test';

test('mobile WebGL intro has independent settings and can replay', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => {
		const names = new WeakMap<WebGLUniformLocation, string>();
		const locate = WebGLRenderingContext.prototype.getUniformLocation;
		const uniform = WebGLRenderingContext.prototype.uniform1f;
		Object.assign(window, { rippleStrength: 0, waterReveal: 1 });
		WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
			const location = locate.call(this, program, name);
			if (location) names.set(location, name);
			return location;
		};
		WebGLRenderingContext.prototype.uniform1f = function (location, value) {
			const name = location && names.get(location);
			if (name === 'rippleStrength' || name === 'waterReveal') Object.assign(window, { [name]: value });
			uniform.call(this, location, value);
		};
	});
	await page.goto('/?heroSettings');
	await expect(page.locator('[data-liquid-ready="true"]')).toBeVisible({ timeout: 30000 });
	await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 10000 });
	const target = page.getByLabel('Intro settings device');
	const strength = page.getByRole('spinbutton', { name: 'Ripple strength value', exact: true });
	await expect(target).toHaveValue('mobile');
	await strength.fill('1.5');
	const readStrength = () => page.evaluate(() => (window as unknown as { rippleStrength: number }).rippleStrength);
	await expect.poll(readStrength).toBe(1.5);
	await target.selectOption('desktop');
	await expect(strength).toHaveValue('1');
	await strength.fill('0.5');
	await expect.poll(readStrength).toBe(1.5);
	await target.selectOption('mobile');
	await expect(strength).toHaveValue('1.5');
	await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
	await page.getByRole('button', { name: 'Hide effect settings', exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { waterReveal: number }).waterReveal))
		.toBeLessThan(0.95);
	await page.screenshot({ path: 'test-results/mobile-webgl-intro.png' });
	await page.getByRole('button', { name: 'Effect settings', exact: true }).click();
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect.poll(readStrength, { timeout: 15000 }).toBe(0.5);
	await target.selectOption('desktop');
	await expect(strength).toHaveValue('0.5');
});
