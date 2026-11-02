// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the water effect when its hero is hidden and shown again, then resized: it comes back ready and
// pointer movement raises no errors.
test('water survives a hidden route becoming visible again', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/projects/jillian-phyllis/');
	const canvas = page.locator('[data-project-water]');
	await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
	// Hide the hero briefly (display none) and restore it, as a hidden route would
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

// Protects the fallback when a resize cannot allocate a framebuffer: the canvas turns off and the plain hero image
// returns, without errors.
test('failed framebuffer allocation during resize restores the native hero', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	// Make framebuffer checks fail once data-fail-framebuffer is set on <html>
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

	// Start failing, then resize to force a reallocation
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
