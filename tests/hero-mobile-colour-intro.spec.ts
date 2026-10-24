import { expect, test } from './helpers/test';

test('mobile portrait colour settles after the loader fade', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => {
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
	const read = () =>
		page.evaluate(
			() =>
				(
					window as unknown as {
						colourIntroAudit: { colour: number; atReveal: number; atFadeEnd: number };
					}
				).colourIntroAudit
		);
	const audit = await read();
	expect(audit.atReveal).toBe(1);
	expect(audit.atFadeEnd).toBeGreaterThan(0);
	expect(audit.atFadeEnd).toBeLessThan(1);
	await expect.poll(async () => (await read()).colour).toBe(0);
});
