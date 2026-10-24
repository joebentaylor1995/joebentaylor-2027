import { expect, test } from './helpers/test';

test('water survives a hidden route becoming visible again', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/projects/jillian-phyllis/');
	const canvas = page.locator('[data-project-water]');
	await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
	await page.locator('[data-project-hero]').evaluate(async host => {
		host.style.display = 'none';
		await new Promise(resolve => setTimeout(resolve, 150));
		host.style.removeProperty('display');
	});
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect(canvas).toHaveAttribute('data-ready', 'true');
	await page.mouse.move(400, 300);
	await page.mouse.move(700, 400, { steps: 10 });
	expect(errors).toEqual([]);
});

test('failed framebuffer allocation during resize restores the native hero', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.addInitScript(() => {
		const original = WebGLRenderingContext.prototype.checkFramebufferStatus;
		WebGLRenderingContext.prototype.checkFramebufferStatus = function (target) {
			return document.documentElement.dataset.failFramebuffer === 'true'
				? this.FRAMEBUFFER_UNSUPPORTED
				: original.call(this, target);
		};
	});
	await page.goto('/projects/jillian-phyllis/');
	const canvas = page.locator('[data-project-water]');
	await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
	await page.evaluate(() => {
		document.documentElement.dataset.failFramebuffer = 'true';
	});
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect(canvas).not.toHaveAttribute('data-ready');
	await expect(canvas).toHaveCSS('opacity', '0');
	await expect(page.locator('[data-project-hero]')).not.toHaveAttribute('data-water-text');
	await expect(page.locator('[data-project-hero] img').first()).toBeVisible();
	expect(errors).toEqual([]);
});
