import { expect, test } from './helpers/test';

test('direct projects entry uses the wave and settings require the projectSettings URL', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.addInitScript(() => {
		const locations = new WeakMap<WebGLUniformLocation, string>();
		const getUniform = WebGLRenderingContext.prototype.getUniformLocation;
		const setUniform = WebGLRenderingContext.prototype.uniform1f;
		WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
			const location = getUniform.call(this, program, name);
			if (location) locations.set(location, name);
			return location;
		};
		WebGLRenderingContext.prototype.uniform1f = function (location, value) {
			if (
				location &&
				locations.get(location) === 'progress' &&
				value > 0 &&
				value < 1 &&
				this.canvas instanceof HTMLCanvasElement
			)
				this.canvas.dataset.waveRendered = 'true';
			return setUniform.call(this, location, value);
		};
	});
	await page.goto('/projects/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-outro', 'wave');
	const ribbon = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(ribbon.locator('#stage')).toBeVisible({ timeout: 15000 });
	await expect(ribbon.locator('#stage')).toHaveAttribute('data-wave-rendered', 'true', { timeout: 15000 });
	await expect(ribbon.locator('#toggle')).toBeHidden();
	await expect(ribbon.locator('#settings')).toHaveClass(/hidden/);
	await page.goto('/projects/?projectSettings');
	await expect(ribbon.locator('#stage')).toBeVisible({ timeout: 15000 });
	await expect(ribbon.locator('#toggle')).toBeHidden();
	await expect(ribbon.locator('#settings')).not.toHaveClass(/hidden/);
	await ribbon.getByLabel('Cascade easing', { exact: true }).selectOption('2');
	await ribbon.getByLabel('Cascade stagger', { exact: true }).press('Home');
	await ribbon.getByLabel('Cascade stagger', { exact: true }).press('ArrowRight');
	await expect(ribbon.locator('#intro-cascadeStagger-value')).toHaveText('5ms');
	await page.reload();
	await expect(ribbon.getByLabel('Cascade easing', { exact: true })).toHaveValue('2');
	await expect(ribbon.getByLabel('Cascade stagger', { exact: true })).toHaveValue('5');
	await expect(ribbon.getByLabel('Start during page transition', { exact: true })).toHaveValue('50');
	expect(errors).toEqual([]);
});

test('home to projects runs a single wave before the cascade', async ({ page }) => {
	await page.addInitScript(() => {
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (frames, options) {
			if (typeof options === 'object' && options?.pseudoElement === '::view-transition-new(navigation-surface)') {
				const count = Number(document.documentElement.dataset.waveCount || 0);
				document.documentElement.dataset.waveCount = String(count + 1);
			}
			return animate.call(this, frames, options);
		};
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	const ribbon = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(ribbon.locator('#intro-status')).toContainText('Ready. Replay', { timeout: 20000 });
	await expect(page.locator('html')).toHaveAttribute('data-wave-count', '1');
	await expect(ribbon.locator('#intro-effect')).toHaveCount(0);
});
