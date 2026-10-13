import { expect, test } from '@playwright/test';

test('hero renders without prototype chrome or a settings download', async ({ page }) => {
	const errors: string[] = [];
	const downloadedScripts: Promise<string>[] = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('response', response => {
		if (response.request().resourceType() === 'script') downloadedScripts.push(response.text().catch(() => ''));
	});
	await page.goto('/');
	const effect = page.getByTestId('hero-depth');
	await expect(effect).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
	await expect(page.getByRole('heading', { name: 'Digital Narrative Architect' })).toBeVisible();
	await expect(page.locator('[data-hero-settings]')).toHaveCount(0);
	await expect(page.getByText('Depth study', { exact: true })).toHaveCount(0);
	expect(
		(await Promise.all(downloadedScripts)).some(source => source.includes('Only loaded with ?heroSettings.'))
	).toBe(false);
	const canvas = effect.locator('canvas');
	await canvas.evaluate(element => {
		// Measure the hero listener before the site's Lenis scroll handler.
		element.closest('section')?.addEventListener('wheel', event => event.stopPropagation(), { once: true });
		const event = new WheelEvent('wheel', { deltaY: 600, bubbles: true, cancelable: true });
		element.dispatchEvent(event);
		if (event.defaultPrevented) throw new Error('Hero blocked page scrolling');
	});
	await page.waitForTimeout(300);
	expect(await canvas.evaluate(element => (element as HTMLCanvasElement).getContext('webgl')?.getError())).toBe(0);
	expect(errors).toEqual([]);
});

test('explicit query loads scroll zoom controls without particles', async ({ page }, testInfo) => {
	await page.goto('/?heroSettings');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
	const panel = page.getByRole('region', { name: 'Hero effect settings' });
	await expect(panel).toBeVisible();
	await expect(panel.getByRole('slider', { name: 'Scroll zoom strength', exact: true })).toHaveValue('1.1');
	await expect(panel.getByRole('checkbox', { name: 'Scroll depth zoom', exact: true })).toBeChecked();
	await expect(panel.getByText(/particles|click pulse/i)).toHaveCount(0);
	await expect(panel.getByText(/wireframe/i)).toHaveCount(0);
	await panel.getByRole('slider', { name: 'Scroll zoom strength', exact: true }).fill('2');
	await panel.getByRole('button', { name: 'Preview downward scroll' }).click();
	await page.waitForTimeout(350);
	const zoomState = await page
		.getByTestId('hero-depth')
		.locator('canvas')
		.evaluate(element => {
			const gl = (element as HTMLCanvasElement).getContext('webgl');
			if (!gl) throw new Error('WebGL unavailable');
			const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
			const velocity = gl.getUniformLocation(program, 'scrollVelocity');
			const zoom = gl.getUniformLocation(program, 'scrollFX[1]');
			if (!velocity || !zoom) throw new Error('Scroll zoom uniforms missing');
			return {
				velocity: gl.getUniform(program, velocity) as number,
				zoom: gl.getUniform(program, zoom) as number,
			};
		});
	expect(zoomState.velocity).toBeGreaterThan(0.01);
	expect(zoomState.zoom).toBe(2);
	await page.screenshot({ path: testInfo.outputPath('scroll-zoom.png') });
	expect(
		await page
			.getByTestId('hero-depth')
			.locator('canvas')
			.evaluate(element => (element as HTMLCanvasElement).getContext('webgl')?.getError())
	).toBe(0);
	await panel.getByRole('button', { name: 'Reset saved defaults' }).click();
	await expect(panel.getByRole('slider', { name: 'Scroll zoom strength', exact: true })).toHaveValue('1.1');
});

test('reduced motion keeps a static portrait and skips WebGL textures', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const requests: string[] = [];
	page.on('request', request => requests.push(request.url()));
	await page.goto('/');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'false');
	await expect(page.getByTestId('hero-depth').locator('img')).toBeVisible();
	expect(requests.some(url => url.includes('/hero-depth/depth.webp'))).toBe(false);
});
