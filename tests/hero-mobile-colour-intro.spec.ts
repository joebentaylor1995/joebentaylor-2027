// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the mobile intro: the portrait colour uniform starts at 1 on reveal and eases to 0 after
// the loader fade rather than snapping.
test('mobile portrait colour settles after the loader fade', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => {
		// Record the portrait introColour uniform and snapshot it on the loader reveal and settled events
		const audit = { colour: 0, atReveal: -1, atFadeEnd: -1 };
		Object.assign(window, { colourIntroAudit: audit });
		const locations = new WeakSet<WebGLUniformLocation>();
		const locate = WebGLRenderingContext.prototype.getUniformLocation;
		const uniform = WebGLRenderingContext.prototype.uniform1f;
		WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
			const location = locate.call(this, program, name);
			if (location && name === 'introColour') locations.add(location);
			return location;
		};
		WebGLRenderingContext.prototype.uniform1f = function (location, value) {
			if (location && locations.has(location)) audit.colour = value;
			uniform.call(this, location, value);
		};
		window.addEventListener('site-loader:reveal', () => {
			audit.atReveal = audit.colour;
		});
		window.addEventListener('site-loader:settled', () => {
			audit.atFadeEnd = audit.colour;
		});
	});
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 15000 });

	// Reads the audit object back from the page
	const read = () =>
		page.evaluate(
			() =>
				(
					window as unknown as {
						colourIntroAudit: { colour: number; atReveal: number; atFadeEnd: number };
					}
				).colourIntroAudit
		);

	// introColour is 1 at reveal, part-way when the loader settles, and ends at 0
	const audit = await read();
	expect(audit.atReveal).toBe(1);
	expect(audit.atFadeEnd).toBeGreaterThan(0);
	expect(audit.atFadeEnd).toBeLessThan(1);
	await expect.poll(async () => (await read()).colour).toBe(0);
});
