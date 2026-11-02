// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects fluid sizing on big screens: the root size stays 10px up to 1600px, then scales as width / 160.
test('root rem scale begins above 1600px without changing smaller layouts', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	// Ends back at 1440 to prove it scales down again
	for (const width of [440, 1440, 1600, 1601, 1920, 2560, 3840, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await expect
			.poll(() => page.locator('html').evaluate(element => parseFloat(getComputedStyle(element).fontSize)))
			.toBeCloseTo(width > 1600 ? width / 160 : 10, 2);
	}
	await expect(page.getByTestId('hero-depth').locator('img')).toHaveCSS('object-fit', 'cover');
});

// Protects the WebGL portrait proportions: after cover-fitting into the canvas, the drawn aspect ratio matches the
// source photo to within 0.001, at wide and tall desktop sizes.
test('WebGL portrait retains its source aspect at wide and tall desktop sizes', async ({ page }) => {
	await page.goto('/');
	const hero = page.getByTestId('hero-depth');
	await expect(hero).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
	for (const [width, height] of [
		[1600, 900],
		[1920, 1200],
		[2560, 1000],
		[1600, 1400],
	]) {
		await page.setViewportSize({ width, height });
		await expect
			.poll(() =>
				// Rebuilds the cover-fit size from the shader portraitAspect uniform and returns how far it is from the photo aspect
				hero.evaluate(element => {
					const canvas = element.querySelector('canvas');
					const photo = element.querySelector('img');
					const gl = canvas?.getContext('webgl');
					if (!canvas || !photo || !gl) return 1;
					const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
					const location = gl.getUniformLocation(program, 'portraitAspect');
					if (!location) return 1;
					const sourceAspect = photo.naturalWidth / photo.naturalHeight;
					const textureAspect = Number(gl.getUniform(program, location));
					const viewportAspect = canvas.width / canvas.height;
					const sizeX = Math.max(1, textureAspect / viewportAspect);
					const sizeY = Math.max(1, viewportAspect / textureAspect);
					const bounds = canvas.getBoundingClientRect();
					return Math.abs((bounds.width * sizeX) / (bounds.height * sizeY) - sourceAspect);
				})
			)
			.toBeLessThan(0.001);
	}
});
