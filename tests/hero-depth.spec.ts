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
		(await Promise.all(downloadedScripts)).some(source => source.includes('Only loaded with ?heroSettings=1'))
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

test('explicit query loads working controls and saved defaults', async ({ page }) => {
	await page.goto('/?heroSettings=1');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
	const panel = page.getByRole('region', { name: 'Hero effect settings' });
	await expect(panel).toBeVisible();
	await expect(panel.getByRole('slider', { name: /^Particle size/ })).toHaveValue('5');
	await expect(panel.getByRole('checkbox', { name: 'Scroll particles', exact: true })).toBeChecked();
	await expect(panel.getByRole('checkbox', { name: 'Blue wireframe', exact: true })).not.toBeChecked();
	await panel.getByRole('slider', { name: /^Particle size/ }).fill('2');
	await panel.getByRole('button', { name: 'Preview downward scroll' }).click();
	await page.waitForTimeout(350);
	expect(
		await page
			.getByTestId('hero-depth')
			.locator('canvas')
			.evaluate(element => (element as HTMLCanvasElement).getContext('webgl')?.getError())
	).toBe(0);
	await panel.getByRole('button', { name: 'Reset saved defaults' }).click();
	await expect(panel.getByRole('slider', { name: /^Particle size/ })).toHaveValue('5');
});

test('reduced motion keeps a static portrait and skips WebGL textures', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const requests: string[] = [];
	page.on('request', request => requests.push(request.url()));
	await page.goto('/');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'false');
	await expect(page.getByTestId('hero-depth').locator('img')).toBeVisible();
	expect(requests.some(url => url.includes('/hero-depth/depth.png'))).toBe(false);
});
