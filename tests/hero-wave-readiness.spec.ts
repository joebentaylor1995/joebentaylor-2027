import { expect, test } from './helpers/test';

test('desktop reveal waits for slow shader compilation and renders the whole wave', async ({ page }) => {
	await page.addInitScript(() => {
		let readyAfter = Infinity;
		window.addEventListener('site-loader:landed', () => {
			readyAfter = performance.now() + 1400;
		});
		const parameter = WebGLRenderingContext.prototype.getProgramParameter;
		WebGLRenderingContext.prototype.getProgramParameter = function (program, name) {
			if (name === 0x91b1 && performance.now() < readyAfter) return false;
			return parameter.call(this, program, name);
		};
		const state = { readyAtReveal: false, values: [] as number[] };
		Object.assign(window, { waveAudit: state });
		window.addEventListener('site-loader:reveal', () => {
			state.readyAtReveal = !!document.querySelector('[data-liquid-ready="true"]');
		});
		const names = new WeakMap<WebGLUniformLocation, string>();
		const locate = WebGLRenderingContext.prototype.getUniformLocation;
		const uniform = WebGLRenderingContext.prototype.uniform1f;
		WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
			const location = locate.call(this, program, name);
			if (location) names.set(location, name);
			return location;
		};
		WebGLRenderingContext.prototype.uniform1f = function (location, value) {
			if (location && names.get(location) === 'waterReveal') state.values.push(value);
			uniform.call(this, location, value);
		};
	});
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 12000 });
	const audit = await page.evaluate(
		() => (window as unknown as { waveAudit: { readyAtReveal: boolean; values: number[] } }).waveAudit
	);
	expect(audit.readyAtReveal).toBe(true);
	expect(audit.values[0]).toBe(0);
	expect(audit.values.some(value => value > 0.2 && value < 0.8)).toBe(true);
	expect(audit.values).toContain(1);
});
