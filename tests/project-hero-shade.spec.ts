// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects the darkening gradient over the case study hero: the top 59% is untouched and it eases to 40%
// black at the bottom, in both the WebGL hero and the native image used for reduced motion.
for (const width of [390, 1440]) {
	test(`case-study shade darkens the bottom 41% to 40% black at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		// Serve a plain white image so any darkening in the output is the shade alone
		await page.route('**/_next/image/**', route =>
			route.fulfill({
				contentType: 'image/svg+xml',
				body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600"><path fill="white" d="M0 0h1600v1600H0z"/></svg>',
			})
		);
		// After each draw with a shade uniform, read the red channel at the right edge at four depths down the
		// hero (2%, 50%, 80%, 100%) and store them on window
		await page.addInitScript(() => {
			const draw = WebGLRenderingContext.prototype.drawArrays;
			WebGLRenderingContext.prototype.drawArrays = function (...args: Parameters<typeof draw>) {
				draw.apply(this, args);
				const program = this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram | null;
				if (!program) return;
				const shade = this.getUniformLocation(program, 'shade');
				if (!shade) return;
				const [scale] = this.getUniform(program, shade) as Float32Array;
				const viewport = this.getParameter(this.VIEWPORT) as Int32Array;
				const pixels = [0.02, 0.5, 0.8, 1].map(depth => {
					const pixel = new Uint8Array(4);
					this.readPixels(
						Math.floor(viewport[2] * 0.99),
						Math.max(0, Math.floor(viewport[3] * (1 - depth / scale))),
						1,
						1,
						this.RGBA,
						this.UNSIGNED_BYTE,
						pixel
					);
					return pixel[0];
				});
				Object.assign(window, { projectShadePixels: pixels });
			};
		});
		await page.goto('/projects/pocketchange/');
		await expect(page.locator('[data-project-water]')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
		const pixels = await page.evaluate(
			() => (window as unknown as { projectShadePixels: number[] }).projectShadePixels
		);
		// Untouched above 59% of the hero, then easing to 40% black at its foot
		for (const [index, expected] of [255, 255, 203, 153].entries())
			expect(Math.abs(pixels[index] - expected)).toBeLessThanOrEqual(2);

		// Reduced motion uses the native image and must retain the same overlay.
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(page.locator('[data-project-water]')).not.toHaveAttribute('data-ready', 'true');
		const native = await page.locator('[data-project-hero]').evaluate(element => {
			const style = getComputedStyle(element, '::after');
			return { opacity: style.opacity, background: style.backgroundImage, height: style.height };
		});
		expect(native.opacity).toBe('0.4');
		expect(native.background).toContain('59%');
		expect(Number.parseFloat(native.height)).toBeCloseTo(900, 0);
	});
}
